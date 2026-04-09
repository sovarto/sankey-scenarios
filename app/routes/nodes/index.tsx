import { eq } from 'drizzle-orm';
import { Link } from 'react-router';
import type { Route } from './+types/index';
import { Breadcrumbs } from '~/components/Breadcrumbs';
import { database } from '~/database/context';
import * as schema from '~/database/schema';
import { requireProjectAccess, parseProjectId } from '~/utils/project-ownership.server';

export function meta({ data }: Route.MetaArgs) {
    return [ { title: data?.project ? `Nodes - ${data.project.name}` : 'Nodes' } ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
    const projectId = parseProjectId(params.projectId);
    const access = await requireProjectAccess(request, projectId);
    const db = database();

    const nodes = await db.query.nodes.findMany({
        where: eq(schema.nodes.projectId, projectId),
        orderBy: (nodes, { desc }) => [ desc(nodes.updatedAt) ],
        with: {
            scenarioReferences: {
                columns: { id: true }
            }
        }
    });

    return { project: access.project, nodes, canWrite: access.canWrite };
}

export default function NodesIndex({ loaderData }: Route.ComponentProps) {
    const { project, nodes, canWrite } = loaderData;

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <div className='flex items-center justify-between'>
                        <div>
                            <Breadcrumbs items={[
                                { label: 'Home', to: '/' },
                                { label: project.name, to: `/projects/${project.id}` },
                                { label: 'Nodes' },
                            ]} />
                            <h1 className='text-3xl font-bold text-gray-900 mt-2'>Reusable Nodes</h1>
                            <p className='text-gray-600 mt-1'>
                                Single nodes with values that can be referenced across scenarios.
                            </p>
                        </div>
                        {canWrite && (
                            <Link
                                to={`/projects/${project.id}/nodes/new`}
                                className='bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors'
                            >
                                New Node
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            <main className='max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8'>
                {nodes.length === 0
                    ? (
                        <div className='text-center py-12 bg-white rounded-lg shadow'>
                            <h2 className='text-xl font-medium text-gray-900 mb-2'>No nodes yet</h2>
                            <p className='text-gray-500 mb-6'>
                                {canWrite
                                    ? 'Create your first reusable node to use across scenarios.'
                                    : 'No reusable nodes have been created yet.'}
                            </p>
                            {canWrite && (
                                <Link
                                    to={`/projects/${project.id}/nodes/new`}
                                    className='bg-purple-600 text-white px-6 py-3 rounded-md hover:bg-purple-700 transition-colors'
                                >
                                    Create Node
                                </Link>
                            )}
                        </div>
                    )
                    : (
                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                            {nodes.map(node => (
                                <Link
                                    key={node.id}
                                    to={`/projects/${project.id}/nodes/${node.id}`}
                                    className='block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6'
                                >
                                    <div className='flex justify-between items-start mb-2'>
                                        <h2 className='text-xl font-semibold text-gray-900'>{node.name}</h2>
                                        <span className='bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm font-medium'>
                                            {node.value}
                                        </span>
                                    </div>
                                    {node.description && (
                                        <p className='text-gray-600 text-sm mb-4 line-clamp-2'>{node.description}</p>
                                    )}
                                    <div className='text-sm text-gray-500'>
                                        Used in {node.scenarioReferences.length} scenario
                                        {node.scenarioReferences.length !== 1 ? 's' : ''}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
            </main>
        </div>
    );
}
