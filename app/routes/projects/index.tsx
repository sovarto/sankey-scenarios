import { eq } from 'drizzle-orm';
import { Link } from 'react-router';
import type { Route } from './+types/index';
import { requireMember } from '~/auth/auth.server';
import { database } from '~/database/context';
import * as schema from '~/database/schema';

export function meta({}: Route.MetaArgs) {
    return [ { title: 'Projects - Sankey Scenarios' } ];
}

export async function loader({ request }: Route.LoaderArgs) {
    const user = await requireMember(request);
    const db = database();

    const projects = await db.query.projects.findMany({
        where: eq(schema.projects.userId, user.id),
        orderBy: (projects, { desc }) => [ desc(projects.updatedAt) ],
        with: {
            scenarios: {
                columns: { id: true }
            }
        }
    });

    return { projects };
}

export default function ProjectsIndex({ loaderData }: Route.ComponentProps) {
    const { projects } = loaderData;

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <div className='flex items-center justify-between'>
                        <div>
                            <Link to='/' className='text-sm text-gray-500 hover:text-gray-700'>← Back to Home</Link>
                            <h1 className='text-3xl font-bold text-gray-900 mt-2'>Projects</h1>
                        </div>
                        <Link
                            to='/projects/new'
                            className='bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors'
                        >
                            New Project
                        </Link>
                    </div>
                </div>
            </header>

            <main className='max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8'>
                {projects.length === 0
                    ? (
                        <div className='text-center py-12 bg-white rounded-lg shadow'>
                            <h2 className='text-xl font-medium text-gray-900 mb-2'>No projects yet</h2>
                            <p className='text-gray-500 mb-6'>
                                Create your first project to start building Sankey diagrams.
                            </p>
                            <Link
                                to='/projects/new'
                                className='bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors'
                            >
                                Create Project
                            </Link>
                        </div>
                    )
                    : (
                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                            {projects.map(project => (
                                <Link
                                    key={project.id}
                                    to={`/projects/${project.id}`}
                                    className='block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6'
                                >
                                    <h2 className='text-xl font-semibold text-gray-900 mb-2'>{project.name}</h2>
                                    {project.description && (
                                        <p className='text-gray-600 text-sm mb-4 line-clamp-2'>{project.description}</p>
                                    )}
                                    <div className='text-sm text-gray-500'>
                                        {project.scenarios.length} scenario
                                        {project.scenarios.length !== 1 ? 's' : ''}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
            </main>
        </div>
    );
}
