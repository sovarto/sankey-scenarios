import { and, eq } from 'drizzle-orm';
import { useState } from 'react';
import { Form, redirect } from 'react-router';
import type { Route } from './+types/edit';
import { Breadcrumbs } from '~/components/Breadcrumbs';
import { database } from '~/database/context';
import * as schema from '~/database/schema';
import { requireProjectWriteAccess, parseProjectId } from '~/utils/project-ownership.server';

export function meta({ data }: Route.MetaArgs) {
    return [ { title: data?.group ? `Edit ${data.group.name} - ${data.project.name}` : 'Edit Group' } ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
    const projectId = parseProjectId(params.projectId);
    const groupId = parseInt(params.groupId, 10);

    if (isNaN(groupId)) {
        throw new Response('Invalid group ID', { status: 400 });
    }

    const { project } = await requireProjectWriteAccess(request, projectId);
    const db = database();

    const group = await db.query.groups.findFirst({
        where: and(eq(schema.groups.id, groupId), eq(schema.groups.projectId, projectId)),
        with: {
            connections: true
        }
    });

    if (!group) {
        throw new Response('Group not found', { status: 404 });
    }

    return { project, group };
}

export async function action({ request, params }: Route.ActionArgs) {
    const projectId = parseProjectId(params.projectId);
    const groupId = parseInt(params.groupId, 10);

    if (isNaN(groupId)) {
        throw new Response('Invalid group ID', { status: 400 });
    }

    await requireProjectWriteAccess(request, projectId);

    const formData = await request.formData();
    const intent = formData.get('intent');
    const db = database();

    if (intent === 'delete') {
        await db.delete(schema.groups).where(
            and(eq(schema.groups.id, groupId), eq(schema.groups.projectId, projectId))
        );
        return redirect(`/projects/${projectId}/groups`);
    }

    if (intent === 'update') {
        const name = formData.get('name');
        const description = formData.get('description');

        if (typeof name !== 'string' || !name.trim()) {
            return { error: 'Group name is required' };
        }

        await db.update(schema.groups).set({
            name: name.trim(),
            description: typeof description === 'string' ? description.trim() || null : null,
            updatedAt: new Date()
        }).where(and(eq(schema.groups.id, groupId), eq(schema.groups.projectId, projectId)));
    }

    if (intent === 'add-connection') {
        const node = formData.get('node');
        const value = formData.get('value');

        if (typeof node !== 'string' || !node.trim() || typeof value !== 'string') {
            return { error: 'Node name and value are required' };
        }

        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue <= 0) {
            return { error: 'Value must be a positive number' };
        }

        // Store the node name in both source and target for flexibility
        // When used in a scenario, one will be replaced by the connecting node
        await db.insert(schema.connections).values({
            groupId,
            source: node.trim(),
            target: node.trim(),
            value: numValue
        });
    }

    if (intent === 'delete-connection') {
        const connectionId = formData.get('connectionId');
        if (typeof connectionId === 'string') {
            await db.delete(schema.connections).where(eq(schema.connections.id, parseInt(connectionId, 10)));
        }
    }

    return { success: true };
}

export default function EditGroup({ loaderData, actionData }: Route.ComponentProps) {
    const { project, group } = loaderData;
    const [ showAddConnection, setShowAddConnection ] = useState(false);

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <Breadcrumbs items={[
                        { label: 'Home', to: '/' },
                        { label: project.name, to: `/projects/${project.id}` },
                        { label: 'Groups', to: `/projects/${project.id}/groups` },
                        { label: group.name, to: `/projects/${project.id}/groups/${group.id}` },
                        { label: 'Edit' },
                    ]} />
                    <h1 className='text-3xl font-bold text-gray-900 mt-2'>Edit Group</h1>
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
                                    defaultValue={group.name}
                                    className='w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500'
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
                                    defaultValue={group.description ?? ''}
                                    className='w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500'
                                />
                            </div>
                        </div>
                        <div className='mt-4 flex justify-end'>
                            <button
                                type='submit'
                                className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors'
                            >
                                Save Changes
                            </button>
                        </div>
                    </Form>
                </section>

                {/* Connections */}
                <section className='bg-white rounded-lg shadow p-6'>
                    <div className='flex items-center justify-between mb-4'>
                        <div>
                            <h2 className='text-xl font-semibold text-gray-900'>Connections</h2>
                            <p className='text-sm text-gray-600'>
                                Define nodes and their values. When used in a scenario, these can act as either sources
                                or targets.
                            </p>
                        </div>
                        <button
                            type='button'
                            onClick={() => setShowAddConnection(!showAddConnection)}
                            className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm'
                        >
                            {showAddConnection ? 'Cancel' : 'Add Connection'}
                        </button>
                    </div>

                    {showAddConnection && (
                        <Form method='post' className='mb-6 p-4 bg-gray-50 rounded-md'>
                            <input type='hidden' name='intent' value='add-connection' />
                            <div className='grid grid-cols-2 gap-4'>
                                <div>
                                    <label className='block text-sm font-medium text-gray-700 mb-1'>Node Name</label>
                                    <input
                                        type='text'
                                        name='node'
                                        required
                                        placeholder='Taxes'
                                        className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm'
                                    />
                                    <p className='text-xs text-gray-500 mt-1'>
                                        This will become source or target depending on how the group is used
                                    </p>
                                </div>
                                <div>
                                    <label className='block text-sm font-medium text-gray-700 mb-1'>Value</label>
                                    <input
                                        type='number'
                                        name='value'
                                        required
                                        min='0.01'
                                        step='0.01'
                                        placeholder='450'
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

                    {group.connections.length === 0
                        ? <p className='text-gray-500 text-sm'>No connections yet.</p>
                        : (
                            <div className='space-y-2'>
                                {group.connections.map(conn => (
                                    <div
                                        key={conn.id}
                                        className='flex items-center justify-between p-3 bg-gray-50 rounded-md'
                                    >
                                        <span className='text-gray-900'>
                                            {conn.source || conn.target}:{' '}
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

                {/* Delete Group */}
                <section className='bg-white rounded-lg shadow p-6 border border-red-200'>
                    <h2 className='text-xl font-semibold text-red-600 mb-4'>Danger Zone</h2>
                    <p className='text-gray-600 text-sm mb-4'>
                        Deleting this group will also remove all references to it from scenarios.
                    </p>
                    <Form method='post'>
                        <input type='hidden' name='intent' value='delete' />
                        <button
                            type='submit'
                            className='px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors'
                            onClick={e => {
                                if (!confirm('Are you sure you want to delete this group?')) {
                                    e.preventDefault();
                                }
                            }}
                        >
                            Delete Group
                        </button>
                    </Form>
                </section>
            </main>
        </div>
    );
}
