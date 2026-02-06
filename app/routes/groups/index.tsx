import { eq } from 'drizzle-orm';
import { Link } from 'react-router';
import type { Route } from './+types/index';
import { database } from '~/database/context';
import * as schema from '~/database/schema';

export function meta({ data }: Route.MetaArgs) {
    return [ { title: data?.project ? `Groups - ${data.project.name}` : 'Groups' } ];
}

export async function loader({ params }: Route.LoaderArgs) {
    const db = database();
    const projectId = parseInt(params.projectId, 10);

    if (isNaN(projectId)) {
        throw new Response('Invalid project ID', { status: 400 });
    }

    const project = await db.query.projects.findFirst({
        where: eq(schema.projects.id, projectId),
        columns: { id: true, name: true }
    });

    if (!project) {
        throw new Response('Project not found', { status: 404 });
    }

    const groups = await db.query.groups.findMany({
        where: eq(schema.groups.projectId, projectId),
        orderBy: (groups, { desc }) => [ desc(groups.updatedAt) ],
        with: {
            connections: {
                columns: { id: true }
            },
            scenarioReferences: {
                columns: { id: true }
            }
        }
    });

    return { project, groups };
}

export default function GroupsIndex({ loaderData }: Route.ComponentProps) {
    const { project, groups } = loaderData;

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <div className='flex items-center justify-between'>
                        <div>
                            <Link to={`/projects/${project.id}`} className='text-sm text-gray-500 hover:text-gray-700'>
                                ← Back to {project.name}
                            </Link>
                            <h1 className='text-3xl font-bold text-gray-900 mt-2'>Reusable Groups</h1>
                            <p className='text-gray-600 mt-1'>
                                Groups are sets of connections that can be reused across scenarios.
                            </p>
                        </div>
                        <Link
                            to={`/projects/${project.id}/groups/new`}
                            className='bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors'
                        >
                            New Group
                        </Link>
                    </div>
                </div>
            </header>

            <main className='max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8'>
                {groups.length === 0
                    ? (
                        <div className='text-center py-12 bg-white rounded-lg shadow'>
                            <h2 className='text-xl font-medium text-gray-900 mb-2'>No groups yet</h2>
                            <p className='text-gray-500 mb-6'>
                                Create your first group to define reusable connection sets.
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
                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                            {groups.map(group => (
                                <Link
                                    key={group.id}
                                    to={`/projects/${project.id}/groups/${group.id}`}
                                    className='block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6'
                                >
                                    <h2 className='text-xl font-semibold text-gray-900 mb-2'>{group.name}</h2>
                                    {group.description && (
                                        <p className='text-gray-600 text-sm mb-4 line-clamp-2'>{group.description}</p>
                                    )}
                                    <div className='flex gap-4 text-sm text-gray-500'>
                                        <span>
                                            {group.connections.length} connection
                                            {group.connections.length !== 1 ? 's' : ''}
                                        </span>
                                        <span>
                                            Used in {group.scenarioReferences.length} scenario
                                            {group.scenarioReferences.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
            </main>
        </div>
    );
}
