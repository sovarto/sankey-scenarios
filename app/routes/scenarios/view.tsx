import { eq, and } from 'drizzle-orm';
import { Link } from 'react-router';
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
            connections: true,
            groupReferences: {
                with: {
                    group: {
                        with: {
                            connections: true
                        }
                    }
                }
            },
            nodeReferences: {
                with: {
                    node: true
                }
            }
        }
    });

    if (!scenario) {
        throw new Response('Scenario not found', { status: 404 });
    }

    // Compute the resolved connections (direct + from groups + from nodes)
    const resolvedConnections: Array<{
        source: string;
        target: string;
        value: number;
        fromGroup?: string;
        fromNode?: string;
    }> = [];

    // Add direct connections
    for (const conn of scenario.connections) {
        resolvedConnections.push({
            source: conn.source,
            target: conn.target,
            value: conn.value
        });
    }

    // Add connections from groups based on direction
    for (const groupRef of scenario.groupReferences) {
        for (const conn of groupRef.group.connections) {
            if (groupRef.direction === 'source') {
                // connectingNode is the source, group nodes are targets
                resolvedConnections.push({
                    source: groupRef.connectingNode,
                    target: conn.target,
                    value: conn.value,
                    fromGroup: groupRef.group.name
                });
            } else {
                // group nodes are sources, connectingNode is the target
                resolvedConnections.push({
                    source: conn.source,
                    target: groupRef.connectingNode,
                    value: conn.value,
                    fromGroup: groupRef.group.name
                });
            }
        }
    }

    // Add connections from nodes based on direction
    for (const nodeRef of scenario.nodeReferences) {
        if (nodeRef.direction === 'source') {
            // node is the source, connectingNode is the target
            resolvedConnections.push({
                source: nodeRef.node.name,
                target: nodeRef.connectingNode,
                value: nodeRef.node.value,
                fromNode: nodeRef.node.name
            });
        } else {
            // connectingNode is the source, node is the target
            resolvedConnections.push({
                source: nodeRef.connectingNode,
                target: nodeRef.node.name,
                value: nodeRef.node.value,
                fromNode: nodeRef.node.name
            });
        }
    }

    return { project, scenario, resolvedConnections };
}

export default function ViewScenario({ loaderData }: Route.ComponentProps) {
    const { project, scenario, resolvedConnections } = loaderData;

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <Link to={`/projects/${project.id}`} className='text-sm text-gray-500 hover:text-gray-700'>
                        ← Back to {project.name}
                    </Link>
                    <div className='flex items-center justify-between mt-2'>
                        <div>
                            <h1 className='text-3xl font-bold text-gray-900'>{scenario.name}</h1>
                            {scenario.description && <p className='text-gray-600 mt-1'>{scenario.description}</p>}
                        </div>
                        <Link
                            to={`/projects/${project.id}/scenarios/${scenario.id}/edit`}
                            className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
                        >
                            Edit Scenario
                        </Link>
                    </div>
                </div>
            </header>

            <main className='max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8'>
                {/* Diagram Preview Placeholder - Full Width */}
                <section className='bg-white rounded-lg shadow p-6 mb-8'>
                    <h2 className='text-xl font-semibold text-gray-900 mb-4'>Diagram Preview</h2>
                    <div className='bg-gray-100 rounded-lg h-96 flex items-center justify-center'>
                        <p className='text-gray-500'>Sankey diagram visualization coming soon...</p>
                    </div>
                </section>

                <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
                    {/* Resolved Connections */}
                    <section className='bg-white rounded-lg shadow p-6'>
                        <h2 className='text-xl font-semibold text-gray-900 mb-4'>Resolved Connections</h2>
                        {resolvedConnections.length === 0
                            ? (
                                <p className='text-gray-500'>
                                    No connections yet. Edit this scenario to add connections.
                                </p>
                            )
                            : (
                                <div className='overflow-x-auto'>
                                    <table className='min-w-full'>
                                        <thead>
                                            <tr className='border-b'>
                                                <th className='text-left py-2 text-sm font-medium text-gray-500'>
                                                    Source
                                                </th>
                                                <th className='text-left py-2 text-sm font-medium text-gray-500'>
                                                    Target
                                                </th>
                                                <th className='text-right py-2 text-sm font-medium text-gray-500'>
                                                    Value
                                                </th>
                                                <th className='text-left py-2 text-sm font-medium text-gray-500'>
                                                    From
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {resolvedConnections.map((conn, idx) => (
                                                <tr key={idx} className='border-b'>
                                                    <td className='py-2 text-gray-900'>{conn.source}</td>
                                                    <td className='py-2 text-gray-900'>{conn.target}</td>
                                                    <td className='py-2 text-right text-gray-900'>{conn.value}</td>
                                                    <td className='py-2'>
                                                        {conn.fromGroup
                                                            ? (
                                                                <span className='inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700'>
                                                                    {conn.fromGroup}
                                                                </span>
                                                            )
                                                            : conn.fromNode
                                                            ? (
                                                                <span className='inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700'>
                                                                    {conn.fromNode}
                                                                </span>
                                                            )
                                                            : <span className='text-gray-400 text-sm'>Direct</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                    </section>

                    {/* Configuration */}
                    <section className='bg-white rounded-lg shadow p-6'>
                        <h2 className='text-xl font-semibold text-gray-900 mb-4'>Configuration</h2>
                        <div className='space-y-6'>
                            <div>
                                <h3 className='text-sm font-medium text-gray-700 mb-2'>
                                    Direct Connections ({scenario.connections.length})
                                </h3>
                                {scenario.connections.length === 0
                                    ? <p className='text-gray-400 text-sm'>None</p>
                                    : (
                                        <ul className='space-y-1 text-sm'>
                                            {scenario.connections.map(conn => (
                                                <li key={conn.id} className='text-gray-600'>
                                                    {conn.source} → {conn.target}: {conn.value}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                            </div>
                            <div>
                                <h3 className='text-sm font-medium text-gray-700 mb-2'>
                                    Group References ({scenario.groupReferences.length})
                                </h3>
                                {scenario.groupReferences.length === 0
                                    ? <p className='text-gray-400 text-sm'>None</p>
                                    : (
                                        <ul className='space-y-1 text-sm'>
                                            {scenario.groupReferences.map(ref => (
                                                <li key={ref.id} className='text-gray-600'>
                                                    {ref.direction === 'source'
                                                        ? (
                                                            <>
                                                                {ref.connectingNode} →{' '}
                                                                <Link
                                                                    to={`/groups/${ref.group.id}`}
                                                                    className='text-green-600 hover:text-green-800'
                                                                >
                                                                    [{ref.group.name}]
                                                                </Link>
                                                            </>
                                                        )
                                                        : (
                                                            <>
                                                                <Link
                                                                    to={`/groups/${ref.group.id}`}
                                                                    className='text-green-600 hover:text-green-800'
                                                                >
                                                                    [{ref.group.name}]
                                                                </Link>{' '}
                                                                → {ref.connectingNode}
                                                            </>
                                                        )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                            </div>
                            <div>
                                <h3 className='text-sm font-medium text-gray-700 mb-2'>
                                    Node References ({scenario.nodeReferences.length})
                                </h3>
                                {scenario.nodeReferences.length === 0
                                    ? <p className='text-gray-400 text-sm'>None</p>
                                    : (
                                        <ul className='space-y-1 text-sm'>
                                            {scenario.nodeReferences.map(ref => (
                                                <li key={ref.id} className='text-gray-600'>
                                                    {ref.direction === 'source'
                                                        ? (
                                                            <>
                                                                <Link
                                                                    to={`/projects/${project.id}/nodes/${ref.node.id}`}
                                                                    className='text-purple-600 hover:text-purple-800'
                                                                >
                                                                    {ref.node.name}
                                                                </Link>{' '}
                                                                ({ref.node.value}) → {ref.connectingNode}
                                                            </>
                                                        )
                                                        : (
                                                            <>
                                                                {ref.connectingNode} →{' '}
                                                                <Link
                                                                    to={`/projects/${project.id}/nodes/${ref.node.id}`}
                                                                    className='text-purple-600 hover:text-purple-800'
                                                                >
                                                                    {ref.node.name}
                                                                </Link>{' '}
                                                                ({ref.node.value})
                                                            </>
                                                        )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
