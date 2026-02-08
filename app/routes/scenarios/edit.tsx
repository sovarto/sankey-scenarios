import { useCallback, useEffect, useRef } from 'react';
import { Form, Link, useFetcher, useLoaderData, useActionData, useRevalidator } from 'react-router';
import type { Route } from './+types/edit';
import { AddConnectionForm, ConnectionList, DiagramSection, InlineEditableText, LocalNodesPanel } from './components';
import type { ConnectionRowData } from './components/types';
import { handleUpdateName, handleUpdateDescription, handleDeleteScenario, handleAddConnection, handleDeleteConnection, handleUpdateConnectionValue, handleUpdateConnectionPlaceholderType, handleUpdateConnectionAutoValue, handleUpdateConnectionSource, handleUpdateConnectionTarget, handleDeleteGroupReference, handleDeleteNodeReference, handleUpdateGroupRefShowNode, handleUpdateGroupRefSubNode, handleUpdateGroupRefValue, handleUpdateGroupRefAutoValue, handleUpdateGroupRefPlaceholderType, handleUpdateLocalNode, handleReorderConnections, handlePromoteToProjectNode, handleAddLocalNodesToGroup, handleAddLocalNodesToNewGroup, handleUpdateGroupNodeOrder, handleResetGroupNodeOrder } from './edit/actions.server';
import { loadScenarioView } from './edit/loader.server';
import { database } from '~/database/context';
import { requireProjectAccess, requireProjectWriteAccess, parseProjectId } from '~/utils/project-ownership.server';
import { broadcastScenarioUpdate } from '~/utils/realtime.server';
import { useRealtime, ActiveCollaborators, ConnectionStatus } from '~/utils/useRealtime';

export function meta({ data }: Route.MetaArgs) {
    return [ {
        title: data?.scenario ? `${data.scenario.name} - ${data.project.name}` : 'Scenario Not Found'
    } ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
    const projectId = parseProjectId(params.projectId);
    const scenarioId = parseInt(params.scenarioId, 10);

    if (isNaN(scenarioId)) {
        throw new Response('Invalid scenario ID', { status: 400 });
    }

    const access = await requireProjectAccess(request, projectId);
    const data = await loadScenarioView(projectId, scenarioId, access.user.id, access);
    return {
        ...data,
        userLocale: access.user.regionalLocale,
        permission: access.permission,
        canWrite: access.canWrite,
        currentUserId: access.user.id,
        currentUserName: access.user.name
    };
}

export async function action({ request, params }: Route.ActionArgs) {
    const projectId = parseProjectId(params.projectId);
    const scenarioId = parseInt(params.scenarioId, 10);

    if (isNaN(scenarioId)) {
        throw new Response('Invalid scenario ID', { status: 400 });
    }

    const access = await requireProjectWriteAccess(request, projectId);

    const formData = await request.formData();
    const intent = formData.get('intent');

    const db = database();
    const ctx = { db, projectId, scenarioId, formData };

    let result;

    switch (intent) {
        case 'update-name':
            result = await handleUpdateName(ctx);
            break;
        case 'update-description':
            result = await handleUpdateDescription(ctx);
            break;
        case 'delete':
            // Delete doesn't broadcast - user is redirected away
            return handleDeleteScenario(ctx);
        case 'add-connection':
            result = await handleAddConnection(ctx);
            break;
        case 'delete-connection':
            result = await handleDeleteConnection(ctx);
            break;
        case 'update-connection-value':
            result = await handleUpdateConnectionValue(ctx);
            break;
        case 'update-connection-placeholder-type':
            result = await handleUpdateConnectionPlaceholderType(ctx);
            break;
        case 'update-connection-auto-value':
            result = await handleUpdateConnectionAutoValue(ctx);
            break;
        case 'update-connection-source':
            result = await handleUpdateConnectionSource(ctx);
            break;
        case 'update-connection-target':
            result = await handleUpdateConnectionTarget(ctx);
            break;
        case 'delete-group-reference':
            result = await handleDeleteGroupReference(ctx);
            break;
        case 'delete-node-reference':
            result = await handleDeleteNodeReference(ctx);
            break;
        case 'update-group-ref-show-node':
            result = await handleUpdateGroupRefShowNode(ctx);
            break;
        case 'update-group-ref-sub-node':
            result = await handleUpdateGroupRefSubNode(ctx);
            break;
        case 'update-group-ref-value':
            result = await handleUpdateGroupRefValue(ctx);
            break;
        case 'update-group-ref-auto-value':
            result = await handleUpdateGroupRefAutoValue(ctx);
            break;
        case 'update-group-ref-placeholder-type':
            result = await handleUpdateGroupRefPlaceholderType(ctx);
            break;
        case 'update-local-node':
            result = await handleUpdateLocalNode(ctx);
            break;
        case 'reorder-connections':
            result = await handleReorderConnections(ctx);
            break;
        case 'promote-to-project-node':
            result = await handlePromoteToProjectNode(ctx);
            break;
        case 'add-local-nodes-to-group':
            result = await handleAddLocalNodesToGroup(ctx);
            break;
        case 'add-local-nodes-to-new-group':
            result = await handleAddLocalNodesToNewGroup(ctx);
            break;
        case 'update-group-node-order':
            result = await handleUpdateGroupNodeOrder(ctx);
            break;
        case 'reset-group-node-order':
            result = await handleResetGroupNodeOrder(ctx);
            break;
        default:
            result = { success: true };
    }

    // Broadcast update to other collaborators
    broadcastScenarioUpdate(projectId, scenarioId, 'scenario-updated', { intent }, access.user.id);

    return result;
}

export default function ViewScenario({}: Route.ComponentProps) {
    const loaderData = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const {
        project,
        scenario,
        resolvedConnections,
        groups,
        nodes,
        existingPlaceholders,
        userLocale,
        permission,
        canWrite,
        currentUserId,
        currentUserName,
    } = loaderData;
    const fetcher = useFetcher();
    const revalidator = useRevalidator();

    // Real-time collaboration
    const handleRealtimeEvent = useCallback(async () => {
        // When another user makes a change, revalidate to get latest data
        await revalidator.revalidate();
    }, [ revalidator ]);

    const handleReconnect = useCallback(async () => {
        // After reconnecting, fetch latest data
        await revalidator.revalidate();
    }, [ revalidator ]);

    const { isConnected, activeUsers } = useRealtime({
        projectId: project.id,
        scenarioId: scenario.id,
        onEvent: handleRealtimeEvent,
        onReconnect: handleReconnect
    });

    const localNodes = scenario.localNodes;

    const getLocalNodeName = (id: number | undefined | null) => {
        if (!id) {
            return '';
        }
        return localNodes.find(ln => ln.id === id)?.name ?? '';
    };

    const connectionRows: ConnectionRowData[] = [
        ...scenario.connections.map(conn => ({
            type: 'direct' as const,
            id: conn.id,
            source: getLocalNodeName(conn.sourceLocalNode?.id) || conn.source || '',
            target: getLocalNodeName(conn.targetLocalNode?.id) || conn.target || '',
            sourceLocalNodeId: conn.sourceLocalNode?.id,
            targetLocalNodeId: conn.targetLocalNode?.id,
            value: conn.value,
            valueType: (conn.valueType === 'percent' ? 'percent' : 'absolute') as 'absolute' | 'percent',
            displayOrder: conn.displayOrder,
            placeholderType: conn.placeholderType as 'missing' | 'remaining' | null | undefined,
            autoValue: conn.autoValue === 1
        })),
        ...scenario.groupReferences.map(ref => ({
            type: 'group-ref' as const,
            id: ref.id,
            source: ref.direction === 'target'
                ? (ref.subNode ? `[${ref.group.name}.${ref.subNode}]` : `[${ref.group.name}]`)
                : getLocalNodeName(ref.connectingLocalNode.id),
            target: ref.direction === 'source'
                ? (ref.subNode ? `[${ref.group.name}.${ref.subNode}]` : `[${ref.group.name}]`)
                : getLocalNodeName(ref.connectingLocalNode.id),
            value: ref.value ?? 0,
            valueType: (ref.valueType === 'percent' ? 'percent' : 'absolute') as 'absolute' | 'percent',
            displayOrder: ref.displayOrder,
            refName: ref.group.name,
            refId: ref.group.id,
            direction: ref.direction as 'source' | 'target',
            connectingLocalNodeId: ref.connectingLocalNode.id,
            showGroupNode: ref.showGroupNode === 1,
            subNode: ref.subNode,
            subNodeValue: ref.value,
            placeholderType: ref.placeholderType as 'missing' | 'remaining' | null | undefined,
            autoValue: ref.autoValue === 1,
            nodeOrders: ref.nodeOrders?.map(o => ({ nodeName: o.nodeName, displayOrder: o.displayOrder }))
        })),
        ...scenario.nodeReferences.map(ref => ({
            type: 'node-ref' as const,
            id: ref.id,
            source: ref.direction === 'source' ? ref.node.name : getLocalNodeName(ref.connectingLocalNode.id),
            target: ref.direction === 'target' ? ref.node.name : getLocalNodeName(ref.connectingLocalNode.id),
            value: ref.node.value,
            displayOrder: ref.displayOrder,
            refName: ref.node.name,
            refId: ref.node.id,
            direction: ref.direction as 'source' | 'target',
            connectingLocalNodeId: ref.connectingLocalNode.id
        })),
    ].sort((a, b) => a.displayOrder - b.displayOrder);

    const handleDelete = (row: ConnectionRowData) => {
        if (!confirm('Remove this connection?')) {
            return;
        }

        const intent = row.type === 'direct'
            ? 'delete-connection'
            : row.type === 'group-ref'
            ? 'delete-group-reference'
            : 'delete-node-reference';

        const idField = row.type === 'direct' ? 'connectionId' : 'referenceId';

        void fetcher.submit(
            { intent, [idField]: row.id.toString() },
            { method: 'post' }
        );
    };

    if (actionData && 'redirect' in actionData && actionData.redirect) {
        window.location.href = actionData.redirect;
    }

    // Get errors from action or fetcher - show as popup
    const actionError = actionData && 'error' in actionData ? actionData.error : null;
    const fetcherError = fetcher.data && typeof fetcher.data === 'object' && 'error' in fetcher.data
        ? (fetcher.data as { error: string }).error
        : null;
    const displayError = actionError || fetcherError;
    const lastShownError = useRef<string | null>(null);

    useEffect(() => {
        if (displayError && displayError !== lastShownError.current) {
            lastShownError.current = displayError;
            alert(displayError);
        }
    }, [ displayError ]);

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <div className='flex items-center justify-between'>
                        <Link to={`/projects/${project.id}`} className='text-sm text-gray-500 hover:text-gray-700'>
                            ← Back to {project.name}
                        </Link>
                        <div className='flex items-center gap-4'>
                            <ActiveCollaborators users={activeUsers} currentUserId={currentUserId} />
                            <ConnectionStatus isConnected={isConnected} />
                            {!canWrite && (
                                <span className='px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium'>
                                    View Only
                                </span>
                            )}
                        </div>
                    </div>
                    <div className='mt-2'>
                        {canWrite
                            ? (
                                <>
                                    <InlineEditableText
                                        value={scenario.name}
                                        name='name'
                                        as='h1'
                                        className='text-3xl font-bold text-gray-900'
                                        inputClassName='text-3xl font-bold text-gray-900 w-full'
                                    />
                                    <InlineEditableText
                                        value={scenario.description ?? ''}
                                        name='description'
                                        placeholder='Click to add description...'
                                        as='p'
                                        className='text-gray-600 mt-1'
                                        inputClassName='text-gray-600 w-full'
                                    />
                                </>
                            )
                            : (
                                <>
                                    <h1 className='text-3xl font-bold text-gray-900'>{scenario.name}</h1>
                                    {scenario.description && (
                                        <p className='text-gray-600 mt-1'>{scenario.description}</p>
                                    )}
                                </>
                            )}
                    </div>
                </div>
            </header>

            <main className='max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8'>
                <DiagramSection resolvedConnections={resolvedConnections} />

                <section className='bg-white rounded-lg shadow p-6 mb-8'>
                    <h2 className='text-xl font-semibold text-gray-900 mb-4'>Connections</h2>

                    <ConnectionList
                        key={localNodes.map(ln => `${ln.id}:${ln.name}`).join(',')}
                        rows={connectionRows}
                        projectId={project.id}
                        groups={groups}
                        nodes={nodes}
                        localNodes={localNodes}
                        onDelete={canWrite ? handleDelete : undefined}
                        existingPlaceholders={existingPlaceholders}
                        locale={userLocale}
                        readOnly={!canWrite}
                    />

                    {canWrite && (
                        <AddConnectionForm
                            groups={groups}
                            nodes={nodes}
                            localNodes={localNodes}
                            existingPlaceholders={existingPlaceholders}
                            locale={userLocale}
                        />
                    )}
                </section>

                {canWrite && (
                    <LocalNodesPanel
                        localNodes={localNodes}
                        groups={groups}
                        projectId={project.id}
                        connections={scenario.connections.map(c => ({
                            sourceLocalNodeId: c.sourceLocalNode?.id,
                            targetLocalNodeId: c.targetLocalNode?.id,
                            value: c.value,
                            placeholderType: c.placeholderType as 'missing' | 'remaining' | null | undefined
                        }))}
                        nodeReferences={scenario.nodeReferences.map(nr => ({
                            connectingLocalNodeId: nr.connectingLocalNode?.id
                        }))}
                    />
                )}

                {canWrite && (
                    <section className='bg-white rounded-lg shadow p-6 border border-red-200'>
                        <h2 className='text-lg font-semibold text-red-600 mb-4'>Danger Zone</h2>
                        <Form method='post'>
                            <input type='hidden' name='intent' value='delete' />
                            <button
                                type='submit'
                                className='px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm'
                                onClick={e => {
                                    if (!confirm('Are you sure you want to delete this scenario?')) {
                                        e.preventDefault();
                                    }
                                }}
                            >
                                Delete Scenario
                            </button>
                        </Form>
                    </section>
                )}
            </main>
        </div>
    );
}
