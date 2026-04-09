import { and, eq } from 'drizzle-orm';
import { useState } from 'react';
import { Form, redirect } from 'react-router';
import type { Route } from './+types/edit';
import { Breadcrumbs } from '~/components/Breadcrumbs';
import { AddGroupConnectionForm } from './components/AddGroupConnectionForm';
import { GroupConnectionList } from './components/GroupConnectionList';
import { database } from '~/database/context';
import * as schema from '~/database/schema';
import { InlineEditableText } from '~/routes/scenarios/components/InlineEditableText';
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

    const access = await requireProjectWriteAccess(request, projectId);
    const db = database();

    const group = await db.query.groups.findFirst({
        where: and(eq(schema.groups.id, groupId), eq(schema.groups.projectId, projectId)),
        with: {
            connections: {
                orderBy: (connections, { asc }) => [ asc(connections.displayOrder) ]
            }
        }
    });

    if (!group) {
        throw new Response('Group not found', { status: 404 });
    }

    return { project: access.project, group, userLocale: access.user.regionalLocale };
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

    if (intent === 'update-name') {
        const name = formData.get('name');
        if (typeof name !== 'string' || !name.trim()) {
            return { error: 'Group name is required' };
        }
        await db.update(schema.groups).set({
            name: name.trim(),
            updatedAt: new Date()
        }).where(and(eq(schema.groups.id, groupId), eq(schema.groups.projectId, projectId)));
        return { success: true };
    }

    if (intent === 'update-description') {
        const description = formData.get('description');
        await db.update(schema.groups).set({
            description: typeof description === 'string' ? description.trim() || null : null,
            updatedAt: new Date()
        }).where(and(eq(schema.groups.id, groupId), eq(schema.groups.projectId, projectId)));
        return { success: true };
    }

    if (intent === 'add-connection') {
        const node = formData.get('node');
        const value = formData.get('value');
        const valueExpression = formData.get('valueExpression');

        if (typeof node !== 'string' || !node.trim() || typeof value !== 'string') {
            return { error: 'Node name and value are required' };
        }

        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue <= 0) {
            return { error: 'Value must be a positive number' };
        }

        // Get next display order
        const existing = await db.query.connections.findMany({
            where: eq(schema.connections.groupId, groupId),
            columns: { displayOrder: true }
        });
        const maxOrder = existing.reduce((max, c) => Math.max(max, c.displayOrder), -1);

        await db.insert(schema.connections).values({
            groupId,
            source: node.trim(),
            target: node.trim(),
            value: numValue,
            valueExpression: typeof valueExpression === 'string' && valueExpression.trim()
                ? valueExpression.trim()
                : null,
            displayOrder: maxOrder + 1
        });

        await db.update(schema.groups).set({ updatedAt: new Date() }).where(eq(schema.groups.id, groupId));
        return { success: true };
    }

    if (intent === 'update-connection-name') {
        const connectionId = formData.get('connectionId');
        const name = formData.get('name');

        if (typeof connectionId !== 'string' || typeof name !== 'string' || !name.trim()) {
            return { error: 'Connection ID and name are required' };
        }

        const id = parseInt(connectionId, 10);
        await db.update(schema.connections).set({
            source: name.trim(),
            target: name.trim()
        }).where(and(eq(schema.connections.id, id), eq(schema.connections.groupId, groupId)));

        await db.update(schema.groups).set({ updatedAt: new Date() }).where(eq(schema.groups.id, groupId));
        return { success: true };
    }

    if (intent === 'update-connection-value') {
        const connectionId = formData.get('connectionId');
        const value = formData.get('value');
        const valueExpression = formData.get('valueExpression');
        const valueDescription = formData.get('valueDescription');

        if (typeof connectionId !== 'string' || typeof value !== 'string') {
            return { error: 'Connection ID and value are required' };
        }

        const id = parseInt(connectionId, 10);
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue <= 0) {
            return { error: 'Value must be a positive number' };
        }

        await db.update(schema.connections).set({
            value: numValue,
            valueExpression: typeof valueExpression === 'string' && valueExpression ? valueExpression : null,
            valueDescription: typeof valueDescription === 'string' && valueDescription ? valueDescription : null
        }).where(and(eq(schema.connections.id, id), eq(schema.connections.groupId, groupId)));

        await db.update(schema.groups).set({ updatedAt: new Date() }).where(eq(schema.groups.id, groupId));
        return { success: true };
    }

    if (intent === 'delete-connection') {
        const connectionId = formData.get('connectionId');
        if (typeof connectionId === 'string') {
            await db.delete(schema.connections).where(
                and(eq(schema.connections.id, parseInt(connectionId, 10)), eq(schema.connections.groupId, groupId))
            );
            await db.update(schema.groups).set({ updatedAt: new Date() }).where(eq(schema.groups.id, groupId));
        }
        return { success: true };
    }

    if (intent === 'reorder-connections') {
        const orderDataStr = formData.get('orderData');
        if (typeof orderDataStr !== 'string') {
            return { error: 'Order data is required' };
        }

        const orderData: Array<{ id: number; order: number }> = JSON.parse(orderDataStr);
        for (const item of orderData) {
            await db.update(schema.connections).set({ displayOrder: item.order }).where(
                and(eq(schema.connections.id, item.id), eq(schema.connections.groupId, groupId))
            );
        }

        await db.update(schema.groups).set({ updatedAt: new Date() }).where(eq(schema.groups.id, groupId));
        return { success: true };
    }

    return { success: true };
}

export default function EditGroup({ loaderData, actionData }: Route.ComponentProps) {
    const { project, group, userLocale } = loaderData;
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
                    <div className='mt-2'>
                        <InlineEditableText
                            value={group.name}
                            name='name'
                            className='text-3xl font-bold text-gray-900'
                            inputClassName='text-3xl font-bold text-gray-900 w-full'
                            as='h1'
                        />
                        <InlineEditableText
                            value={group.description ?? ''}
                            name='description'
                            placeholder='Click to add description...'
                            className='text-gray-600 mt-1'
                            inputClassName='text-gray-600 w-full'
                            as='p'
                        />
                        <p className='text-sm text-gray-500 mt-1'>in {project.name}</p>
                    </div>
                </div>
            </header>

            <main className='max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8'>
                {actionData?.error && <div className='p-4 bg-red-50 text-red-700 rounded-md'>{actionData.error}</div>}

                {/* Connections */}
                <section className='bg-white rounded-lg shadow p-6'>
                    <div className='flex items-center justify-between mb-4'>
                        <div>
                            <h2 className='text-xl font-semibold text-gray-900'>
                                Connections ({group.connections.length})
                            </h2>
                            <p className='text-sm text-gray-600'>
                                Define nodes and their values. Click names or values to edit inline. Drag to reorder.
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
                        <div className='mb-6'>
                            <AddGroupConnectionForm locale={userLocale} />
                        </div>
                    )}

                    <GroupConnectionList connections={group.connections} locale={userLocale} />
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
