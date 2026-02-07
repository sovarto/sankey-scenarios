import { Form, Link, useSearchParams } from 'react-router';
import type { Route } from './+types/reset-password';
import { resetPassword } from '~/auth/auth.server';

export function meta({}: Route.MetaArgs) {
    return [ { title: 'Reset Password - Sankey Scenarios' } ];
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const token = formData.get('token');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');

    if (typeof token !== 'string' || !token) {
        return { error: 'Invalid reset link' };
    }

    if (typeof password !== 'string' || !password) {
        return { error: 'Password is required' };
    }

    if (password.length < 8) {
        return { error: 'Password must be at least 8 characters long' };
    }

    if (password !== confirmPassword) {
        return { error: 'Passwords do not match' };
    }

    const result = await resetPassword(token, password);

    if (!result.success) {
        return { error: result.error };
    }

    return { success: true };
}

export default function ResetPassword({ actionData }: Route.ComponentProps) {
    const [ searchParams ] = useSearchParams();
    const token = searchParams.get('token');

    if (actionData?.success) {
        return (
            <div className='min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
                <div className='sm:mx-auto sm:w-full sm:max-w-md'>
                    <h1 className='text-center text-3xl font-bold text-gray-900'>Sankey Scenarios</h1>
                </div>

                <div className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
                    <div className='bg-white py-8 px-4 shadow rounded-lg sm:px-10 text-center'>
                        <div className='text-green-600 mb-4'>
                            <svg className='mx-auto h-12 w-12' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                                />
                            </svg>
                        </div>
                        <h2 className='text-xl font-semibold text-gray-900 mb-2'>Password Reset!</h2>
                        <p className='text-gray-600 mb-6'>
                            Your password has been successfully reset. You can now sign in with your new password.
                        </p>
                        <Link
                            to='/login'
                            className='inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700'
                        >
                            Go to Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (!token) {
        return (
            <div className='min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
                <div className='sm:mx-auto sm:w-full sm:max-w-md'>
                    <h1 className='text-center text-3xl font-bold text-gray-900'>Sankey Scenarios</h1>
                </div>

                <div className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
                    <div className='bg-white py-8 px-4 shadow rounded-lg sm:px-10 text-center'>
                        <div className='text-red-600 mb-4'>
                            <svg className='mx-auto h-12 w-12' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                                />
                            </svg>
                        </div>
                        <h2 className='text-xl font-semibold text-gray-900 mb-2'>Invalid Reset Link</h2>
                        <p className='text-gray-600 mb-6'>This password reset link is invalid or has expired.</p>
                        <Link
                            to='/forgot-password'
                            className='inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700'
                        >
                            Request New Reset Link
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className='min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
            <div className='sm:mx-auto sm:w-full sm:max-w-md'>
                <h1 className='text-center text-3xl font-bold text-gray-900'>Sankey Scenarios</h1>
                <h2 className='mt-6 text-center text-2xl font-semibold text-gray-700'>Set new password</h2>
            </div>

            <div className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
                <div className='bg-white py-8 px-4 shadow rounded-lg sm:px-10'>
                    <Form method='post' className='space-y-6'>
                        <input type='hidden' name='token' value={token} />

                        {actionData?.error && (
                            <div className='p-4 bg-red-50 text-red-700 rounded-md text-sm'>{actionData.error}</div>
                        )}

                        <div>
                            <label htmlFor='password' className='block text-sm font-medium text-gray-700'>
                                New Password
                            </label>
                            <input
                                type='password'
                                id='password'
                                name='password'
                                autoComplete='new-password'
                                required
                                minLength={8}
                                className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
                            />
                            <p className='mt-1 text-xs text-gray-500'>Must be at least 8 characters</p>
                        </div>

                        <div>
                            <label htmlFor='confirmPassword' className='block text-sm font-medium text-gray-700'>
                                Confirm New Password
                            </label>
                            <input
                                type='password'
                                id='confirmPassword'
                                name='confirmPassword'
                                autoComplete='new-password'
                                required
                                className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
                            />
                        </div>

                        <button
                            type='submit'
                            className='w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                        >
                            Reset Password
                        </button>
                    </Form>
                </div>
            </div>
        </div>
    );
}
