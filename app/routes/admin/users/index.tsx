import { Link } from 'react-router';
import type { Route } from './+types/index';
import { requireAdmin } from '~/auth/auth.server';
import { database } from '~/database/context';

export function meta({}: Route.MetaArgs) {
    return [ { title: 'User Management - Sankey Scenarios' } ];
}

export async function loader({ request }: Route.LoaderArgs) {
    await requireAdmin(request);

    const db = database();

    const users = await db.query.users.findMany({
        orderBy: (users, { desc }) => [ desc(users.createdAt) ],
        with: {
            userRoles: {
                with: { role: true }
            }
        }
    });

    // Count by status
    const pendingCount = users.filter(u => u.status === 'pending').length;
    const activeCount = users.filter(u => u.status === 'active').length;
    const blockedCount = users.filter(u => u.status === 'blocked').length;

    return {
        users: users.map(u => ({
            id: u.id,
            email: u.email,
            name: u.name,
            status: u.status,
            roles: u.userRoles.map(ur => ur.role.name),
            createdAt: u.createdAt.toISOString()
        })),
        stats: { pendingCount, activeCount, blockedCount }
    };
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        pending: 'bg-yellow-100 text-yellow-800',
        active: 'bg-green-100 text-green-800',
        blocked: 'bg-red-100 text-red-800'
    };

    return (
        <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
                styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'
            }`}
        >
            {status}
        </span>
    );
}

function RoleBadge({ role }: { role: string }) {
    const styles = {
        admin: 'bg-purple-100 text-purple-800',
        member: 'bg-blue-100 text-blue-800'
    };

    return (
        <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
                styles[role as keyof typeof styles] || 'bg-gray-100 text-gray-800'
            }`}
        >
            {role}
        </span>
    );
}

export default function UsersIndex({ loaderData }: Route.ComponentProps) {
    const { users, stats } = loaderData;

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <Link to='/' className='text-sm text-gray-500 hover:text-gray-700'>← Back to Home</Link>
                    <h1 className='text-3xl font-bold text-gray-900 mt-2'>User Management</h1>
                </div>
            </header>

            <main className='max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8'>
                {/* Stats Cards */}
                <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-8'>
                    <div className='bg-white rounded-lg shadow p-6'>
                        <div className='flex items-center'>
                            <div className='flex-shrink-0'>
                                <div className='rounded-full bg-yellow-100 p-3'>
                                    <svg
                                        className='h-6 w-6 text-yellow-600'
                                        fill='none'
                                        viewBox='0 0 24 24'
                                        stroke='currentColor'
                                    >
                                        <path
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                            strokeWidth={2}
                                            d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                                        />
                                    </svg>
                                </div>
                            </div>
                            <div className='ml-4'>
                                <p className='text-sm font-medium text-gray-500'>Pending Approval</p>
                                <p className='text-2xl font-semibold text-gray-900'>{stats.pendingCount}</p>
                            </div>
                        </div>
                    </div>
                    <div className='bg-white rounded-lg shadow p-6'>
                        <div className='flex items-center'>
                            <div className='flex-shrink-0'>
                                <div className='rounded-full bg-green-100 p-3'>
                                    <svg
                                        className='h-6 w-6 text-green-600'
                                        fill='none'
                                        viewBox='0 0 24 24'
                                        stroke='currentColor'
                                    >
                                        <path
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                            strokeWidth={2}
                                            d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                                        />
                                    </svg>
                                </div>
                            </div>
                            <div className='ml-4'>
                                <p className='text-sm font-medium text-gray-500'>Active Users</p>
                                <p className='text-2xl font-semibold text-gray-900'>{stats.activeCount}</p>
                            </div>
                        </div>
                    </div>
                    <div className='bg-white rounded-lg shadow p-6'>
                        <div className='flex items-center'>
                            <div className='flex-shrink-0'>
                                <div className='rounded-full bg-red-100 p-3'>
                                    <svg
                                        className='h-6 w-6 text-red-600'
                                        fill='none'
                                        viewBox='0 0 24 24'
                                        stroke='currentColor'
                                    >
                                        <path
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                            strokeWidth={2}
                                            d='M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'
                                        />
                                    </svg>
                                </div>
                            </div>
                            <div className='ml-4'>
                                <p className='text-sm font-medium text-gray-500'>Blocked</p>
                                <p className='text-2xl font-semibold text-gray-900'>{stats.blockedCount}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Users Table */}
                <div className='bg-white rounded-lg shadow overflow-hidden'>
                    <table className='min-w-full divide-y divide-gray-200'>
                        <thead className='bg-gray-50'>
                            <tr>
                                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                    User
                                </th>
                                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                    Status
                                </th>
                                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                    Roles
                                </th>
                                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                    Joined
                                </th>
                                <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className='bg-white divide-y divide-gray-200'>
                            {users.map(user => (
                                <tr key={user.id} className='hover:bg-gray-50'>
                                    <td className='px-6 py-4 whitespace-nowrap'>
                                        <div>
                                            <div className='text-sm font-medium text-gray-900'>{user.name}</div>
                                            <div className='text-sm text-gray-500'>{user.email}</div>
                                        </div>
                                    </td>
                                    <td className='px-6 py-4 whitespace-nowrap'>
                                        <StatusBadge status={user.status} />
                                    </td>
                                    <td className='px-6 py-4 whitespace-nowrap'>
                                        <div className='flex gap-1'>
                                            {user.roles.map(role => <RoleBadge key={role} role={role} />)}
                                        </div>
                                    </td>
                                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium'>
                                        <Link
                                            to={`/admin/users/${user.id}`}
                                            className='text-blue-600 hover:text-blue-900'
                                        >
                                            Manage
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {users.length === 0 && <div className='text-center py-12 text-gray-500'>No users found</div>}
                </div>
            </main>
        </div>
    );
}
