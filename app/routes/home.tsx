import { eq } from 'drizzle-orm';
import { Form, Link } from 'react-router';
import type { Route } from './+types/home';
import { requireMember } from '~/auth/auth.server';
import { database } from '~/database/context';
import * as schema from '~/database/schema';

export function meta({}: Route.MetaArgs) {
    return [ { title: 'Sankey Scenarios' }, {
        name: 'description',
        content: 'Create and manage Sankey diagrams with reusable groups'
    } ];
}

export async function loader({ request }: Route.LoaderArgs) {
    const user = await requireMember(request);
    const db = database();

    const projects = await db.query.projects.findMany({
        where: eq(schema.projects.userId, user.id),
        columns: { id: true, name: true },
        orderBy: (projects, { desc }) => [ desc(projects.updatedAt) ],
        limit: 5,
        with: {
            scenarios: { columns: { id: true } },
            groups: { columns: { id: true } }
        }
    });

    return { projects, user };
}

export default function Home({ loaderData }: Route.ComponentProps) {
    const { projects, user } = loaderData;
    const isAdmin = user.roles.includes('admin');

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <div className='flex items-center justify-between'>
                        <div>
                            <h1 className='text-3xl font-bold text-gray-900'>Sankey Scenarios</h1>
                            <p className='mt-1 text-gray-500'>
                                Create and manage Sankey diagrams with reusable connection groups
                            </p>
                        </div>
                        <div className='flex items-center gap-4'>
                            {isAdmin && (
                                <Link to='/admin/users' className='text-sm text-gray-600 hover:text-gray-900'>
                                    User Management
                                </Link>
                            )}
                            <div className='flex items-center gap-3'>
                                <span className='text-sm text-gray-600'>{user.name}</span>
                                <Form action='/logout' method='post'>
                                    <button type='submit' className='text-sm text-gray-500 hover:text-gray-700'>
                                        Sign out
                                    </button>
                                </Form>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className='max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8'>
                {/* Projects Section */}
                <section className='bg-white rounded-lg shadow p-6 mb-8'>
                    <div className='flex items-center justify-between mb-4'>
                        <h2 className='text-xl font-semibold text-gray-900'>Projects</h2>
                        <Link
                            to='/projects/new'
                            className='bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors'
                        >
                            New Project
                        </Link>
                    </div>
                    {projects.length === 0
                        ? (
                            <p className='text-gray-500 text-sm'>
                                No projects yet. Create your first project to get started!
                            </p>
                        )
                        : (
                            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                                {projects.map(project => (
                                    <Link
                                        key={project.id}
                                        to={`/projects/${project.id}`}
                                        className='block p-4 rounded-md border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors'
                                    >
                                        <span className='text-blue-600 font-medium'>{project.name}</span>
                                        <div className='text-xs text-gray-500 mt-1'>
                                            {project.scenarios.length} scenarios · {project.groups.length} groups
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    <Link to='/projects' className='inline-block mt-4 text-sm text-blue-600 hover:text-blue-800'>
                        View all projects →
                    </Link>
                </section>

                {/* How it works */}
                <section className='bg-white rounded-lg shadow p-6'>
                    <h2 className='text-xl font-semibold text-gray-900 mb-4'>How it works</h2>
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                        <div className='text-center'>
                            <div className='bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3'>
                                <span className='text-blue-600 font-bold'>1</span>
                            </div>
                            <h3 className='font-medium text-gray-900'>Create Projects</h3>
                            <p className='text-sm text-gray-500 mt-1'>Projects contain scenarios and reusable groups</p>
                        </div>
                        <div className='text-center'>
                            <div className='bg-green-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3'>
                                <span className='text-green-600 font-bold'>2</span>
                            </div>
                            <h3 className='font-medium text-gray-900'>Define Groups</h3>
                            <p className='text-sm text-gray-500 mt-1'>
                                Create reusable connection groups within a project
                            </p>
                        </div>
                        <div className='text-center'>
                            <div className='bg-purple-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3'>
                                <span className='text-purple-600 font-bold'>3</span>
                            </div>
                            <h3 className='font-medium text-gray-900'>Build Scenarios</h3>
                            <p className='text-sm text-gray-500 mt-1'>Mix direct connections with group references</p>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
