import { and, eq } from 'drizzle-orm';
import { useState } from 'react';
import { Form, Link, redirect } from 'react-router';
import type { Route } from './+types/view';
import { AddGroupConnectionForm } from './components/AddGroupConnectionForm';
import { GroupConnectionList } from './components/GroupConnectionList';
import { database } from '~/database/context';
import * as schema from '~/database/schema';
import { InlineEditableText } from '~/routes/scenarios/components/InlineEditableText';
import { formatLocaleNumber } from '~/utils/numberUtils';
import { requireProjectAccess, requireProjectWriteAccess, parseProjectId } from '~/utils/project-ownership.server';

export function meta({ data }: Route.MetaArgs) {
    return [ { title: data?.group ? `${data.group.name} - ${data.project.name}` : 'Group Not Found' } ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
    const projectId = parseProjectId(params.projectId);
    const groupId = parseInt(params.groupId, 10);

    if (isNaN(groupId)) {
        throw new Response('Invalid group ID', { status: 400 });
    }

    const access = await requireProjectAccess(request, projectId);
    const db = database();

    const group = await db.query.groups.findFirst({
        where: and(eq(schema.groups.id, groupId), eq(schema.groups.projectId, projectId)),
        with: {
            connections: {
                orderBy: (connections, { asc }) => [ asc(connections.displayOrder) ]
            },
            scenarioReferences: {
                with: {
                    scenario: {
                        columns: { id: true, name: true }
                    },
                    connectingLocalNode: {
                        columns: { name: true }
                    }
                }
            }
        }
    });

    if (!group) {
        throw new Response('Group not found', { status: 404 });
    }

    return { project: access.project, group, canWrite: access.canWrite, userLocale: access.user.regionalLocale };
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

export default function ViewGroup({ loaderData, actionData }: Route.ComponentProps) {
    const { project, group, canWrite, userLocale } = loaderData;
    const [ showAddConnection, setShowAddConnection ] = useState(false);

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <Link to={`/projects/${project.id}/groups`} className='text-sm text-gray-500 hover:text-gray-700'>
                        ← Back to Groups
                    </Link>
                    <div className='mt-2'>
                        {canWrite
                            ? (
                                <>
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
                                </>
                            )
                            : (
                                <>
                                    <h1 className='text-3xl font-bold text-gray-900'>{group.name}</h1>
                                    {group.description && <p className='text-gray-600 mt-1'>{group.description}</p>}
                                </>
                            )}
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
                                {canWrite
                                    ? 'Define nodes and their values. Click names or values to edit inline. Drag to reorder.'
                                    : 'These connections can be used as either sources or targets depending on how the group is referenced in a scenario.'}
                            </p>
                        </div>
                        {canWrite && (
                            <button
                                type='button'
                                onClick={() => setShowAddConnection(!showAddConnection)}
                                className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm'
                            >
                                {showAddConnection ? 'Cancel' : 'Add Connection'}
                            </button>
                        )}
                    </div>

                    {canWrite && showAddConnection && (
                        <div className='mb-6'>
                            <AddGroupConnectionForm locale={userLocale} />
                        </div>
                    )}

                    {canWrite
                        ? <GroupConnectionList connections={group.connections} locale={userLocale} />
                        : group.connections.length === 0
                        ? <p className='text-gray-500'>No connections yet.</p>
                        : (
                            <div className='space-y-2'>
                                {group.connections.map(conn => (
                                    <div
                                        key={conn.id}
                                        className='p-3 bg-gray-50 rounded-md flex items-center justify-between'
                                    >
                                        <div className='flex items-center gap-2'>
                                            <span className='text-blue-600 font-medium'>
                                                {conn.source || conn.target || '(empty)'}
                                            </span>
                                            {conn.valueDescription && (
                                                <span className='text-xs text-gray-400' title={conn.valueDescription}>
                                                    <svg
                                                        className='w-3.5 h-3.5 inline'
                                                        fill='currentColor'
                                                        viewBox='0 0 20 20'
                                                    >
                                                        <path
                                                            fillRule='evenodd'
                                                            d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
                                                            clipRule='evenodd'
                                                        />
                                                    </svg>
                                                </span>
                                            )}
                                        </div>
                                        <span
                                            className='font-mono font-medium text-gray-900'
                                            title={conn.valueExpression
                                                ? `Expression: ${conn.valueExpression}`
                                                : undefined}
                                        >
                                            {formatLocaleNumber(conn.value, userLocale ?? undefined)}
                                        </span>
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
                                                ? `${ref.connectingLocalNode.name} → [Group]`
                                                : `[Group] → ${ref.connectingLocalNode.name}`}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                </section>

                {/* Delete Group */}
                {canWrite && (
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
                )}
            </main>
        </div>
    );
}
