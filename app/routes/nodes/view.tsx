import { and, eq } from 'drizzle-orm';
import { Link } from 'react-router';
import type { Route } from './+types/view';
import { database } from '~/database/context';
import * as schema from '~/database/schema';
import { requireProjectAccess, parseProjectId } from '~/utils/project-ownership.server';

export function meta({ data }: Route.MetaArgs) {
    return [ { title: data?.node ? `${data.node.name} - ${data.project.name}` : 'Node Not Found' } ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
    const projectId = parseProjectId(params.projectId);
    const nodeId = parseInt(params.nodeId, 10);

    if (isNaN(nodeId)) {
        throw new Response('Invalid node ID', { status: 400 });
    }

    const access = await requireProjectAccess(request, projectId);
    const db = database();

    const node = await db.query.nodes.findFirst({
        where: and(eq(schema.nodes.id, nodeId), eq(schema.nodes.projectId, projectId)),
        with: {
            scenarioReferences: {
                with: {
                    scenario: {
                        columns: { id: true, name: true }
                    }
                }
            }
        }
    });

    if (!node) {
        throw new Response('Node not found', { status: 404 });
    }

    return { project: access.project, node, canWrite: access.canWrite };
}

export default function ViewNode({ loaderData }: Route.ComponentProps) {
    const { project, node, canWrite } = loaderData;

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <Link to={`/projects/${project.id}/nodes`} className='text-sm text-gray-500 hover:text-gray-700'>
                        ← Back to Nodes
                    </Link>
                    <div className='flex items-center justify-between mt-2'>
                        <div>
                            <div className='flex items-center gap-3'>
                                <h1 className='text-3xl font-bold text-gray-900'>{node.name}</h1>
                                <span className='bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-lg font-medium'>
                                    {node.value}
                                </span>
                            </div>
                            {node.description && <p className='text-gray-600 mt-1'>{node.description}</p>}
                            <p className='text-sm text-gray-500'>in {project.name}</p>
                        </div>
                        {canWrite && (
                            <Link
                                to={`/projects/${project.id}/nodes/${node.id}/edit`}
                                className='px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors'
                            >
                                Edit Node
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            <main className='max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8'>
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
                    {/* Example Usage */}
                    <section className='bg-white rounded-lg shadow p-6'>
                        <h2 className='text-xl font-semibold text-gray-900 mb-4'>How this node works</h2>
                        <div className='space-y-4'>
                            <div className='bg-gray-50 rounded-md p-4'>
                                <p className='text-sm font-medium text-gray-700 mb-2'>As a source (Node → Target):</p>
                                <p className='font-mono text-sm text-gray-600'>
                                    {node.name} [{node.value}] → YourTarget
                                </p>
                            </div>
                            <div className='bg-gray-50 rounded-md p-4'>
                                <p className='text-sm font-medium text-gray-700 mb-2'>As a target (Source → Node):</p>
                                <p className='font-mono text-sm text-gray-600'>
                                    YourSource [{node.value}] → {node.name}
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Used In */}
                    <section className='bg-white rounded-lg shadow p-6'>
                        <h2 className='text-xl font-semibold text-gray-900 mb-4'>
                            Used In ({node.scenarioReferences.length} scenarios)
                        </h2>
                        {node.scenarioReferences.length === 0
                            ? <p className='text-gray-500'>This node is not used in any scenarios yet.</p>
                            : (
                                <div className='space-y-2'>
                                    {node.scenarioReferences.map(ref => (
                                        <Link
                                            key={ref.id}
                                            to={`/projects/${project.id}/scenarios/${ref.scenario.id}`}
                                            className='block p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors'
                                        >
                                            <div className='text-blue-600 font-medium'>{ref.scenario.name}</div>
                                            <div className='text-sm text-gray-600 mt-1'>
                                                {ref.direction === 'source'
                                                    ? `${node.name} → ${ref.connectingNode}`
                                                    : `${ref.connectingNode} → ${node.name}`}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                    </section>
                </div>
            </main>
        </div>
    );
}
