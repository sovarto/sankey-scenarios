import { and, eq } from 'drizzle-orm';
import { Link } from 'react-router';
import type { Route } from './+types/view';
import { database } from '~/database/context';
import * as schema from '~/database/schema';

export function meta({ data }: Route.MetaArgs) {
    return [ { title: data?.group ? `${data.group.name} - ${data.project.name}` : 'Group Not Found' } ];
}

export async function loader({ params }: Route.LoaderArgs) {
    const db = database();
    const projectId = parseInt(params.projectId, 10);
    const groupId = parseInt(params.groupId, 10);

    if (isNaN(projectId) || isNaN(groupId)) {
        throw new Response('Invalid ID', { status: 400 });
    }

    const project = await db.query.projects.findFirst({
        where: eq(schema.projects.id, projectId),
        columns: { id: true, name: true }
    });

    if (!project) {
        throw new Response('Project not found', { status: 404 });
    }

    const group = await db.query.groups.findFirst({
        where: and(eq(schema.groups.id, groupId), eq(schema.groups.projectId, projectId)),
        with: {
            connections: true,
            scenarioReferences: {
                with: {
                    scenario: {
                        columns: { id: true, name: true }
                    }
                }
            }
        }
    });

    if (!group) {
        throw new Response('Group not found', { status: 404 });
    }

    return { project, group };
}

export default function ViewGroup({ loaderData }: Route.ComponentProps) {
    const { project, group } = loaderData;

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <Link to={`/projects/${project.id}/groups`} className='text-sm text-gray-500 hover:text-gray-700'>
                        ← Back to Groups
                    </Link>
                    <div className='flex items-center justify-between mt-2'>
                        <div>
                            <h1 className='text-3xl font-bold text-gray-900'>{group.name}</h1>
                            {group.description && <p className='text-gray-600 mt-1'>{group.description}</p>}
                            <p className='text-sm text-gray-500'>in {project.name}</p>
                        </div>
                        <Link
                            to={`/projects/${project.id}/groups/${group.id}/edit`}
                            className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors'
                        >
                            Edit Group
                        </Link>
                    </div>
                </div>
            </header>

            <main className='max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8'>
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
                    {/* Connections */}
                    <section className='bg-white rounded-lg shadow p-6'>
                        <h2 className='text-xl font-semibold text-gray-900 mb-4'>
                            Connections ({group.connections.length})
                        </h2>
                        <p className='text-gray-600 text-sm mb-4'>
                            These connections can be used as either sources or targets depending on how the group is
                            referenced in a scenario.
                        </p>
                        {group.connections.length === 0
                            ? <p className='text-gray-500'>No connections yet. Edit this group to add connections.</p>
                            : (
                                <div className='space-y-2'>
                                    {group.connections.map(conn => (
                                        <div key={conn.id} className='p-3 bg-gray-50 rounded-md flex justify-between'>
                                            <span className='text-gray-600'>
                                                {conn.source && conn.target
                                                    ? `${conn.source} → ${conn.target}`
                                                    : conn.source || conn.target || '(empty)'}
                                            </span>
                                            <span className='font-medium text-gray-900'>{conn.value}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                    </section>

                    {/* Used In */}
                    <section className='bg-white rounded-lg shadow p-6'>
                        <h2 className='text-xl font-semibold text-gray-900 mb-4'>
                            Used In ({group.scenarioReferences.length} scenarios)
                        </h2>
                        {group.scenarioReferences.length === 0
                            ? <p className='text-gray-500'>This group is not used in any scenarios yet.</p>
                            : (
                                <div className='space-y-2'>
                                    {group.scenarioReferences.map(ref => (
                                        <Link
                                            key={ref.id}
                                            to={`/projects/${project.id}/scenarios/${ref.scenario.id}`}
                                            className='block p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors'
                                        >
                                            <div className='text-blue-600 font-medium'>{ref.scenario.name}</div>
                                            <div className='text-sm text-gray-600 mt-1'>
                                                {ref.direction === 'source'
                                                    ? `${ref.connectingNode} → [Group]`
                                                    : `[Group] → ${ref.connectingNode}`}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                    </section>
                </div>

                {/* Example */}
                <section className='mt-8 bg-white rounded-lg shadow p-6'>
                    <h2 className='text-xl font-semibold text-gray-900 mb-4'>Example Usage</h2>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <div className='bg-gray-50 rounded-md p-4'>
                            <p className='text-sm font-medium text-gray-700 mb-2'>As targets (Node → Group):</p>
                            <p className='text-xs text-gray-500 mb-2'>e.g., "Budget" → [{group.name}]</p>
                            <div className='font-mono text-sm space-y-1'>
                                {group.connections.map(conn => (
                                    <div key={conn.id} className='text-gray-700'>
                                        Budget [{conn.value}] {conn.source || conn.target}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className='bg-gray-50 rounded-md p-4'>
                            <p className='text-sm font-medium text-gray-700 mb-2'>As sources (Group → Node):</p>
                            <p className='text-xs text-gray-500 mb-2'>e.g., [{group.name}] → "Total"</p>
                            <div className='font-mono text-sm space-y-1'>
                                {group.connections.map(conn => (
                                    <div key={conn.id} className='text-gray-700'>
                                        {conn.source || conn.target} [{conn.value}] Total
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
