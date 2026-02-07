import { eq, and } from 'drizzle-orm';
import { useState, useRef, useEffect, useMemo } from 'react';
import { Form, Link, useFetcher } from 'react-router';
import { SankeyDiagram } from '../../components/sankey';
import type { Route } from './+types/view';
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

function InlineEditableText({
    value,
    name,
    placeholder,
    className,
    inputClassName,
    as: Component = 'span',
}: {
    value: string;
    name: string;
    placeholder?: string;
    className?: string;
    inputClassName?: string;
    as?: 'span' | 'h1' | 'p';
}) {
    const [ isEditing, setIsEditing ] = useState(false);
    const [ text, setText ] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);
    const fetcher = useFetcher();

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [ isEditing ]);

    const handleBlur = () => {
        setIsEditing(false);
        if (text !== value) {
            void fetcher.submit(
                { intent: `update-${name}`, [name]: text },
                { method: 'post' }
            );
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleBlur();
        }
        if (e.key === 'Escape') {
            setText(value);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type='text'
                value={text}
                onChange={e => setText(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className={`bg-transparent border-b-2 border-blue-500 outline-none ${inputClassName}`}
            />
        );
    }

    return (
        <Component
            onClick={() => setIsEditing(true)}
            className={`cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 ${className}`}
            title='Click to edit'
        >
            {value || <span className='text-gray-400 italic'>{placeholder}</span>}
        </Component>
    );
}

type ConnectionRowType = 'direct' | 'node-ref' | 'group-ref';

interface ConnectionRowData {
    type: ConnectionRowType;
    id: number;
    source: string;
    target: string;
    sourceLocalNodeId?: number;
    targetLocalNodeId?: number;
    value: number;
    displayOrder: number;
    // For references
    refName?: string;
    refId?: number;
    direction?: 'source' | 'target';
    connectingLocalNodeId?: number;
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

function DiagramSection(
    { resolvedConnections }: { resolvedConnections: Array<{ source: string; target: string; value: number }> },
) {
    const [ isExpanded, setIsExpanded ] = useState(false);
    const [ height, setHeight ] = useState(500);
    const [ isResizing, setIsResizing ] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    };

    useEffect(() => {
        if (!isResizing) {
            return;
        }

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) {
                return;
            }
            const rect = containerRef.current.getBoundingClientRect();
            const newHeight = Math.max(200, Math.min(1200, e.clientY - rect.top));
            setHeight(newHeight);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [ isResizing ]);

    if (resolvedConnections.length === 0) {
        return (
            <section className='bg-white rounded-lg shadow p-6 mb-8'>
                <div className='bg-gray-100 rounded-lg h-64 flex items-center justify-center'>
                    <p className='text-gray-500'>No connections yet. Add connections below.</p>
                </div>
            </section>
        );
    }

    // When expanded, break out of the max-w-7xl container to use full viewport width
    const wrapperClasses = isExpanded ? 'relative -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 mb-8' : 'mb-8';

    return (
        <div
            className={wrapperClasses}
            style={isExpanded ? { width: 'calc(100vw - 2rem)', marginLeft: 'calc(-50vw + 50% + 1rem)' } : undefined}
        >
            <section className='bg-white rounded-lg shadow p-6 relative'>
                <div className='flex justify-end mb-2'>
                    <button
                        type='button'
                        onClick={() => setIsExpanded(!isExpanded)}
                        className='p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors'
                        title={isExpanded ? 'Collapse to normal width' : 'Expand to full width'}
                    >
                        {isExpanded
                            ? (
                                <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                    <path
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                        strokeWidth={2}
                                        d='M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25'
                                    />
                                </svg>
                            )
                            : (
                                <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                    <path
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                        strokeWidth={2}
                                        d='M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15'
                                    />
                                </svg>
                            )}
                    </button>
                </div>
                <div ref={containerRef} style={{ height }} className='relative'>
                    <SankeyDiagram
                        flows={resolvedConnections.map(conn => ({
                            source: conn.source,
                            target: conn.target,
                            value: conn.value
                        }))}
                        config={{
                            height,
                            nodeWidth: 10,
                            nodeHeightFactor: 50,
                            nodeSpacingFactor: 85,
                            flowCurvature: 0.5,
                            nodeOpacity: 0.9,
                            flowOpacity: 0.45,
                            flowColorMode: 'source',
                            margin: { top: 20, right: 150, bottom: 20, left: 150 },
                            labels: {
                                show: true,
                                showValues: true,
                                fontSize: 12,
                                highlightOpacity: 0.75
                            }
                        }}
                        className='w-full h-full'
                    />
                </div>
                {/* Resize handle */}
                <div
                    onMouseDown={handleMouseDown}
                    className={`absolute left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center ${
                        isResizing ? 'bg-blue-100' : 'hover:bg-gray-100'
                    }`}
                    style={{ bottom: 0 }}
                >
                    <div className='w-12 h-1 bg-gray-300 rounded-full' />
                </div>
            </section>
        </div>
    );
}

function ConnectionList({
    rows,
    projectId,
    onDelete,
}: {
    rows: ConnectionRowData[];
    projectId: number;
    onDelete: (row: ConnectionRowData) => void;
}) {
    const [ items, setItems ] = useState(rows);
    const [ draggedIndex, setDraggedIndex ] = useState<number | null>(null);
    const fetcher = useFetcher();

    // Create a stable key from the rows order to detect changes
    const rowsKey = rows.map(r => `${r.type}-${r.id}`).join(',');

    // Sync with props when they change
    useEffect(() => {
        setItems(rows);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ rowsKey ]);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) {
            return;
        }

        const newItems = [ ...items ];
        const [ draggedItem ] = newItems.splice(draggedIndex, 1);
        newItems.splice(index, 0, draggedItem);
        setItems(newItems);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        if (draggedIndex === null) {
            return;
        }
        setDraggedIndex(null);

        // Save new order
        const orderData = items.map((item, index) => ({
            type: item.type,
            id: item.id,
            order: index
        }));

        void fetcher.submit(
            { intent: 'reorder-connections', orderData: JSON.stringify(orderData) },
            { method: 'post' }
        );
    };

    if (items.length === 0) {
        return <p className='text-gray-500 mb-6'>No connections yet.</p>;
    }

    return (
        <div className='space-y-2 mb-6'>
            {items.map((row, index) => (
                <ConnectionRow
                    key={`${row.type}-${row.id}`}
                    row={row}
                    projectId={projectId}
                    onDelete={() => onDelete(row)}
                    isDragging={draggedIndex === index}
                    onDragStart={e => handleDragStart(e, index)}
                    onDragOver={e => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                />
            ))}
        </div>
    );
}

function ConnectionRow({
    row,
    projectId,
    onDelete,
    isDragging,
    onDragStart,
    onDragOver,
    onDragEnd,
}: {
    row: ConnectionRowData;
    projectId: number;
    onDelete: () => void;
    isDragging?: boolean;
    onDragStart?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDragEnd?: () => void;
}) {
    const getBadge = () => {
        if (row.type === 'direct') {
            return <span className='text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded'>Direct</span>;
        }
        if (row.type === 'group-ref') {
            return (
                <Link
                    to={`/projects/${projectId}/groups/${row.refId}`}
                    className='text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded hover:bg-green-200'
                >
                    Group
                </Link>
            );
        }
        return (
            <Link
                to={`/projects/${projectId}/nodes/${row.refId}`}
                className='text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded hover:bg-purple-200'
            >
                Node
            </Link>
        );
    };

    // Determine if source/target are editable local nodes
    const sourceIsLocalNode = row.type === 'direct'
        ? row.sourceLocalNodeId
        : (row.type === 'group-ref' && row.direction === 'source')
                || (row.type === 'node-ref' && row.direction === 'target')
        ? row.connectingLocalNodeId
        : undefined;

    const targetIsLocalNode = row.type === 'direct'
        ? row.targetLocalNodeId
        : (row.type === 'group-ref' && row.direction === 'target')
                || (row.type === 'node-ref' && row.direction === 'source')
        ? row.connectingLocalNodeId
        : undefined;

    const sourceDisplay = row.type === 'group-ref' && row.direction === 'target'
        ? (
            <Link
                to={`/projects/${projectId}/groups/${row.refId}`}
                className='text-green-600 hover:text-green-800 font-medium'
            >
                [{row.refName}]
            </Link>
        )
        : row.type === 'node-ref' && row.direction === 'source'
        ? (
            <Link
                to={`/projects/${projectId}/nodes/${row.refId}`}
                className='text-purple-600 hover:text-purple-800 font-medium'
            >
                {row.refName}
            </Link>
        )
        : sourceIsLocalNode
        ? <EditableLocalNode localNodeId={sourceIsLocalNode} name={row.source} />
        : <span>{row.source}</span>;

    const targetDisplay = row.type === 'group-ref' && row.direction === 'source'
        ? (
            <Link
                to={`/projects/${projectId}/groups/${row.refId}`}
                className='text-green-600 hover:text-green-800 font-medium'
            >
                [{row.refName}]
            </Link>
        )
        : row.type === 'node-ref' && row.direction === 'target'
        ? (
            <Link
                to={`/projects/${projectId}/nodes/${row.refId}`}
                className='text-purple-600 hover:text-purple-800 font-medium'
            >
                {row.refName}
            </Link>
        )
        : targetIsLocalNode
        ? <EditableLocalNode localNodeId={targetIsLocalNode} name={row.target} />
        : <span>{row.target}</span>;

    return (
        <div
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            className={`flex items-center gap-3 p-3 bg-gray-50 rounded-md group cursor-move transition-all ${
                isDragging ? 'opacity-50 shadow-lg' : ''
            }`}
        >
            {/* Drag handle */}
            <div className='text-gray-400 cursor-move'>
                <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                    <path d='M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z' />
                </svg>
            </div>
            <div className='flex-1 flex items-center gap-2'>
                <span className='font-medium text-gray-900'>{sourceDisplay}</span>
                <span className='text-gray-400'>→</span>
                <span className='font-medium text-gray-900'>{targetDisplay}</span>
            </div>
            {row.type !== 'group-ref' && (
                <span className='text-gray-600 font-mono text-sm w-20 text-right'>{row.value}</span>
            )}
            {getBadge()}
            <button
                type='button'
                onClick={onDelete}
                className='text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity'
                title='Remove'
            >
                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                </svg>
            </button>
        </div>
    );
}

function EditableLocalNode({ localNodeId, name }: { localNodeId: number; name: string }) {
    const [ isEditing, setIsEditing ] = useState(false);
    const [ editValue, setEditValue ] = useState(name);
    const fetcher = useFetcher();
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [ isEditing ]);

    useEffect(() => {
        if (fetcher.state === 'idle') {
            setIsEditing(false);
        }
    }, [ fetcher.state ]);

    useEffect(() => {
        setEditValue(name);
    }, [ name ]);

    const handleSave = () => {
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== name) {
            void fetcher.submit(
                {
                    intent: 'update-local-node',
                    localNodeId: localNodeId.toString(),
                    name: trimmed
                },
                { method: 'post' }
            );
        } else {
            setEditValue(name);
            setIsEditing(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            setEditValue(name);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type='text'
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                onClick={e => e.stopPropagation()}
                className='px-1 py-0.5 border border-blue-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-32'
                disabled={fetcher.state !== 'idle'}
            />
        );
    }

    return (
        <span
            onClick={e => {
                e.stopPropagation();
                setIsEditing(true);
            }}
            className='cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded transition-colors'
            title='Click to edit'
        >
            {name}
        </span>
    );
}

type ComboboxOption = {
    type: 'node' | 'group' | 'local';
    id?: number;
    name: string;
    value?: number;
    display: string;
};

function NodeCombobox({
    value,
    onChange,
    options,
    placeholder,
    disabled,
}: {
    value: ComboboxOption | null;
    onChange: (option: ComboboxOption | null) => void;
    options: ComboboxOption[];
    placeholder?: string;
    disabled?: boolean;
}) {
    const [ inputValue, setInputValue ] = useState(value?.name ?? '');
    const [ isOpen, setIsOpen ] = useState(false);
    const [ highlightedIndex, setHighlightedIndex ] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    // Filter options based on input
    const filteredOptions = useMemo(() => {
        const search = inputValue.toLowerCase();
        return options.filter(opt => opt.display.toLowerCase().includes(search));
    }, [ options, inputValue ]);

    // Group filtered options by type
    const groupedOptions = useMemo(() => {
        const nodeRefs = filteredOptions.filter(o => o.type === 'node');
        const groupRefs = filteredOptions.filter(o => o.type === 'group');
        const locals = filteredOptions.filter(o => o.type === 'local');
        return { nodeRefs, groupRefs, locals };
    }, [ filteredOptions ]);

    // Flat list for keyboard navigation
    const flatOptions = useMemo(
        () => [ ...groupedOptions.nodeRefs, ...groupedOptions.groupRefs, ...groupedOptions.locals ],
        [ groupedOptions ]
    );

    useEffect(() => {
        setHighlightedIndex(0);
    }, [ inputValue ]);

    // Sync input value when external value changes
    useEffect(() => {
        setInputValue(value?.name ?? '');
    }, [ value ]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        setIsOpen(true);

        // If typing new text, create a local option
        if (newValue.trim()) {
            const existingOption = options.find(
                o => o.name.toLowerCase() === newValue.toLowerCase()
            );
            if (existingOption) {
                onChange(existingOption);
            } else {
                onChange({
                    type: 'local',
                    name: newValue,
                    display: `Local: ${newValue}`
                });
            }
        } else {
            onChange(null);
        }
    };

    const handleSelect = (option: ComboboxOption) => {
        setInputValue(option.name);
        onChange(option);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                setIsOpen(true);
                e.preventDefault();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(i => Math.min(i + 1, flatOptions.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(i => Math.max(i - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (flatOptions[highlightedIndex]) {
                    handleSelect(flatOptions[highlightedIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                break;
        }
    };

    const handleBlur = () => {
        // Delay closing to allow click on option
        setTimeout(() => {
            if (!listRef.current?.contains(document.activeElement)) {
                setIsOpen(false);
            }
        }, 150);
    };

    return (
        <div className='relative'>
            <input
                ref={inputRef}
                type='text'
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => setIsOpen(true)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900'
            />
            {isOpen && flatOptions.length > 0 && (
                <ul
                    ref={listRef}
                    className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto'
                >
                    {groupedOptions.nodeRefs.length > 0 && (
                        <>
                            <li className='px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50'>
                                Node References
                            </li>
                            {groupedOptions.nodeRefs.map((opt, idx) => {
                                const flatIdx = idx;
                                return (
                                    <li
                                        key={`node-${opt.id}`}
                                        onClick={() => handleSelect(opt)}
                                        className={`px-3 py-2 cursor-pointer text-sm ${
                                            flatIdx === highlightedIndex
                                                ? 'bg-blue-100 text-blue-900'
                                                : 'text-gray-900 hover:bg-gray-100'
                                        }`}
                                    >
                                        <span className='text-purple-600'>{opt.name}</span>
                                        <span className='text-gray-400 ml-2'>({opt.value})</span>
                                    </li>
                                );
                            })}
                        </>
                    )}
                    {groupedOptions.groupRefs.length > 0 && (
                        <>
                            <li className='px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50'>
                                Group References
                            </li>
                            {groupedOptions.groupRefs.map((opt, idx) => {
                                const flatIdx = groupedOptions.nodeRefs.length + idx;
                                return (
                                    <li
                                        key={`group-${opt.id}`}
                                        onClick={() => handleSelect(opt)}
                                        className={`px-3 py-2 cursor-pointer text-sm ${
                                            flatIdx === highlightedIndex
                                                ? 'bg-blue-100 text-blue-900'
                                                : 'text-gray-900 hover:bg-gray-100'
                                        }`}
                                    >
                                        <span className='text-green-600'>[{opt.name}]</span>
                                    </li>
                                );
                            })}
                        </>
                    )}
                    {groupedOptions.locals.length > 0 && (
                        <>
                            <li className='px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50'>Local Nodes</li>
                            {groupedOptions.locals.map((opt, idx) => {
                                const flatIdx = groupedOptions.nodeRefs.length + groupedOptions.groupRefs.length + idx;
                                return (
                                    <li
                                        key={`local-${opt.name}`}
                                        onClick={() => handleSelect(opt)}
                                        className={`px-3 py-2 cursor-pointer text-sm ${
                                            flatIdx === highlightedIndex
                                                ? 'bg-blue-100 text-blue-900'
                                                : 'text-gray-900 hover:bg-gray-100'
                                        }`}
                                    >
                                        {opt.name}
                                    </li>
                                );
                            })}
                        </>
                    )}
                </ul>
            )}
        </div>
    );
}

function AddConnectionForm({
    groups,
    nodes,
    localNodes,
}: {
    groups: Array<{ id: number; name: string }>;
    nodes: Array<{ id: number; name: string; value: number }>;
    localNodes: Array<{ id: number; name: string }>;
}) {
    const [ source, setSource ] = useState<ComboboxOption | null>(null);
    const [ target, setTarget ] = useState<ComboboxOption | null>(null);
    const [ value, setValue ] = useState('');
    const fetcher = useFetcher();

    // Build options list
    const allOptions: ComboboxOption[] = useMemo(() => {
        const opts: ComboboxOption[] = [];

        // Node references
        for (const node of nodes) {
            opts.push({
                type: 'node',
                id: node.id,
                name: node.name,
                value: node.value,
                display: `Node: ${node.name}`
            });
        }

        // Group references
        for (const group of groups) {
            opts.push({
                type: 'group',
                id: group.id,
                name: group.name,
                display: `Group: ${group.name}`
            });
        }

        // Local nodes (from scenario's localNodes table)
        for (const localNode of localNodes) {
            // Don't duplicate if it matches a node reference
            if (!nodes.some(n => n.name === localNode.name)) {
                opts.push({
                    type: 'local',
                    name: localNode.name,
                    display: `Local: ${localNode.name}`
                });
            }
        }

        return opts;
    }, [ nodes, groups, localNodes ]);

    // If one side is a reference, the other must be local
    const sourceDisabled = target !== null && target.type !== 'local';
    const targetDisabled = source !== null && source.type !== 'local';

    // Filter options for each side based on the other's selection
    const sourceOptions = useMemo(() => {
        if (target && target.type !== 'local') {
            // Only allow local options when target is a reference
            return allOptions.filter(o => o.type === 'local');
        }
        return allOptions;
    }, [ allOptions, target ]);

    const targetOptions = useMemo(() => {
        if (source && source.type !== 'local') {
            // Only allow local options when source is a reference
            return allOptions.filter(o => o.type === 'local');
        }
        return allOptions;
    }, [ allOptions, source ]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!source || !target) {
            return;
        }

        const formData: Record<string, string> = {
            intent: 'add-connection',
            sourceType: source.type,
            targetType: target.type,
            source: source.name,
            target: target.name
        };

        if (source.type === 'node' && source.id) {
            formData.sourceRefId = source.id.toString();
        } else if (source.type === 'group' && source.id) {
            formData.sourceRefId = source.id.toString();
        }

        if (target.type === 'node' && target.id) {
            formData.targetRefId = target.id.toString();
        } else if (target.type === 'group' && target.id) {
            formData.targetRefId = target.id.toString();
        }

        // Value is only needed for direct connections
        if (source.type === 'local' && target.type === 'local') {
            formData.value = value;
        }

        void fetcher.submit(formData, { method: 'post' });

        // Reset form
        setSource(null);
        setTarget(null);
        setValue('');
    };

    const isValueHidden = (source?.type !== 'local') || (target?.type !== 'local');
    const isValid = source && target && (isValueHidden || (value && parseFloat(value) > 0));

    return (
        <div className='border-t pt-4'>
            <h3 className='text-sm font-medium text-gray-700 mb-3'>Add Connection</h3>
            <fetcher.Form onSubmit={handleSubmit} className='space-y-3'>
                <div className='grid grid-cols-[1fr,auto,1fr,auto,auto] gap-3 items-end'>
                    {/* Source */}
                    <div>
                        <label className='text-xs text-gray-500 block mb-1'>Source</label>
                        <NodeCombobox
                            value={source}
                            onChange={setSource}
                            options={sourceOptions}
                            placeholder='Type or select...'
                            disabled={sourceDisabled}
                        />
                    </div>

                    {/* Arrow */}
                    <span className='text-gray-400 text-xl pb-2'>→</span>

                    {/* Target */}
                    <div>
                        <label className='text-xs text-gray-500 block mb-1'>Target</label>
                        <NodeCombobox
                            value={target}
                            onChange={setTarget}
                            options={targetOptions}
                            placeholder='Type or select...'
                            disabled={targetDisabled}
                        />
                    </div>

                    {/* Value */}
                    <div className={isValueHidden ? 'opacity-30' : ''}>
                        <label className='text-xs text-gray-500 block mb-1'>Value</label>
                        <input
                            type='number'
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            placeholder='0'
                            min='0.01'
                            step='0.01'
                            required={!isValueHidden}
                            disabled={isValueHidden}
                            className='w-24 px-3 py-2 border border-gray-300 rounded-md text-sm'
                        />
                    </div>

                    {/* Submit */}
                    <button
                        type='submit'
                        disabled={!isValid}
                        className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                        Add
                    </button>
                </div>

                {isValueHidden && source && target && (
                    <p className='text-xs text-gray-500'>
                        Value comes from the referenced {source.type !== 'local' ? 'node/group' : 'node/group'}.
                    </p>
                )}
            </fetcher.Form>
        </div>
    );
}
