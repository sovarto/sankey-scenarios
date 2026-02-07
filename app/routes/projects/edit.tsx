import { eq, and } from 'drizzle-orm';
import { Form, Link, redirect } from 'react-router';
import type { Route } from './+types/edit';
import { requireMember } from '~/auth/auth.server';
import { database } from '~/database/context';
import * as schema from '~/database/schema';

export function meta({ data }: Route.MetaArgs) {
    return [ { title: data?.project ? `Edit ${data.project.name} - Sankey Scenarios` : 'Edit Project' } ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
    const user = await requireMember(request);
    const db = database();
    const projectId = parseInt(params.projectId, 10);

    if (isNaN(projectId)) {
        throw new Response('Invalid project ID', { status: 400 });
    }

    const project = await db.query.projects.findFirst({
        where: and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.id))
    });

    if (!project) {
        throw new Response('Project not found', { status: 404 });
    }

    return { project };
}

export async function action({ request, params }: Route.ActionArgs) {
    const user = await requireMember(request);
    const formData = await request.formData();
    const intent = formData.get('intent');
    const projectId = parseInt(params.projectId, 10);

    if (isNaN(projectId)) {
        throw new Response('Invalid project ID', { status: 400 });
    }

    const db = database();

    // Verify ownership
    const project = await db.query.projects.findFirst({
        where: and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.id)),
        columns: { id: true }
    });

    if (!project) {
        throw new Response('Project not found', { status: 404 });
    }

    if (intent === 'delete') {
        await db.delete(schema.projects).where(eq(schema.projects.id, projectId));
        return redirect('/projects');
    }

    const name = formData.get('name');
    const description = formData.get('description');

    if (typeof name !== 'string' || !name.trim()) {
        return { error: 'Project name is required' };
    }

    await db.update(schema.projects).set({
        name: name.trim(),
        description: typeof description === 'string' ? description.trim() || null : null,
        updatedAt: new Date()
    }).where(eq(schema.projects.id, projectId));

    return redirect(`/projects/${projectId}`);
}

export default function EditProject({ loaderData, actionData }: Route.ComponentProps) {
    const { project } = loaderData;

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <Link to={`/projects/${project.id}`} className='text-sm text-gray-500 hover:text-gray-700'>
                        ← Back to Project
                    </Link>
                    <h1 className='text-3xl font-bold text-gray-900 mt-2'>Edit Project</h1>
                </div>
            </header>

            <main className='max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8'>
                <Form method='post' className='bg-white rounded-lg shadow p-6'>
                    {actionData?.error && (
                        <div className='mb-4 p-4 bg-red-50 text-red-700 rounded-md'>{actionData.error}</div>
                    )}

                    <div className='mb-6'>
                        <label htmlFor='name' className='block text-sm font-medium text-gray-700 mb-2'>
                            Project Name *
                        </label>
                        <input
                            type='text'
                            id='name'
                            name='name'
                            required
                            defaultValue={project.name}
                            className='w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
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
                            defaultValue={project.description ?? ''}
                            className='w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                        />
                    </div>

                    <div className='flex justify-between'>
                        <button
                            type='submit'
                            name='intent'
                            value='delete'
                            className='px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors'
                            onClick={e => {
                                if (!confirm('Are you sure you want to delete this project?')) {
                                    e.preventDefault();
                                }
                            }}
                        >
                            Delete Project
                        </button>
                        <div className='flex gap-4'>
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
                                Save Changes
                            </button>
                        </div>
                    </div>
                </Form>
            </main>
        </div>
    );
}
