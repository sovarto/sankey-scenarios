import { eq } from 'drizzle-orm';
import { Link } from 'react-router';
import type { Route } from './+types/index';
import { requireMember } from '~/auth/auth.server';
import { Breadcrumbs } from '~/components/Breadcrumbs';
import { database } from '~/database/context';
import * as schema from '~/database/schema';

export function meta({}: Route.MetaArgs) {
    return [ { title: 'Projects - Sankey Scenarios' } ];
}

export async function loader({ request }: Route.LoaderArgs) {
    const user = await requireMember(request);
    const db = database();

    // Get owned projects
    const ownedProjects = await db.query.projects.findMany({
        where: eq(schema.projects.userId, user.id),
        orderBy: (projects, { desc }) => [ desc(projects.updatedAt) ],
        with: {
            scenarios: {
                columns: { id: true }
            }
        }
    });

    // Get shared projects
    const sharedWithMe = await db.query.projectShares.findMany({
        where: eq(schema.projectShares.userId, user.id),
        with: {
            project: {
                with: {
                    user: {
                        columns: { name: true }
                    },
                    scenarios: {
                        columns: { id: true }
                    }
                }
            }
        }
    });

    return {
        ownedProjects,
        sharedProjects: sharedWithMe.map(share => ({
            ...share.project,
            permission: share.permission,
            ownerName: share.project.user.name
        }))
    };
}

export default function ProjectsIndex({ loaderData }: Route.ComponentProps) {
    const { ownedProjects, sharedProjects } = loaderData;

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <div className='flex items-center justify-between'>
                        <div>
                            <Breadcrumbs items={[
                                { label: 'Home', to: '/' },
                                { label: 'Projects' },
                            ]} />
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
                {/* My Projects */}
                <section className='mb-10'>
                    <h2 className='text-xl font-semibold text-gray-900 mb-4'>My Projects</h2>
                    {ownedProjects.length === 0
                        ? (
                            <div className='text-center py-12 bg-white rounded-lg shadow'>
                                <h3 className='text-lg font-medium text-gray-900 mb-2'>No projects yet</h3>
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
                                {ownedProjects.map(project => (
                                    <Link
                                        key={project.id}
                                        to={`/projects/${project.id}`}
                                        className='block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6'
                                    >
                                        <h3 className='text-xl font-semibold text-gray-900 mb-2'>{project.name}</h3>
                                        {project.description && (
                                            <p className='text-gray-600 text-sm mb-4 line-clamp-2'>
                                                {project.description}
                                            </p>
                                        )}
                                        <div className='text-sm text-gray-500'>
                                            {project.scenarios.length} scenario
                                            {project.scenarios.length !== 1 ? 's' : ''}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                </section>

                {/* Shared with me */}
                {sharedProjects.length > 0 && (
                    <section>
                        <h2 className='text-xl font-semibold text-gray-900 mb-4'>Shared with me</h2>
                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                            {sharedProjects.map(project => (
                                <Link
                                    key={project.id}
                                    to={`/projects/${project.id}`}
                                    className='block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 border-l-4 border-blue-400'
                                >
                                    <div className='flex items-start justify-between'>
                                        <h3 className='text-xl font-semibold text-gray-900 mb-2'>{project.name}</h3>
                                        <span
                                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                project.permission === 'readwrite'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-gray-100 text-gray-600'
                                            }`}
                                        >
                                            {project.permission === 'readwrite' ? 'Edit' : 'View'}
                                        </span>
                                    </div>
                                    {project.description && (
                                        <p className='text-gray-600 text-sm mb-4 line-clamp-2'>{project.description}</p>
                                    )}
                                    <div className='flex justify-between items-center text-sm text-gray-500'>
                                        <span>
                                            {project.scenarios.length} scenario
                                            {project.scenarios.length !== 1 ? 's' : ''}
                                        </span>
                                        <span>by {project.ownerName}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
