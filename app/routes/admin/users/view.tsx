import { eq } from 'drizzle-orm';
import { Form, Link, redirect, useNavigation } from 'react-router';
import type { Route } from './+types/view';
import { requireAdmin } from '~/auth/auth.server';
import { hashPassword, generateToken } from '~/auth/password.server';
import { deleteAllUserSessions } from '~/auth/session.server';
import { database } from '~/database/context';
import * as schema from '~/database/schema';

export function meta({ data }: Route.MetaArgs) {
    return [ { title: data ? `${data.user.name} - User Management` : 'User - Sankey Scenarios' } ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
    const admin = await requireAdmin(request);

    const db = database();
    const userId = parseInt(params.userId);

    const user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId),
        with: {
            userRoles: {
                with: { role: true }
            }
        }
    });

    if (!user) {
        throw new Response('User not found', { status: 404 });
    }

    const allRoles = await db.query.roles.findMany();

    return {
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            status: user.status,
            roles: user.userRoles.map(ur => ur.role.name),
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString()
        },
        allRoles: allRoles.map(r => ({ id: r.id, name: r.name })),
        currentAdminId: admin.id
    };
}

export async function action({ request, params }: Route.ActionArgs) {
    const admin = await requireAdmin(request);
    const db = database();
    const userId = parseInt(params.userId);

    // Prevent self-modification for critical actions
    const isSelf = admin.id === userId;

    const formData = await request.formData();
    const intent = formData.get('intent');

    switch (intent) {
        case 'approve': {
            await db.update(schema.users).set({
                status: 'active',
                updatedAt: new Date()
            }).where(eq(schema.users.id, userId));
            break;
        }
        case 'block': {
            if (isSelf) {
                return { error: 'You cannot block yourself' };
            }
            await db.update(schema.users).set({
                status: 'blocked',
                updatedAt: new Date()
            }).where(eq(schema.users.id, userId));
            // End all sessions
            await deleteAllUserSessions(userId);
            break;
        }
        case 'unblock': {
            await db.update(schema.users).set({
                status: 'active',
                updatedAt: new Date()
            }).where(eq(schema.users.id, userId));
            break;
        }
        case 'reset-password': {
            // Generate a random password
            const tempPassword = generateToken().substring(0, 12);
            const passwordHash = await hashPassword(tempPassword);

            await db.update(schema.users).set({
                passwordHash,
                resetToken: null,
                resetTokenExpiresAt: null,
                updatedAt: new Date()
            }).where(eq(schema.users.id, userId));

            // End all sessions
            await deleteAllUserSessions(userId);

            return { tempPassword };
        }
        case 'delete': {
            if (isSelf) {
                return { error: 'You cannot delete yourself' };
            }
            await db.delete(schema.users).where(eq(schema.users.id, userId));
            return redirect('/admin/users');
        }
        case 'update-roles': {
            const roles = formData.getAll('roles');
            const roleNames = roles.filter(r => typeof r === 'string') as string[];

            // Get role IDs
            const roleRecords = await db.query.roles.findMany();
            const roleMap = new Map(roleRecords.map(r => [ r.name, r.id ]));

            // Prevent removing admin role from self
            if (isSelf && !roleNames.includes('admin')) {
                return { error: 'You cannot remove the admin role from yourself' };
            }

            // Delete existing roles
            await db.delete(schema.userRoles).where(eq(schema.userRoles.userId, userId));

            // Add new roles
            for (const roleName of roleNames) {
                const roleId = roleMap.get(roleName);
                if (roleId) {
                    await db.insert(schema.userRoles).values({
                        userId,
                        roleId
                    });
                }
            }
            break;
        }
    }

    return { success: true };
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        pending: 'bg-yellow-100 text-yellow-800',
        active: 'bg-green-100 text-green-800',
        blocked: 'bg-red-100 text-red-800'
    };

    return (
        <span
            className={`px-3 py-1 text-sm font-medium rounded-full ${
                styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'
            }`}
        >
            {status}
        </span>
    );
}

export default function UserView({ loaderData, actionData }: Route.ComponentProps) {
    const { user, allRoles, currentAdminId } = loaderData;
    const navigation = useNavigation();
    const isSubmitting = navigation.state === 'submitting';
    const isSelf = currentAdminId === user.id;

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <Link to='/admin/users' className='text-sm text-gray-500 hover:text-gray-700'>← Back to Users</Link>
                    <div className='flex items-center justify-between mt-2'>
                        <div>
                            <h1 className='text-3xl font-bold text-gray-900'>{user.name}</h1>
                            <p className='text-gray-500'>{user.email}</p>
                        </div>
                        <StatusBadge status={user.status} />
                    </div>
                </div>
            </header>

            <main className='max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8'>
                {actionData?.error && (
                    <div className='mb-6 p-4 bg-red-50 text-red-700 rounded-md'>{actionData.error}</div>
                )}

                {actionData?.tempPassword && (
                    <div className='mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md'>
                        <h3 className='font-medium text-yellow-800 mb-2'>Password Reset Successful</h3>
                        <p className='text-sm text-yellow-700 mb-2'>
                            The user's password has been reset. Please share this temporary password with them:
                        </p>
                        <code className='block p-2 bg-white border rounded text-sm font-mono'>
                            {actionData.tempPassword}
                        </code>
                        <p className='text-xs text-yellow-600 mt-2'>
                            This password will only be shown once. The user should change it after logging in.
                        </p>
                    </div>
                )}

                {isSelf && (
                    <div className='mb-6 p-4 bg-blue-50 text-blue-700 rounded-md'>
                        This is your own account. Some actions are restricted.
                    </div>
                )}

                {/* User Info */}
                <div className='bg-white rounded-lg shadow p-6 mb-6'>
                    <h2 className='text-lg font-semibold text-gray-900 mb-4'>User Information</h2>
                    <dl className='grid grid-cols-2 gap-4'>
                        <div>
                            <dt className='text-sm font-medium text-gray-500'>User ID</dt>
                            <dd className='text-sm text-gray-900'>{user.id}</dd>
                        </div>
                        <div>
                            <dt className='text-sm font-medium text-gray-500'>Status</dt>
                            <dd>
                                <StatusBadge status={user.status} />
                            </dd>
                        </div>
                        <div>
                            <dt className='text-sm font-medium text-gray-500'>Joined</dt>
                            <dd className='text-sm text-gray-900'>{new Date(user.createdAt).toLocaleString()}</dd>
                        </div>
                        <div>
                            <dt className='text-sm font-medium text-gray-500'>Last Updated</dt>
                            <dd className='text-sm text-gray-900'>{new Date(user.updatedAt).toLocaleString()}</dd>
                        </div>
                    </dl>
                </div>

                {/* Status Actions */}
                <div className='bg-white rounded-lg shadow p-6 mb-6'>
                    <h2 className='text-lg font-semibold text-gray-900 mb-4'>Status Actions</h2>
                    <div className='flex flex-wrap gap-3'>
                        {user.status === 'pending' && (
                            <Form method='post'>
                                <input type='hidden' name='intent' value='approve' />
                                <button
                                    type='submit'
                                    disabled={isSubmitting}
                                    className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50'
                                >
                                    Approve User
                                </button>
                            </Form>
                        )}
                        {user.status === 'active' && !isSelf && (
                            <Form method='post'>
                                <input type='hidden' name='intent' value='block' />
                                <button
                                    type='submit'
                                    disabled={isSubmitting}
                                    className='px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50'
                                >
                                    Block User
                                </button>
                            </Form>
                        )}
                        {user.status === 'blocked' && (
                            <Form method='post'>
                                <input type='hidden' name='intent' value='unblock' />
                                <button
                                    type='submit'
                                    disabled={isSubmitting}
                                    className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50'
                                >
                                    Unblock User
                                </button>
                            </Form>
                        )}
                    </div>
                </div>

                {/* Roles */}
                <div className='bg-white rounded-lg shadow p-6 mb-6'>
                    <h2 className='text-lg font-semibold text-gray-900 mb-4'>Roles</h2>
                    <Form method='post'>
                        <input type='hidden' name='intent' value='update-roles' />
                        <div className='space-y-2 mb-4'>
                            {allRoles.map(role => (
                                <label key={role.id} className='flex items-center'>
                                    <input
                                        type='checkbox'
                                        name='roles'
                                        value={role.name}
                                        defaultChecked={user.roles.includes(role.name)}
                                        disabled={isSelf && role.name === 'admin'}
                                        className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                                    />
                                    <span className='ml-2 text-sm text-gray-700 capitalize'>{role.name}</span>
                                    {isSelf && role.name === 'admin' && (
                                        <span className='ml-2 text-xs text-gray-500'>(cannot remove from self)</span>
                                    )}
                                </label>
                            ))}
                        </div>
                        <button
                            type='submit'
                            disabled={isSubmitting}
                            className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50'
                        >
                            Update Roles
                        </button>
                    </Form>
                </div>

                {/* Password Reset */}
                <div className='bg-white rounded-lg shadow p-6 mb-6'>
                    <h2 className='text-lg font-semibold text-gray-900 mb-4'>Password Management</h2>
                    <p className='text-sm text-gray-500 mb-4'>
                        Reset the user's password. A new temporary password will be generated.
                    </p>
                    <Form method='post'>
                        <input type='hidden' name='intent' value='reset-password' />
                        <button
                            type='submit'
                            disabled={isSubmitting}
                            className='px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50'
                        >
                            Reset Password
                        </button>
                    </Form>
                </div>

                {/* Danger Zone */}
                {!isSelf && (
                    <div className='bg-white rounded-lg shadow p-6 border-2 border-red-200'>
                        <h2 className='text-lg font-semibold text-red-600 mb-4'>Danger Zone</h2>
                        <p className='text-sm text-gray-500 mb-4'>
                            Permanently delete this user account. This action cannot be undone.
                        </p>
                        <Form
                            method='post'
                            onSubmit={e => {
                                if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) {
                                    e.preventDefault();
                                }
                            }}
                        >
                            <input type='hidden' name='intent' value='delete' />
                            <button
                                type='submit'
                                disabled={isSubmitting}
                                className='px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50'
                            >
                                Delete User
                            </button>
                        </Form>
                    </div>
                )}
            </main>
        </div>
    );
}
