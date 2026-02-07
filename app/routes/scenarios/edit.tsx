import { Form, Link, useFetcher, useLoaderData, useActionData } from 'react-router';
import type { Route } from './+types/edit';
import { AddConnectionForm, ConnectionList, DiagramSection, InlineEditableText, LocalNodesPanel } from './components';
import type { ConnectionRowData } from './components/types';
import { handleUpdateName, handleUpdateDescription, handleDeleteScenario, handleAddConnection, handleDeleteConnection, handleUpdateConnectionValue, handleUpdateConnectionPlaceholderType, handleUpdateConnectionAutoValue, handleUpdateConnectionSource, handleUpdateConnectionTarget, handleDeleteGroupReference, handleDeleteNodeReference, handleUpdateGroupRefShowNode, handleUpdateLocalNode, handleReorderConnections, handlePromoteToProjectNode, handleAddLocalNodesToGroup, handleAddLocalNodesToNewGroup } from './edit/actions.server';
import { loadScenarioView } from './edit/loader.server';
import { database } from '~/database/context';
import { requireProjectOwnership, parseProjectId } from '~/utils/project-ownership.server';

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

    const { user } = await requireProjectOwnership(request, projectId);
    const data = await loadScenarioView(projectId, scenarioId, user.id);
    return { ...data, userLocale: user.regionalLocale };
}

export async function action({ request, params }: Route.ActionArgs) {
    const projectId = parseProjectId(params.projectId);
    const scenarioId = parseInt(params.scenarioId, 10);

    if (isNaN(scenarioId)) {
        throw new Response('Invalid scenario ID', { status: 400 });
    }

    await requireProjectOwnership(request, projectId);

    const formData = await request.formData();
    const intent = formData.get('intent');

    const db = database();
    const ctx = { db, projectId, scenarioId, formData };

    switch (intent) {
        case 'update-name':
            return handleUpdateName(ctx);
        case 'update-description':
            return handleUpdateDescription(ctx);
        case 'delete':
            return handleDeleteScenario(ctx);
        case 'add-connection':
            return handleAddConnection(ctx);
        case 'delete-connection':
            return handleDeleteConnection(ctx);
        case 'update-connection-value':
            return handleUpdateConnectionValue(ctx);
        case 'update-connection-placeholder-type':
            return handleUpdateConnectionPlaceholderType(ctx);
        case 'update-connection-auto-value':
            return handleUpdateConnectionAutoValue(ctx);
        case 'update-connection-source':
            return handleUpdateConnectionSource(ctx);
        case 'update-connection-target':
            return handleUpdateConnectionTarget(ctx);
        case 'delete-group-reference':
            return handleDeleteGroupReference(ctx);
        case 'delete-node-reference':
            return handleDeleteNodeReference(ctx);
        case 'update-group-ref-show-node':
            return handleUpdateGroupRefShowNode(ctx);
        case 'update-local-node':
            return handleUpdateLocalNode(ctx);
        case 'reorder-connections':
            return handleReorderConnections(ctx);
        case 'promote-to-project-node':
            return handlePromoteToProjectNode(ctx);
        case 'add-local-nodes-to-group':
            return handleAddLocalNodesToGroup(ctx);
        case 'add-local-nodes-to-new-group':
            return handleAddLocalNodesToNewGroup(ctx);
        default:
            return { success: true };
    }
}

export default function ViewScenario({}: Route.ComponentProps) {
    const loaderData = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const { project, scenario, resolvedConnections, groups, nodes, existingPlaceholders, userLocale } = loaderData;
    const fetcher = useFetcher();

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
            displayOrder: conn.displayOrder,
            placeholderType: conn.placeholderType as 'missing' | 'remaining' | null | undefined,
            autoValue: conn.autoValue === 1
        })),
        ...scenario.groupReferences.map(ref => ({
            type: 'group-ref' as const,
            id: ref.id,
            source: ref.direction === 'target' ? `[${ref.group.name}]` : getLocalNodeName(ref.connectingLocalNode.id),
            target: ref.direction === 'source' ? `[${ref.group.name}]` : getLocalNodeName(ref.connectingLocalNode.id),
            value: 0,
            displayOrder: ref.displayOrder,
            refName: ref.group.name,
            refId: ref.group.id,
            direction: ref.direction as 'source' | 'target',
            connectingLocalNodeId: ref.connectingLocalNode.id,
            showGroupNode: ref.showGroupNode === 1
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

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <Link to={`/projects/${project.id}`} className='text-sm text-gray-500 hover:text-gray-700'>
                        ← Back to {project.name}
                    </Link>
                    <div className='mt-2'>
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
                        onDelete={handleDelete}
                        existingPlaceholders={existingPlaceholders}
                        locale={userLocale}
                    />

                    <AddConnectionForm
                        groups={groups}
                        nodes={nodes}
                        localNodes={localNodes}
                        existingPlaceholders={existingPlaceholders}
                        locale={userLocale}
                    />
                </section>

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
            </main>
        </div>
    );
}
