import { Form, Link, redirect } from 'react-router';
import type { Route } from './+types/new';
import { database } from '~/database/context';
import * as schema from '~/database/schema';
import { requireProjectWriteAccess, parseProjectId } from '~/utils/project-ownership.server';

export function meta({ data }: Route.MetaArgs) {
    return [ { title: data?.project ? `New Scenario - ${data.project.name}` : 'New Scenario' } ];
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
        return { error: 'Scenario name is required' };
    }

    const db = database();

    const [ scenario ] = await db.insert(schema.scenarios).values({
        projectId,
        name: name.trim(),
        description: typeof description === 'string' ? description.trim() || null : null
    }).returning({ id: schema.scenarios.id });

    return redirect(`/projects/${projectId}/scenarios/${scenario.id}`);
}

export default function NewScenario({ loaderData, actionData }: Route.ComponentProps) {
    const { project } = loaderData;

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <Link to={`/projects/${project.id}`} className='text-sm text-gray-500 hover:text-gray-700'>
                        ← Back to {project.name}
                    </Link>
                    <h1 className='text-3xl font-bold text-gray-900 mt-2'>New Scenario</h1>
                </div>
            </header>

            <main className='max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8'>
                <Form method='post' className='bg-white rounded-lg shadow p-6'>
                    {actionData?.error && (
                        <div className='mb-4 p-4 bg-red-50 text-red-700 rounded-md'>{actionData.error}</div>
                    )}

                    <div className='mb-6'>
                        <label htmlFor='name' className='block text-sm font-medium text-gray-700 mb-2'>
                            Scenario Name *
                        </label>
                        <input
                            type='text'
                            id='name'
                            name='name'
                            required
                            className='w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                            placeholder='Base Budget'
                        />
                    </div>

                    <div className='mb-6'>
                        <label htmlFor='description' className='block text-sm font-medium text-gray-700 mb-2'>
                            Description
                        </label>
                        <textarea
                            id='description'
                            name='description'
                            rows={3}
                            className='w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                            placeholder='Optional description...'
                        />
                    </div>

                    <div className='flex justify-end gap-4'>
                        <Link
                            to={`/projects/${project.id}`}
                            className='px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors'
                        >
                            Cancel
                        </Link>
                        <button
                            type='submit'
                            className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
                        >
                            Create Scenario
                        </button>
                    </div>
                </Form>
            </main>
        </div>
    );
}
