import { and, eq } from 'drizzle-orm';
import { Form, redirect } from 'react-router';
import type { Route } from './+types/edit';
import { Breadcrumbs } from '~/components/Breadcrumbs';
import { database } from '~/database/context';
import * as schema from '~/database/schema';
import { requireProjectWriteAccess, parseProjectId } from '~/utils/project-ownership.server';

export function meta({ data }: Route.MetaArgs) {
    return [ { title: data?.node ? `Edit ${data.node.name} - ${data.project.name}` : 'Edit Node' } ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
    const projectId = parseProjectId(params.projectId);
    const nodeId = parseInt(params.nodeId, 10);

    if (isNaN(nodeId)) {
        throw new Response('Invalid node ID', { status: 400 });
    }

    const { project } = await requireProjectWriteAccess(request, projectId);
    const db = database();

    const node = await db.query.nodes.findFirst({
        where: and(eq(schema.nodes.id, nodeId), eq(schema.nodes.projectId, projectId))
    });

    if (!node) {
        throw new Response('Node not found', { status: 404 });
    }

    return { project, node };
}

export async function action({ request, params }: Route.ActionArgs) {
    const projectId = parseProjectId(params.projectId);
    const nodeId = parseInt(params.nodeId, 10);

    if (isNaN(nodeId)) {
        throw new Response('Invalid node ID', { status: 400 });
    }

    await requireProjectWriteAccess(request, projectId);

    const formData = await request.formData();
    const intent = formData.get('intent');
    const db = database();

    if (intent === 'delete') {
        await db.delete(schema.nodes).where(
            and(eq(schema.nodes.id, nodeId), eq(schema.nodes.projectId, projectId))
        );
        return redirect(`/projects/${projectId}/nodes`);
    }

    if (intent === 'update') {
        const name = formData.get('name');
        const value = formData.get('value');
        const description = formData.get('description');

        if (typeof name !== 'string' || !name.trim()) {
            return { error: 'Node name is required' };
        }

        if (typeof value !== 'string' || !value.trim()) {
            return { error: 'Value is required' };
        }

        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue <= 0) {
            return { error: 'Value must be a positive number' };
        }

        await db.update(schema.nodes).set({
            name: name.trim(),
            value: numValue,
            description: typeof description === 'string' ? description.trim() || null : null,
            updatedAt: new Date()
        }).where(and(eq(schema.nodes.id, nodeId), eq(schema.nodes.projectId, projectId)));
    }

    return { success: true };
}

export default function EditNode({ loaderData, actionData }: Route.ComponentProps) {
    const { project, node } = loaderData;

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <Breadcrumbs items={[
                        { label: 'Home', to: '/' },
                        { label: project.name, to: `/projects/${project.id}` },
                        { label: 'Nodes', to: `/projects/${project.id}/nodes` },
                        { label: node.name, to: `/projects/${project.id}/nodes/${node.id}` },
                        { label: 'Edit' },
                    ]} />
                    <h1 className='text-3xl font-bold text-gray-900 mt-2'>Edit Node</h1>
                </div>
            </header>

            <main className='max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8'>
                {actionData?.error && <div className='p-4 bg-red-50 text-red-700 rounded-md'>{actionData.error}</div>}

                {/* Basic Info */}
                <section className='bg-white rounded-lg shadow p-6'>
                    <h2 className='text-xl font-semibold text-gray-900 mb-4'>Node Details</h2>
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
                                    defaultValue={node.name}
                                    className='w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500'
                                />
                            </div>
                            <div>
                                <label htmlFor='value' className='block text-sm font-medium text-gray-700 mb-1'>
                                    Value *
                                </label>
                                <input
                                    type='number'
                                    id='value'
                                    name='value'
                                    required
                                    min='0.01'
                                    step='0.01'
                                    defaultValue={node.value}
                                    className='w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500'
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
                                    defaultValue={node.description ?? ''}
                                    className='w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500'
                                />
                            </div>
                        </div>
                        <div className='mt-4 flex justify-end'>
                            <button
                                type='submit'
                                className='px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors'
                            >
                                Save Changes
                            </button>
                        </div>
                    </Form>
                </section>

                {/* Delete Node */}
                <section className='bg-white rounded-lg shadow p-6 border border-red-200'>
                    <h2 className='text-xl font-semibold text-red-600 mb-4'>Danger Zone</h2>
                    <p className='text-gray-600 text-sm mb-4'>
                        Deleting this node will also remove all references to it from scenarios.
                    </p>
                    <Form method='post'>
                        <input type='hidden' name='intent' value='delete' />
                        <button
                            type='submit'
                            className='px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors'
                            onClick={e => {
                                if (!confirm('Are you sure you want to delete this node?')) {
                                    e.preventDefault();
                                }
                            }}
                        >
                            Delete Node
                        </button>
                    </Form>
                </section>
            </main>
        </div>
    );
}
