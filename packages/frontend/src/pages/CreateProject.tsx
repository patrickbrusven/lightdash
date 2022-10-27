import { subject } from '@casl/ability';
import { getDateFormat, TimeFrames } from '@lightdash/common';
import moment from 'moment';
import { FC, useEffect, useState } from 'react';
import { Redirect, useHistory, useParams } from 'react-router-dom';
import Page from '../components/common/Page/Page';
import PageSpinner from '../components/PageSpinner';
import ConnectManually from '../components/ProjectConnection/ProjectConnectFlow/ConnectManually';
import ConnectSuccess from '../components/ProjectConnection/ProjectConnectFlow/ConnectSuccess';
import ConnectUsingCLI from '../components/ProjectConnection/ProjectConnectFlow/ConnectUsingCLI';
import SelectWarehouse, {
    OtherWarehouse,
    SelectedWarehouse,
} from '../components/ProjectConnection/ProjectConnectFlow/SelectWarehouse';
import UnsupportedWarehouse from '../components/ProjectConnection/ProjectConnectFlow/UnsupportedWarehouse';
import { ProjectFormProvider } from '../components/ProjectConnection/ProjectFormProvider';
import { useOrganisation } from '../hooks/organisation/useOrganisation';
import { useCreateAccessToken } from '../hooks/useAccessToken';
import useSearchParams from '../hooks/useSearchParams';
import { useApp } from '../providers/AppProvider';

enum ConnectMethod {
    CLI = 'cli',
    MANUAL = 'manual',
}

const CreateProject: FC = () => {
    const history = useHistory();
    const { isLoading: isLoadingOrganization, data: organization } =
        useOrganisation();

    const {
        health: { data: health, isLoading: isLoadingHealth },
        user: { data: user, isLoading: isLoadingUser },
    } = useApp();

    const {
        mutate: mutateAccessToken,
        data: tokenData,
        isLoading: isTokenCreating,
        isSuccess: isTokenCreated,
    } = useCreateAccessToken();

    const { method } = useParams<{ method: ConnectMethod }>();
    const projectUuid = useSearchParams('projectUuid');

    const [warehouse, setWarehouse] = useState<SelectedWarehouse>();

    useEffect(() => {
        if (method !== ConnectMethod.CLI || isTokenCreated) return;

        const expiresAt = moment().add(30, 'days').toDate();
        const generatedAtString = moment().format(
            getDateFormat(TimeFrames.SECOND),
        );

        mutateAccessToken({
            expiresAt,
            description: `Generated by the Lightdash UI for CLI at ${generatedAtString}`,
            autoGenerated: true,
        });
    }, [mutateAccessToken, method, isTokenCreated]);

    if (
        isLoadingHealth ||
        !health ||
        isLoadingUser ||
        !user ||
        isLoadingOrganization ||
        !organization ||
        isTokenCreating
    ) {
        return <PageSpinner />;
    }

    const canUserCreateProject = user.ability.can(
        'create',
        subject('Project', {
            organizationUuid: organization.organizationUuid,
        }),
    );

    if (!canUserCreateProject) {
        return <Redirect to="/" />;
    }

    const isCreatingFirstProject = !!organization.needsProject;

    return (
        <ProjectFormProvider>
            <Page noContentPadding>
                {method && projectUuid ? (
                    <ConnectSuccess projectUuid={projectUuid} />
                ) : (
                    <>
                        {!warehouse ? (
                            <SelectWarehouse
                                isCreatingFirstProject={isCreatingFirstProject}
                                onSelect={setWarehouse}
                            />
                        ) : warehouse === OtherWarehouse.Other ? (
                            <UnsupportedWarehouse
                                onBack={() => {
                                    setWarehouse(undefined);
                                    history.replace('/createProject');
                                }}
                            />
                        ) : (
                            <>
                                {warehouse && method === ConnectMethod.CLI && (
                                    <ConnectUsingCLI
                                        loginToken={tokenData?.token}
                                        siteUrl={health.siteUrl}
                                        version={health.version}
                                        isCreatingFirstProject={
                                            isCreatingFirstProject
                                        }
                                        onBack={() => {
                                            setWarehouse(undefined);
                                            history.replace('/createProject');
                                        }}
                                    />
                                )}

                                {warehouse &&
                                    method === ConnectMethod.MANUAL && (
                                        <ConnectManually
                                            isCreatingFirstProject={
                                                isCreatingFirstProject
                                            }
                                            selectedWarehouse={warehouse}
                                        />
                                    )}

                                {warehouse && !method && (
                                    <Redirect
                                        to={`/createProject/${ConnectMethod.CLI}`}
                                    />
                                )}
                            </>
                        )}
                    </>
                )}
            </Page>
        </ProjectFormProvider>
    );
};

export default CreateProject;
