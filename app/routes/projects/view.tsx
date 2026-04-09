import { eq } from 'drizzle-orm';
import { useState } from 'react';
import { Link, useFetcher } from 'react-router';
import type { Route } from './+types/view';
import { requireMember } from '~/auth/auth.server';
import { Breadcrumbs } from '~/components/Breadcrumbs';
import { database } from '~/database/context';
import * as schema from '~/database/schema';
import { requireProjectAccess } from '~/utils/project-ownership.server';

export function meta({ data }: Route.MetaArgs) {
    return [ { title: data?.project ? `${data.project.name} - Sankey Scenarios` : 'Project Not Found' } ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
    const user = await requireMember(request);
    const db = database();
    const projectId = parseInt(params.projectId, 10);

    if (isNaN(projectId)) {
        throw new Response('Invalid project ID', { status: 400 });
    }

    // Use new access check that supports shares
    const access = await requireProjectAccess(request, projectId);

    const project = await db.query.projects.findFirst({
        where: eq(schema.projects.id, projectId),
        with: {
            user: {
                columns: { id: true, name: true }
            },
            scenarios: {
                orderBy: (scenarios, { desc }) => [ desc(scenarios.updatedAt) ]
            },
            groups: {
                orderBy: (groups, { desc }) => [ desc(groups.updatedAt) ]
            },
            nodes: {
                orderBy: (nodes, { desc }) => [ desc(nodes.updatedAt) ]
            },
            shares: {
                with: {
                    user: {
                        columns: { id: true, name: true, email: true }
                    }
                }
            }
        }
    });

    if (!project) {
        throw new Response('Project not found', { status: 404 });
    }

    return {
        project,
        permission: access.permission,
        isOwner: access.isOwner,
        canWrite: access.canWrite,
        currentUserId: user.id
    };
}

export default function ViewProject({ loaderData }: Route.ComponentProps) {
    const { project, permission, isOwner, canWrite, currentUserId } = loaderData;
    const [ showShareModal, setShowShareModal ] = useState(false);

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <Breadcrumbs items={[
                        { label: 'Home', to: '/' },
                        { label: 'Projects', to: '/projects' },
                        { label: project.name },
                    ]} />
                    <div className='flex items-center justify-between mt-2'>
                        <div>
                            <div className='flex items-center gap-3'>
                                <h1 className='text-3xl font-bold text-gray-900'>{project.name}</h1>
                                {!isOwner && (
                                    <span
                                        className={`px-2 py-1 rounded text-xs font-medium ${
                                            permission === 'readwrite'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-600'
                                        }`}
                                    >
                                        {permission === 'readwrite' ? 'Can Edit' : 'View Only'}
                                    </span>
                                )}
                            </div>
                            {project.description && <p className='text-gray-600 mt-1'>{project.description}</p>}
                            {!isOwner && <p className='text-sm text-gray-500 mt-1'>Shared by {project.user.name}</p>}
                        </div>
                        <div className='flex items-center gap-3'>
                            {isOwner && (
                                <button
                                    onClick={() => setShowShareModal(true)}
                                    className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2'
                                >
                                    <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                        <path
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                            strokeWidth={2}
                                            d='M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z'
                                        />
                                    </svg>
                                    Share
                                </button>
                            )}
                            {canWrite && (
                                <Link
                                    to={`/projects/${project.id}/edit`}
                                    className='px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors'
                                >
                                    Edit Project
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className='max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8'>
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
                    {/* Scenarios Section */}
                    <section>
                        <div className='flex items-center justify-between mb-4'>
                            <h2 className='text-xl font-semibold text-gray-900'>Scenarios</h2>
                            {canWrite && (
                                <Link
                                    to={`/projects/${project.id}/scenarios/new`}
                                    className='px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors'
                                >
                                    New Scenario
                                </Link>
                            )}
                        </div>

                        {project.scenarios.length === 0
                            ? (
                                <div className='text-center py-12 bg-white rounded-lg shadow'>
                                    <h3 className='text-lg font-medium text-gray-900 mb-2'>No scenarios yet</h3>
                                    <p className='text-gray-500 mb-6'>
                                        Create your first scenario to start building diagrams.
                                    </p>
                                    <Link
                                        to={`/projects/${project.id}/scenarios/new`}
                                        className='bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors'
                                    >
                                        Create Scenario
                                    </Link>
                                </div>
                            )
                            : (
                                <div className='space-y-3'>
                                    {project.scenarios.map(scenario => (
                                        <div
                                            key={scenario.id}
                                            className='bg-white rounded-lg shadow p-4 flex items-center justify-between'
                                        >
                                            <div className='flex-1 min-w-0'>
                                                <h3 className='font-semibold text-gray-900'>{scenario.name}</h3>
                                                {scenario.description && (
                                                    <p className='text-gray-600 text-sm mt-1 line-clamp-2'>
                                                        {scenario.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div className='flex items-center gap-2 ml-4'>
                                                <Link
                                                    to={`/projects/${project.id}/scenarios/${scenario.id}`}
                                                    className='p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors'
                                                    title='View diagram'
                                                >
                                                    <svg
                                                        className='w-5 h-5'
                                                        fill='none'
                                                        stroke='currentColor'
                                                        viewBox='0 0 24 24'
                                                    >
                                                        <path
                                                            strokeLinecap='round'
                                                            strokeLinejoin='round'
                                                            strokeWidth={2}
                                                            d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                                                        />
                                                        <path
                                                            strokeLinecap='round'
                                                            strokeLinejoin='round'
                                                            strokeWidth={2}
                                                            d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
                                                        />
                                                    </svg>
                                                </Link>
                                                <Link
                                                    to={`/projects/${project.id}/scenarios/${scenario.id}/edit`}
                                                    className='p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors'
                                                    title='Edit scenario'
                                                >
                                                    <svg
                                                        className='w-5 h-5'
                                                        fill='none'
                                                        stroke='currentColor'
                                                        viewBox='0 0 24 24'
                                                    >
                                                        <path
                                                            strokeLinecap='round'
                                                            strokeLinejoin='round'
                                                            strokeWidth={2}
                                                            d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
                                                        />
                                                    </svg>
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                    </section>

                    {/* Groups Section */}
                    <section>
                        <div className='flex items-center justify-between mb-4'>
                            <h2 className='text-xl font-semibold text-gray-900'>Reusable Groups</h2>
                            {canWrite && (
                                <Link
                                    to={`/projects/${project.id}/groups/new`}
                                    className='px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors'
                                >
                                    New Group
                                </Link>
                            )}
                        </div>

                        {project.groups.length === 0
                            ? (
                                <div className='text-center py-12 bg-white rounded-lg shadow'>
                                    <h3 className='text-lg font-medium text-gray-900 mb-2'>No groups yet</h3>
                                    <p className='text-gray-500 mb-6'>
                                        Create reusable connection groups to share across scenarios.
                                    </p>
                                    <Link
                                        to={`/projects/${project.id}/groups/new`}
                                        className='bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 transition-colors'
                                    >
                                        Create Group
                                    </Link>
                                </div>
                            )
                            : (
                                <div className='space-y-3'>
                                    {project.groups.map(group => (
                                        <Link
                                            key={group.id}
                                            to={`/projects/${project.id}/groups/${group.id}`}
                                            className='block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4'
                                        >
                                            <h3 className='font-semibold text-green-700'>{group.name}</h3>
                                            {group.description && (
                                                <p className='text-gray-600 text-sm mt-1 line-clamp-2'>
                                                    {group.description}
                                                </p>
                                            )}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        <Link
                            to={`/projects/${project.id}/groups`}
                            className='inline-block mt-4 text-sm text-green-600 hover:text-green-800'
                        >
                            View all groups →
                        </Link>
                    </section>
                </div>

                {/* Nodes Section */}
                <section className='mt-8'>
                    <div className='flex items-center justify-between mb-4'>
                        <h2 className='text-xl font-semibold text-gray-900'>Reusable Nodes</h2>
                        {canWrite && (
                            <Link
                                to={`/projects/${project.id}/nodes/new`}
                                className='px-4 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700 transition-colors'
                            >
                                New Node
                            </Link>
                        )}
                    </div>

                    {project.nodes.length === 0
                        ? (
                            <div className='text-center py-12 bg-white rounded-lg shadow'>
                                <h3 className='text-lg font-medium text-gray-900 mb-2'>No nodes yet</h3>
                                <p className='text-gray-500 mb-6'>
                                    Create reusable nodes with values to share across scenarios.
                                </p>
                                <Link
                                    to={`/projects/${project.id}/nodes/new`}
                                    className='bg-purple-600 text-white px-6 py-3 rounded-md hover:bg-purple-700 transition-colors'
                                >
                                    Create Node
                                </Link>
                            </div>
                        )
                        : (
                            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                                {project.nodes.map(node => (
                                    <Link
                                        key={node.id}
                                        to={`/projects/${project.id}/nodes/${node.id}`}
                                        className='block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4'
                                    >
                                        <div className='flex justify-between items-center'>
                                            <h3 className='font-semibold text-purple-700'>{node.name}</h3>
                                            <span className='bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-sm'>
                                                {node.value}
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    <Link
                        to={`/projects/${project.id}/nodes`}
                        className='inline-block mt-4 text-sm text-purple-600 hover:text-purple-800'
                    >
                        View all nodes →
                    </Link>
                </section>
            </main>

            {/* Share Modal */}
            {showShareModal && isOwner && (
                <ShareModal
                    projectId={project.id}
                    shares={project.shares}
                    onClose={() => setShowShareModal(false)}
                />
            )}
        </div>
    );
}

// Share Modal Component
function ShareModal({
    projectId,
    shares,
    onClose,
}: {
    projectId: number;
    shares: Array<{
        id: number;
        permission: string;
        user: { id: number; name: string; email: string };
    }>;
    onClose: () => void;
}) {
    const addShareFetcher = useFetcher();
    const updateFetcher = useFetcher();
    const removeFetcher = useFetcher();
    const [ email, setEmail ] = useState('');

    const isAdding = addShareFetcher.state !== 'idle';
    const error = addShareFetcher.data?.error;

    return (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
            <div className='bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col'>
                <div className='px-6 py-4 border-b flex items-center justify-between'>
                    <h2 className='text-lg font-semibold text-gray-900'>Share Project</h2>
                    <button onClick={onClose} className='text-gray-400 hover:text-gray-600'>
                        <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M6 18L18 6M6 6l12 12'
                            />
                        </svg>
                    </button>
                </div>

                <div className='px-6 py-4 flex-1 overflow-y-auto'>
                    {/* Add new collaborator */}
                    <addShareFetcher.Form method='post' action={`/api/projects/${projectId}/shares`} className='mb-6'>
                        <input type='hidden' name='intent' value='add-share' />
                        <label className='block text-sm font-medium text-gray-700 mb-2'>Add collaborator</label>
                        <div className='flex gap-2'>
                            <input
                                type='email'
                                name='email'
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder='Enter email address'
                                className='flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                            />
                            <select
                                name='permission'
                                className='px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                            >
                                <option value='readonly'>View only</option>
                                <option value='readwrite'>Can edit</option>
                            </select>
                            <button
                                type='submit'
                                disabled={isAdding || !email}
                                className='px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
                            >
                                {isAdding ? 'Adding...' : 'Add'}
                            </button>
                        </div>
                        {error && <p className='mt-2 text-sm text-red-600'>{error}</p>}
                    </addShareFetcher.Form>

                    {/* Current collaborators */}
                    <div>
                        <h3 className='text-sm font-medium text-gray-700 mb-3'>Current collaborators</h3>
                        {shares.length === 0
                            ? (
                                <p className='text-sm text-gray-500 py-4 text-center'>
                                    No collaborators yet. Add someone by email above.
                                </p>
                            )
                            : (
                                <div className='space-y-3'>
                                    {shares.map(share => (
                                        <div
                                            key={share.id}
                                            className='flex items-center justify-between py-2 border-b border-gray-100'
                                        >
                                            <div>
                                                <div className='font-medium text-gray-900'>{share.user.name}</div>
                                                <div className='text-sm text-gray-500'>{share.user.email}</div>
                                            </div>
                                            <div className='flex items-center gap-2'>
                                                <updateFetcher.Form
                                                    method='post'
                                                    action={`/api/projects/${projectId}/shares`}
                                                >
                                                    <input type='hidden' name='intent' value='update-permission' />
                                                    <input type='hidden' name='shareId' value={share.id} />
                                                    <select
                                                        name='permission'
                                                        defaultValue={share.permission}
                                                        onChange={e => e.currentTarget.form?.requestSubmit()}
                                                        className='px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                                    >
                                                        <option value='readonly'>View only</option>
                                                        <option value='readwrite'>Can edit</option>
                                                    </select>
                                                </updateFetcher.Form>
                                                <removeFetcher.Form
                                                    method='post'
                                                    action={`/api/projects/${projectId}/shares`}
                                                >
                                                    <input type='hidden' name='intent' value='remove-share' />
                                                    <input type='hidden' name='shareId' value={share.id} />
                                                    <button
                                                        type='submit'
                                                        className='p-1 text-gray-400 hover:text-red-600 transition-colors'
                                                        title='Remove access'
                                                    >
                                                        <svg
                                                            className='w-4 h-4'
                                                            fill='none'
                                                            stroke='currentColor'
                                                            viewBox='0 0 24 24'
                                                        >
                                                            <path
                                                                strokeLinecap='round'
                                                                strokeLinejoin='round'
                                                                strokeWidth={2}
                                                                d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                                                            />
                                                        </svg>
                                                    </button>
                                                </removeFetcher.Form>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                    </div>
                </div>

                <div className='px-6 py-4 border-t bg-gray-50'>
                    <button
                        onClick={onClose}
                        className='w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors'
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
