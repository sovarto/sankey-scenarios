import { eq, and } from 'drizzle-orm';
import { useState } from 'react';
import { Form, Link, redirect } from 'react-router';
import type { Route } from './+types/edit';
import { database } from '~/database/context';
import * as schema from '~/database/schema';

export function meta({ data }: Route.MetaArgs) {
    return [ {
        title: data?.scenario ? `Edit ${data.scenario.name} - ${data.project.name}` : 'Edit Scenario'
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
            connections: true,
            groupReferences: {
                with: {
                    group: {
                        columns: { id: true, name: true }
                    }
                }
            },
            nodeReferences: {
                with: {
                    node: {
                        columns: { id: true, name: true, value: true }
                    }
                }
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

    return { project, scenario, groups, nodes };
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

    if (intent === 'delete') {
        await db.delete(schema.scenarios).where(eq(schema.scenarios.id, scenarioId));
        return redirect(`/projects/${projectId}`);
    }

    if (intent === 'update') {
        const name = formData.get('name');
        const description = formData.get('description');

        if (typeof name !== 'string' || !name.trim()) {
            return { error: 'Scenario name is required' };
        }

        await db.update(schema.scenarios).set({
            name: name.trim(),
            description: typeof description === 'string' ? description.trim() || null : null,
            updatedAt: new Date()
        }).where(eq(schema.scenarios.id, scenarioId));

        // Update project timestamp
        await db.update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, projectId));
    }

    if (intent === 'add-connection') {
        const source = formData.get('source');
        const target = formData.get('target');
        const value = formData.get('value');

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

        await db.insert(schema.connections).values({
            scenarioId,
            source: source.trim(),
            target: target.trim(),
            value: numValue
        });
    }

    if (intent === 'delete-connection') {
        const connectionId = formData.get('connectionId');
        if (typeof connectionId === 'string') {
            await db.delete(schema.connections).where(eq(schema.connections.id, parseInt(connectionId, 10)));
        }
    }

    if (intent === 'add-group-reference') {
        const groupId = formData.get('groupId');
        const connectingNode = formData.get('connectingNode');
        const direction = formData.get('direction');

        if (
            typeof groupId !== 'string'
            || typeof connectingNode !== 'string'
            || !connectingNode.trim()
            || typeof direction !== 'string'
        ) {
            return { error: 'Group, connecting node, and direction are required' };
        }

        await db.insert(schema.scenarioGroups).values({
            scenarioId,
            groupId: parseInt(groupId, 10),
            connectingNode: connectingNode.trim(),
            direction: direction as 'source' | 'target'
        });
    }

    if (intent === 'delete-group-reference') {
        const referenceId = formData.get('referenceId');
        if (typeof referenceId === 'string') {
            await db.delete(schema.scenarioGroups).where(eq(schema.scenarioGroups.id, parseInt(referenceId, 10)));
        }
    }

    if (intent === 'add-node-reference') {
        const nodeId = formData.get('nodeId');
        const connectingNode = formData.get('connectingNode');
        const direction = formData.get('direction');

        if (
            typeof nodeId !== 'string'
            || typeof connectingNode !== 'string'
            || !connectingNode.trim()
            || typeof direction !== 'string'
        ) {
            return { error: 'Node, connecting node, and direction are required' };
        }

        await db.insert(schema.scenarioNodes).values({
            scenarioId,
            nodeId: parseInt(nodeId, 10),
            connectingNode: connectingNode.trim(),
            direction: direction as 'source' | 'target'
        });
    }

    if (intent === 'delete-node-reference') {
        const referenceId = formData.get('referenceId');
        if (typeof referenceId === 'string') {
            await db.delete(schema.scenarioNodes).where(eq(schema.scenarioNodes.id, parseInt(referenceId, 10)));
        }
    }

    return { success: true };
}

export default function EditScenario({ loaderData, actionData }: Route.ComponentProps) {
    const { project, scenario, groups, nodes } = loaderData;
    const [ showAddConnection, setShowAddConnection ] = useState(false);
    const [ showAddGroupRef, setShowAddGroupRef ] = useState(false);
    const [ showAddNodeRef, setShowAddNodeRef ] = useState(false);

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <Link
                        to={`/projects/${project.id}/scenarios/${scenario.id}`}
                        className='text-sm text-gray-500 hover:text-gray-700'
                    >
                        ← Back to Scenario
                    </Link>
                    <h1 className='text-3xl font-bold text-gray-900 mt-2'>Edit Scenario</h1>
                </div>
            </header>

            <main className='max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8'>
                {actionData?.error && <div className='p-4 bg-red-50 text-red-700 rounded-md'>{actionData.error}</div>}

                {/* Basic Info */}
                <section className='bg-white rounded-lg shadow p-6'>
                    <h2 className='text-xl font-semibold text-gray-900 mb-4'>Basic Information</h2>
                    <Form method='post'>
                        <input type='hidden' name='intent' value='update' />
                        <div className='grid grid-cols-1 gap-4'>
                            <div>
                                <label htmlFor='name' className='block text-sm font-medium text-gray-700 mb-1'>
                                    Name *
                                </label>
                                <input
                                    type='text'
                                    id='name'
                                    name='name'
                                    required
                                    defaultValue={scenario.name}
                                    className='w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                />
                            </div>
                            <div>
                                <label htmlFor='description' className='block text-sm font-medium text-gray-700 mb-1'>
                                    Description
                                </label>
                                <textarea
                                    id='description'
                                    name='description'
                                    rows={2}
                                    defaultValue={scenario.description ?? ''}
                                    className='w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                />
                            </div>
                        </div>
                        <div className='mt-4 flex justify-end'>
                            <button
                                type='submit'
                                className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
                            >
                                Save Changes
                            </button>
                        </div>
                    </Form>
                </section>

                {/* Direct Connections */}
                <section className='bg-white rounded-lg shadow p-6'>
                    <div className='flex items-center justify-between mb-4'>
                        <h2 className='text-xl font-semibold text-gray-900'>Direct Connections</h2>
                        <button
                            type='button'
                            onClick={() => setShowAddConnection(!showAddConnection)}
                            className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm'
                        >
                            {showAddConnection ? 'Cancel' : 'Add Connection'}
                        </button>
                    </div>

                    {showAddConnection && (
                        <Form method='post' className='mb-6 p-4 bg-gray-50 rounded-md'>
                            <input type='hidden' name='intent' value='add-connection' />
                            <div className='grid grid-cols-3 gap-4'>
                                <div>
                                    <label className='block text-sm font-medium text-gray-700 mb-1'>Source</label>
                                    <input
                                        type='text'
                                        name='source'
                                        required
                                        placeholder='Budget'
                                        className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm'
                                    />
                                </div>
                                <div>
                                    <label className='block text-sm font-medium text-gray-700 mb-1'>Target</label>
                                    <input
                                        type='text'
                                        name='target'
                                        required
                                        placeholder='Transportation'
                                        className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm'
                                    />
                                </div>
                                <div>
                                    <label className='block text-sm font-medium text-gray-700 mb-1'>Value</label>
                                    <input
                                        type='number'
                                        name='value'
                                        required
                                        min='0.01'
                                        step='0.01'
                                        placeholder='255'
                                        className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm'
                                    />
                                </div>
                            </div>
                            <div className='mt-4 flex justify-end'>
                                <button
                                    type='submit'
                                    className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm'
                                >
                                    Add
                                </button>
                            </div>
                        </Form>
                    )}

                    {scenario.connections.length === 0
                        ? <p className='text-gray-500 text-sm'>No direct connections yet.</p>
                        : (
                            <div className='space-y-2'>
                                {scenario.connections.map(conn => (
                                    <div
                                        key={conn.id}
                                        className='flex items-center justify-between p-3 bg-gray-50 rounded-md'
                                    >
                                        <span className='text-gray-900'>
                                            {conn.source} → {conn.target}:{' '}
                                            <span className='font-medium'>{conn.value}</span>
                                        </span>
                                        <Form method='post'>
                                            <input type='hidden' name='intent' value='delete-connection' />
                                            <input type='hidden' name='connectionId' value={conn.id} />
                                            <button type='submit' className='text-red-600 hover:text-red-800 text-sm'>
                                                Remove
                                            </button>
                                        </Form>
                                    </div>
                                ))}
                            </div>
                        )}
                </section>

                {/* Group References */}
                <section className='bg-white rounded-lg shadow p-6'>
                    <div className='flex items-center justify-between mb-4'>
                        <h2 className='text-xl font-semibold text-gray-900'>Group References</h2>
                        <button
                            type='button'
                            onClick={() => setShowAddGroupRef(!showAddGroupRef)}
                            className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm'
                            disabled={groups.length === 0}
                        >
                            {showAddGroupRef ? 'Cancel' : 'Add Group Reference'}
                        </button>
                    </div>

                    {groups.length === 0 && (
                        <p className='text-gray-500 text-sm mb-4'>
                            No groups available.{' '}
                            <Link to='/groups/new' className='text-green-600 hover:text-green-800'>Create a group</Link>
                            {' '}
                            first.
                        </p>
                    )}

                    {showAddGroupRef && groups.length > 0 && (
                        <Form method='post' className='mb-6 p-4 bg-gray-50 rounded-md'>
                            <input type='hidden' name='intent' value='add-group-reference' />
                            <div className='grid grid-cols-3 gap-4'>
                                <div>
                                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                                        Connecting Node
                                    </label>
                                    <input
                                        type='text'
                                        name='connectingNode'
                                        required
                                        placeholder='Budget'
                                        className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm'
                                    />
                                </div>
                                <div>
                                    <label className='block text-sm font-medium text-gray-700 mb-1'>Direction</label>
                                    <select
                                        name='direction'
                                        required
                                        className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm'
                                    >
                                        <option value='source'>Node → Group (group defines targets)</option>
                                        <option value='target'>Group → Node (group defines sources)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className='block text-sm font-medium text-gray-700 mb-1'>Group</label>
                                    <select
                                        name='groupId'
                                        required
                                        className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm'
                                    >
                                        {groups.map(group => (
                                            <option key={group.id} value={group.id}>{group.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <p className='text-xs text-gray-500 mt-2'>
                                <strong>Node → Group:</strong>{' '}
                                e.g., "Budget → [Expenses]" where group items are targets.<br />
                                <strong>Group → Node:</strong>{' '}
                                e.g., "[Income Sources] → Total" where group items are sources.
                            </p>
                            <div className='mt-4 flex justify-end'>
                                <button
                                    type='submit'
                                    className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm'
                                >
                                    Add Reference
                                </button>
                            </div>
                        </Form>
                    )}

                    {scenario.groupReferences.length === 0
                        ? <p className='text-gray-500 text-sm'>No group references yet.</p>
                        : (
                            <div className='space-y-2'>
                                {scenario.groupReferences.map(ref => (
                                    <div
                                        key={ref.id}
                                        className='flex items-center justify-between p-3 bg-gray-50 rounded-md'
                                    >
                                        <span className='text-gray-900'>
                                            {ref.direction === 'source'
                                                ? (
                                                    <>
                                                        {ref.connectingNode} →{' '}
                                                        <Link
                                                            to={`/groups/${ref.group.id}`}
                                                            className='text-green-600 hover:text-green-800 font-medium'
                                                        >
                                                            [{ref.group.name}]
                                                        </Link>
                                                    </>
                                                )
                                                : (
                                                    <>
                                                        <Link
                                                            to={`/groups/${ref.group.id}`}
                                                            className='text-green-600 hover:text-green-800 font-medium'
                                                        >
                                                            [{ref.group.name}]
                                                        </Link>{' '}
                                                        → {ref.connectingNode}
                                                    </>
                                                )}
                                        </span>
                                        <Form method='post'>
                                            <input type='hidden' name='intent' value='delete-group-reference' />
                                            <input type='hidden' name='referenceId' value={ref.id} />
                                            <button type='submit' className='text-red-600 hover:text-red-800 text-sm'>
                                                Remove
                                            </button>
                                        </Form>
                                    </div>
                                ))}
                            </div>
                        )}
                </section>

                {/* Node References */}
                <section className='bg-white rounded-lg shadow p-6'>
                    <div className='flex items-center justify-between mb-4'>
                        <h2 className='text-xl font-semibold text-gray-900'>Node References</h2>
                        <button
                            type='button'
                            onClick={() => setShowAddNodeRef(!showAddNodeRef)}
                            className='px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm'
                            disabled={nodes.length === 0}
                        >
                            {showAddNodeRef ? 'Cancel' : 'Add Node Reference'}
                        </button>
                    </div>

                    {nodes.length === 0 && (
                        <p className='text-gray-500 text-sm mb-4'>
                            No nodes available.{' '}
                            <Link
                                to={`/projects/${project.id}/nodes/new`}
                                className='text-purple-600 hover:text-purple-800'
                            >
                                Create a node
                            </Link>{' '}
                            first.
                        </p>
                    )}

                    {showAddNodeRef && nodes.length > 0 && (
                        <Form method='post' className='mb-6 p-4 bg-gray-50 rounded-md'>
                            <input type='hidden' name='intent' value='add-node-reference' />
                            <div className='grid grid-cols-3 gap-4'>
                                <div>
                                    <label className='block text-sm font-medium text-gray-700 mb-1'>Node</label>
                                    <select
                                        name='nodeId'
                                        required
                                        className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm'
                                    >
                                        {nodes.map(node => (
                                            <option key={node.id} value={node.id}>{node.name} ({node.value})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                                        Connecting Node
                                    </label>
                                    <input
                                        type='text'
                                        name='connectingNode'
                                        required
                                        placeholder='Budget'
                                        className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm'
                                    />
                                </div>
                                <div>
                                    <label className='block text-sm font-medium text-gray-700 mb-1'>Direction</label>
                                    <select
                                        name='direction'
                                        required
                                        className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm'
                                    >
                                        <option value='source'>Node → Target (node is source)</option>
                                        <option value='target'>Source → Node (node is target)</option>
                                    </select>
                                </div>
                            </div>
                            <p className='text-xs text-gray-500 mt-2'>
                                <strong>Node → Target:</strong> The reusable node connects TO the connecting node.<br />
                                <strong>Source → Node:</strong> The connecting node connects TO the reusable node.
                            </p>
                            <div className='mt-4 flex justify-end'>
                                <button
                                    type='submit'
                                    className='px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm'
                                >
                                    Add Reference
                                </button>
                            </div>
                        </Form>
                    )}

                    {scenario.nodeReferences.length === 0
                        ? <p className='text-gray-500 text-sm'>No node references yet.</p>
                        : (
                            <div className='space-y-2'>
                                {scenario.nodeReferences.map(ref => (
                                    <div
                                        key={ref.id}
                                        className='flex items-center justify-between p-3 bg-gray-50 rounded-md'
                                    >
                                        <span className='text-gray-900'>
                                            {ref.direction === 'source'
                                                ? (
                                                    <>
                                                        <Link
                                                            to={`/projects/${project.id}/nodes/${ref.node.id}`}
                                                            className='text-purple-600 hover:text-purple-800 font-medium'
                                                        >
                                                            {ref.node.name}
                                                        </Link>{' '}
                                                        <span className='text-gray-500'>({ref.node.value})</span> →{' '}
                                                        {ref.connectingNode}
                                                    </>
                                                )
                                                : (
                                                    <>
                                                        {ref.connectingNode} →{' '}
                                                        <Link
                                                            to={`/projects/${project.id}/nodes/${ref.node.id}`}
                                                            className='text-purple-600 hover:text-purple-800 font-medium'
                                                        >
                                                            {ref.node.name}
                                                        </Link>{' '}
                                                        <span className='text-gray-500'>({ref.node.value})</span>
                                                    </>
                                                )}
                                        </span>
                                        <Form method='post'>
                                            <input type='hidden' name='intent' value='delete-node-reference' />
                                            <input type='hidden' name='referenceId' value={ref.id} />
                                            <button type='submit' className='text-red-600 hover:text-red-800 text-sm'>
                                                Remove
                                            </button>
                                        </Form>
                                    </div>
                                ))}
                            </div>
                        )}
                </section>

                {/* Delete Scenario */}
                <section className='bg-white rounded-lg shadow p-6 border border-red-200'>
                    <h2 className='text-xl font-semibold text-red-600 mb-4'>Danger Zone</h2>
                    <Form method='post'>
                        <input type='hidden' name='intent' value='delete' />
                        <button
                            type='submit'
                            className='px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors'
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
