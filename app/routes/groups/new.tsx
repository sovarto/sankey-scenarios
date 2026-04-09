import { Form, Link, redirect } from 'react-router';
import type { Route } from './+types/new';
import { Breadcrumbs } from '~/components/Breadcrumbs';
import { database } from '~/database/context';
import * as schema from '~/database/schema';
import { requireProjectWriteAccess, parseProjectId } from '~/utils/project-ownership.server';

export function meta({ data }: Route.MetaArgs) {
    return [ { title: data?.project ? `New Group - ${data.project.name}` : 'New Group' } ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
    const projectId = parseProjectId(params.projectId);
    const { project } = await requireProjectWriteAccess(request, projectId);
    return { project };
}

export async function action({ request, params }: Route.ActionArgs) {
    const projectId = parseProjectId(params.projectId);
    await requireProjectWriteAccess(request, projectId);

    const formData = await request.formData();
    const name = formData.get('name');
    const description = formData.get('description');

    if (typeof name !== 'string' || !name.trim()) {
        return { error: 'Group name is required' };
    }

    const db = database();

    const [ group ] = await db.insert(schema.groups).values({
        projectId,
        name: name.trim(),
        description: typeof description === 'string' ? description.trim() || null : null
    }).returning({ id: schema.groups.id });

    return redirect(`/projects/${projectId}/groups/${group.id}`);
}

export default function NewGroup({ loaderData, actionData }: Route.ComponentProps) {
    const { project } = loaderData;

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <Breadcrumbs items={[
                        { label: 'Home', to: '/' },
                        { label: project.name, to: `/projects/${project.id}` },
                        { label: 'Groups', to: `/projects/${project.id}/groups` },
                        { label: 'New Group' },
                    ]} />
                    <h1 className='text-3xl font-bold text-gray-900 mt-2'>New Group</h1>
                </div>
            </header>

            <main className='max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8'>
                <Form method='post' className='bg-white rounded-lg shadow p-6'>
                    {actionData?.error && (
                        <div className='mb-4 p-4 bg-red-50 text-red-700 rounded-md'>{actionData.error}</div>
                    )}

                    <div className='mb-6'>
                        <label htmlFor='name' className='block text-sm font-medium text-gray-700 mb-2'>
                            Group Name *
                        </label>
                        <input
                            type='text'
                            id='name'
                            name='name'
                            required
                            className='w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500'
                            placeholder='Expenses'
                        />
                        <p className='text-sm text-gray-500 mt-1'>
                            A descriptive name for this reusable connection group (e.g., "Expenses", "Income Sources")
                        </p>
                    </div>

                    <div className='mb-6'>
                        <label htmlFor='description' className='block text-sm font-medium text-gray-700 mb-2'>
                            Description
                        </label>
                        <textarea
                            id='description'
                            name='description'
                            rows={3}
                            className='w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500'
                            placeholder='Optional description of what this group represents...'
                        />
                    </div>

                    <div className='flex justify-end gap-4'>
                        <Link
                            to={`/projects/${project.id}/groups`}
                            className='px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors'
                        >
                            Cancel
                        </Link>
                        <button
                            type='submit'
                            className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors'
                        >
                            Create Group
                        </button>
                    </div>
                </Form>
            </main>
        </div>
    );
}
