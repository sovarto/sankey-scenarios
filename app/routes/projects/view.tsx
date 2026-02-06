import { eq } from 'drizzle-orm';
import { Link } from 'react-router';
import type { Route } from './+types/view';
import { database } from '~/database/context';
import * as schema from '~/database/schema';

export function meta({ data }: Route.MetaArgs) {
    return [ { title: data?.project ? `${data.project.name} - Sankey Scenarios` : 'Project Not Found' } ];
}

export async function loader({ params }: Route.LoaderArgs) {
    const db = database();
    const projectId = parseInt(params.projectId, 10);

    if (isNaN(projectId)) {
        throw new Response('Invalid project ID', { status: 400 });
    }

    const project = await db.query.projects.findFirst({
        where: eq(schema.projects.id, projectId),
        with: {
            scenarios: {
                orderBy: (scenarios, { desc }) => [ desc(scenarios.updatedAt) ]
            },
            groups: {
                orderBy: (groups, { desc }) => [ desc(groups.updatedAt) ]
            }
        }
    });

    if (!project) {
        throw new Response('Project not found', { status: 404 });
    }

    return { project };
}

export default function ViewProject({ loaderData }: Route.ComponentProps) {
    const { project } = loaderData;

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <Link to='/projects' className='text-sm text-gray-500 hover:text-gray-700'>← Back to Projects</Link>
                    <div className='flex items-center justify-between mt-2'>
                        <div>
                            <h1 className='text-3xl font-bold text-gray-900'>{project.name}</h1>
                            {project.description && <p className='text-gray-600 mt-1'>{project.description}</p>}
                        </div>
                        <Link
                            to={`/projects/${project.id}/edit`}
                            className='px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors'
                        >
                            Edit Project
                        </Link>
                    </div>
                </div>
            </header>

            <main className='max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8'>
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
                    {/* Scenarios Section */}
                    <section>
                        <div className='flex items-center justify-between mb-4'>
                            <h2 className='text-xl font-semibold text-gray-900'>Scenarios</h2>
                            <Link
                                to={`/projects/${project.id}/scenarios/new`}
                                className='px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors'
                            >
                                New Scenario
                            </Link>
                        </div>

                        {project.scenarios.length === 0
                            ? (
                                <div className='text-center py-12 bg-white rounded-lg shadow'>
                                    <h3 className='text-lg font-medium text-gray-900 mb-2'>No scenarios yet</h3>
                                    <p className='text-gray-500 mb-6'>
                                        Create your first scenario to start building diagrams.
                                    </p>
                                    <Link
                                        to={`/projects/${project.id}/scenarios/new`}
                                        className='bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors'
                                    >
                                        Create Scenario
                                    </Link>
                                </div>
                            )
                            : (
                                <div className='space-y-3'>
                                    {project.scenarios.map(scenario => (
                                        <Link
                                            key={scenario.id}
                                            to={`/projects/${project.id}/scenarios/${scenario.id}`}
                                            className='block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4'
                                        >
                                            <h3 className='font-semibold text-gray-900'>{scenario.name}</h3>
                                            {scenario.description && (
                                                <p className='text-gray-600 text-sm mt-1 line-clamp-2'>
                                                    {scenario.description}
                                                </p>
                                            )}
                                        </Link>
                                    ))}
                                </div>
                            )}
                    </section>

                    {/* Groups Section */}
                    <section>
                        <div className='flex items-center justify-between mb-4'>
                            <h2 className='text-xl font-semibold text-gray-900'>Reusable Groups</h2>
                            <Link
                                to={`/projects/${project.id}/groups/new`}
                                className='px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors'
                            >
                                New Group
                            </Link>
                        </div>

                        {project.groups.length === 0
                            ? (
                                <div className='text-center py-12 bg-white rounded-lg shadow'>
                                    <h3 className='text-lg font-medium text-gray-900 mb-2'>No groups yet</h3>
                                    <p className='text-gray-500 mb-6'>
                                        Create reusable connection groups to share across scenarios.
                                    </p>
                                    <Link
                                        to={`/projects/${project.id}/groups/new`}
                                        className='bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 transition-colors'
                                    >
                                        Create Group
                                    </Link>
                                </div>
                            )
                            : (
                                <div className='space-y-3'>
                                    {project.groups.map(group => (
                                        <Link
                                            key={group.id}
                                            to={`/projects/${project.id}/groups/${group.id}`}
                                            className='block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4'
                                        >
                                            <h3 className='font-semibold text-green-700'>{group.name}</h3>
                                            {group.description && (
                                                <p className='text-gray-600 text-sm mt-1 line-clamp-2'>
                                                    {group.description}
                                                </p>
                                            )}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        <Link
                            to={`/projects/${project.id}/groups`}
                            className='inline-block mt-4 text-sm text-green-600 hover:text-green-800'
                        >
                            View all groups →
                        </Link>
                    </section>
                </div>
            </main>
        </div>
    );
}
