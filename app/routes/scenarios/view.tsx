import { eq, and } from 'drizzle-orm';
import { Form, Link, useFetcher } from 'react-router';
import type { Route } from './+types/view';
import { AddConnectionForm, ConnectionList, DiagramSection, InlineEditableText } from './components';
import type { ConnectionRowData } from './components/types';
import { database } from '~/database/context';
import * as schema from '~/database/schema';

export function meta({ data }: Route.MetaArgs) {
    return [ {
        title: data?.scenario ? `${data.scenario.name} - ${data.project.name}` : 'Scenario Not Found'
    } ];
}

export async function loader({ params }: Route.LoaderArgs) {
    const db = database();
    const projectId = parseInt(params.projectId, 10);
    const scenarioId = parseInt(params.scenarioId, 10);

    if (isNaN(projectId) || isNaN(scenarioId)) {
        throw new Response('Invalid IDs', { status: 400 });
    }

    const project = await db.query.projects.findFirst({
        where: eq(schema.projects.id, projectId),
        columns: { id: true, name: true }
    });

    if (!project) {
        throw new Response('Project not found', { status: 404 });
    }

    const scenario = await db.query.scenarios.findFirst({
        where: and(
            eq(schema.scenarios.id, scenarioId),
            eq(schema.scenarios.projectId, projectId)
        ),
        with: {
            localNodes: true,
            connections: {
                with: {
                    sourceLocalNode: true,
                    targetLocalNode: true
                },
                orderBy: (connections, { asc }) => [ asc(connections.displayOrder) ]
            },
            groupReferences: {
                with: {
                    group: {
                        with: {
                            connections: true
                        }
                    },
                    connectingLocalNode: true
                },
                orderBy: (groupReferences, { asc }) => [ asc(groupReferences.displayOrder) ]
            },
            nodeReferences: {
                with: {
                    node: true,
                    connectingLocalNode: true
                },
                orderBy: (nodeReferences, { asc }) => [ asc(nodeReferences.displayOrder) ]
            }
        }
    });

    if (!scenario) {
        throw new Response('Scenario not found', { status: 404 });
    }

    // Get all available groups for this project
    const groups = await db.query.groups.findMany({
        where: eq(schema.groups.projectId, projectId),
        columns: { id: true, name: true },
        orderBy: (groups, { asc }) => [ asc(groups.name) ]
    });

    // Get all available nodes for this project
    const nodes = await db.query.nodes.findMany({
        where: eq(schema.nodes.projectId, projectId),
        columns: { id: true, name: true, value: true },
        orderBy: (nodes, { asc }) => [ asc(nodes.name) ]
    });

    // Build a unified ordered list of all connection sources
    type ConnectionSource = { type: 'direct'; data: typeof scenario.connections[number] } | {
        type: 'group';
        data: typeof scenario.groupReferences[number];
    } | { type: 'node'; data: typeof scenario.nodeReferences[number] };

    const allConnectionSources: ConnectionSource[] = [
        ...scenario.connections.map(c => ({ type: 'direct' as const, data: c })),
        ...scenario.groupReferences.map(g => ({ type: 'group' as const, data: g })),
        ...scenario.nodeReferences.map(n => ({ type: 'node' as const, data: n })),
    ].sort((a, b) => {
        const orderA = a.type === 'direct'
            ? a.data.displayOrder
            : a.type === 'group'
            ? a.data.displayOrder
            : a.data.displayOrder;
        const orderB = b.type === 'direct'
            ? b.data.displayOrder
            : b.type === 'group'
            ? b.data.displayOrder
            : b.data.displayOrder;
        return orderA - orderB;
    });

    // Compute the resolved connections in order
    const resolvedConnections: Array<{
        source: string;
        target: string;
        value: number;
        fromGroup?: string;
        fromNode?: string;
    }> = [];

    for (const item of allConnectionSources) {
        if (item.type === 'direct') {
            const conn = item.data;
            const sourceName = conn.sourceLocalNode?.name ?? conn.source ?? '';
            const targetName = conn.targetLocalNode?.name ?? conn.target ?? '';
            resolvedConnections.push({
                source: sourceName,
                target: targetName,
                value: conn.value
            });
        } else if (item.type === 'group') {
            const groupRef = item.data;
            const connectingNodeName = groupRef.connectingLocalNode.name;
            for (const conn of groupRef.group.connections) {
                if (groupRef.direction === 'source') {
                    resolvedConnections.push({
                        source: connectingNodeName,
                        target: conn.target ?? '',
                        value: conn.value,
                        fromGroup: groupRef.group.name
                    });
                } else {
                    resolvedConnections.push({
                        source: conn.source ?? '',
                        target: connectingNodeName,
                        value: conn.value,
                        fromGroup: groupRef.group.name
                    });
                }
            }
        } else {
            const nodeRef = item.data;
            const connectingNodeName = nodeRef.connectingLocalNode.name;
            if (nodeRef.direction === 'source') {
                resolvedConnections.push({
                    source: nodeRef.node.name,
                    target: connectingNodeName,
                    value: nodeRef.node.value,
                    fromNode: nodeRef.node.name
                });
            } else {
                resolvedConnections.push({
                    source: connectingNodeName,
                    target: nodeRef.node.name,
                    value: nodeRef.node.value,
                    fromNode: nodeRef.node.name
                });
            }
        }
    }

    return { project, scenario, resolvedConnections, groups, nodes };
}

export async function action({ request, params }: Route.ActionArgs) {
    const formData = await request.formData();
    const intent = formData.get('intent');
    const projectId = parseInt(params.projectId, 10);
    const scenarioId = parseInt(params.scenarioId, 10);

    if (isNaN(projectId) || isNaN(scenarioId)) {
        throw new Response('Invalid IDs', { status: 400 });
    }

    const db = database();

    if (intent === 'update-name') {
        const name = formData.get('name');
        if (typeof name !== 'string' || !name.trim()) {
            return { error: 'Scenario name is required' };
        }
        await db.update(schema.scenarios).set({
            name: name.trim(),
            updatedAt: new Date()
        }).where(eq(schema.scenarios.id, scenarioId));
        await db.update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, projectId));
    }

    if (intent === 'update-description') {
        const description = formData.get('description');
        await db.update(schema.scenarios).set({
            description: typeof description === 'string' ? description.trim() || null : null,
            updatedAt: new Date()
        }).where(eq(schema.scenarios.id, scenarioId));
        await db.update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, projectId));
    }

    if (intent === 'add-connection') {
        const source = formData.get('source');
        const target = formData.get('target');
        const value = formData.get('value');
        const sourceType = formData.get('sourceType');
        const targetType = formData.get('targetType');
        const sourceRefId = formData.get('sourceRefId');
        const targetRefId = formData.get('targetRefId');

        // Helper to get or create a local node
        const getOrCreateLocalNode = async (name: string): Promise<number> => {
            const existing = await db.query.scenarioLocalNodes.findFirst({
                where: and(
                    eq(schema.scenarioLocalNodes.scenarioId, scenarioId),
                    eq(schema.scenarioLocalNodes.name, name.trim())
                )
            });
            if (existing) {
                return existing.id;
            }

            const [ newNode ] = await db.insert(schema.scenarioLocalNodes).values({
                scenarioId,
                name: name.trim()
            }).returning({ id: schema.scenarioLocalNodes.id });
            return newNode.id;
        };

        // Handle node/group references
        if (sourceType === 'node' && sourceRefId) {
            const nodeId = parseInt(sourceRefId as string, 10);
            const connectingLocalNodeId = await getOrCreateLocalNode(target as string);
            await db.insert(schema.scenarioNodes).values({
                scenarioId,
                nodeId,
                connectingLocalNodeId,
                direction: 'source'
            });
            return { success: true };
        }

        if (targetType === 'node' && targetRefId) {
            const nodeId = parseInt(targetRefId as string, 10);
            const connectingLocalNodeId = await getOrCreateLocalNode(source as string);
            await db.insert(schema.scenarioNodes).values({
                scenarioId,
                nodeId,
                connectingLocalNodeId,
                direction: 'target'
            });
            return { success: true };
        }

        if (sourceType === 'group' && sourceRefId) {
            const groupId = parseInt(sourceRefId as string, 10);
            const connectingLocalNodeId = await getOrCreateLocalNode(target as string);
            await db.insert(schema.scenarioGroups).values({
                scenarioId,
                groupId,
                connectingLocalNodeId,
                direction: 'target' // group items flow TO target
            });
            return { success: true };
        }

        if (targetType === 'group' && targetRefId) {
            const groupId = parseInt(targetRefId as string, 10);
            const connectingLocalNodeId = await getOrCreateLocalNode(source as string);
            await db.insert(schema.scenarioGroups).values({
                scenarioId,
                groupId,
                connectingLocalNodeId,
                direction: 'source' // source flows TO group items
            });
            return { success: true };
        }

        // Direct connection
        if (
            typeof source !== 'string'
            || !source.trim()
            || typeof target !== 'string'
            || !target.trim()
            || typeof value !== 'string'
        ) {
            return { error: 'All connection fields are required' };
        }

        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue <= 0) {
            return { error: 'Value must be a positive number' };
        }

        const sourceLocalNodeId = await getOrCreateLocalNode(source);
        const targetLocalNodeId = await getOrCreateLocalNode(target);

        await db.insert(schema.connections).values({
            scenarioId,
            sourceLocalNodeId,
            targetLocalNodeId,
            value: numValue
        });
    }

    if (intent === 'update-local-node') {
        const localNodeId = formData.get('localNodeId');
        const newName = formData.get('name');

        if (typeof localNodeId !== 'string' || typeof newName !== 'string' || !newName.trim()) {
            return { error: 'Local node ID and new name are required' };
        }

        // Check if name already exists for this scenario
        const existing = await db.query.scenarioLocalNodes.findFirst({
            where: and(
                eq(schema.scenarioLocalNodes.scenarioId, scenarioId),
                eq(schema.scenarioLocalNodes.name, newName.trim())
            )
        });

        if (existing && existing.id !== parseInt(localNodeId, 10)) {
            return { error: 'A local node with this name already exists' };
        }

        await db.update(schema.scenarioLocalNodes).set({
            name: newName.trim()
        }).where(eq(schema.scenarioLocalNodes.id, parseInt(localNodeId, 10)));

        return { success: true };
    }

    if (intent === 'delete-connection') {
        const connectionId = formData.get('connectionId');
        if (typeof connectionId === 'string') {
            await db.delete(schema.connections).where(eq(schema.connections.id, parseInt(connectionId, 10)));
        }
    }

    if (intent === 'delete-group-reference') {
        const referenceId = formData.get('referenceId');
        if (typeof referenceId === 'string') {
            await db.delete(schema.scenarioGroups).where(eq(schema.scenarioGroups.id, parseInt(referenceId, 10)));
        }
    }

    if (intent === 'delete-node-reference') {
        const referenceId = formData.get('referenceId');
        if (typeof referenceId === 'string') {
            await db.delete(schema.scenarioNodes).where(eq(schema.scenarioNodes.id, parseInt(referenceId, 10)));
        }
    }

    if (intent === 'delete') {
        await db.delete(schema.scenarios).where(eq(schema.scenarios.id, scenarioId));
        return { redirect: `/projects/${projectId}` };
    }

    if (intent === 'reorder-connections') {
        const orderData = formData.get('orderData');
        if (typeof orderData !== 'string') {
            return { error: 'Order data is required' };
        }

        try {
            const items: Array<{ type: string; id: number; order: number }> = JSON.parse(orderData);

            for (const item of items) {
                if (item.type === 'direct') {
                    await db.update(schema.connections).set({ displayOrder: item.order }).where(
                        eq(schema.connections.id, item.id)
                    );
                } else if (item.type === 'group-ref') {
                    await db.update(schema.scenarioGroups).set({ displayOrder: item.order }).where(
                        eq(schema.scenarioGroups.id, item.id)
                    );
                } else if (item.type === 'node-ref') {
                    await db.update(schema.scenarioNodes).set({ displayOrder: item.order }).where(
                        eq(schema.scenarioNodes.id, item.id)
                    );
                }
            }

            return { success: true };
        } catch {
            return { error: 'Invalid order data' };
        }
    }

    return { success: true };
}

export default function ViewScenario({ loaderData, actionData }: Route.ComponentProps) {
    const { project, scenario, resolvedConnections, groups, nodes } = loaderData;
    const fetcher = useFetcher();

    // Build unified connection list with display order
    const connectionRows: ConnectionRowData[] = [
        // Direct connections
        ...scenario.connections.map(conn => ({
            type: 'direct' as const,
            id: conn.id,
            source: conn.sourceLocalNode?.name ?? conn.source ?? '',
            target: conn.targetLocalNode?.name ?? conn.target ?? '',
            sourceLocalNodeId: conn.sourceLocalNode?.id,
            targetLocalNodeId: conn.targetLocalNode?.id,
            value: conn.value,
            displayOrder: conn.displayOrder
        })),
        // Group references
        ...scenario.groupReferences.map(ref => ({
            type: 'group-ref' as const,
            id: ref.id,
            source: ref.direction === 'target' ? `[${ref.group.name}]` : ref.connectingLocalNode.name,
            target: ref.direction === 'source' ? `[${ref.group.name}]` : ref.connectingLocalNode.name,
            value: 0, // Groups have multiple values
            displayOrder: ref.displayOrder,
            refName: ref.group.name,
            refId: ref.group.id,
            direction: ref.direction as 'source' | 'target',
            connectingLocalNodeId: ref.connectingLocalNode.id
        })),
        // Node references
        ...scenario.nodeReferences.map(ref => ({
            type: 'node-ref' as const,
            id: ref.id,
            source: ref.direction === 'source' ? ref.node.name : ref.connectingLocalNode.name,
            target: ref.direction === 'target' ? ref.node.name : ref.connectingLocalNode.name,
            value: ref.node.value,
            displayOrder: ref.displayOrder,
            refName: ref.node.name,
            refId: ref.node.id,
            direction: ref.direction as 'source' | 'target',
            connectingLocalNodeId: ref.connectingLocalNode.id
        })),
    ].sort((a, b) => a.displayOrder - b.displayOrder);

    // Local nodes for editing
    const localNodes = scenario.localNodes;

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

    // Redirect after delete
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
                {/* Sankey Diagram */}
                <DiagramSection resolvedConnections={resolvedConnections} />

                {/* Connections */}
                <section className='bg-white rounded-lg shadow p-6 mb-8'>
                    <h2 className='text-xl font-semibold text-gray-900 mb-4'>Connections</h2>

                    {/* Connection List */}
                    <ConnectionList rows={connectionRows} projectId={project.id} onDelete={handleDelete} />

                    {/* Add New Connection */}
                    <AddConnectionForm groups={groups} nodes={nodes} localNodes={localNodes} />
                </section>

                {/* Danger Zone */}
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
