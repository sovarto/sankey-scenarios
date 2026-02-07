import { Form, Link } from 'react-router';
import type { Route } from './+types/forgot-password';
import { requestPasswordReset } from '~/auth/auth.server';

export function meta({}: Route.MetaArgs) {
    return [ { title: 'Forgot Password - Sankey Scenarios' } ];
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const email = formData.get('email');

    if (typeof email !== 'string' || !email.trim()) {
        return { error: 'Email is required' };
    }

    const result = await requestPasswordReset(email);

    // Always show success to prevent email enumeration
    // In a real app, you would send an email with the reset link
    return {
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
        // For development/demo purposes, we include the token
        // In production, you would send this via email
        ...(result.success && result.token ? { devToken: result.token } : {})
    };
}

export default function ForgotPassword({ actionData }: Route.ComponentProps) {
    return (
        <div className='min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
            <div className='sm:mx-auto sm:w-full sm:max-w-md'>
                <h1 className='text-center text-3xl font-bold text-gray-900'>Sankey Scenarios</h1>
                <h2 className='mt-6 text-center text-2xl font-semibold text-gray-700'>Reset your password</h2>
            </div>

            <div className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
                <div className='bg-white py-8 px-4 shadow rounded-lg sm:px-10'>
                    {actionData?.success
                        ? (
                            <div className='text-center'>
                                <div className='text-green-600 mb-4'>
                                    <svg
                                        className='mx-auto h-12 w-12'
                                        fill='none'
                                        viewBox='0 0 24 24'
                                        stroke='currentColor'
                                    >
                                        <path
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                            strokeWidth={2}
                                            d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
                                        />
                                    </svg>
                                </div>
                                <p className='text-gray-600 mb-4'>{actionData.message}</p>

                                {actionData.devToken && (
                                    <div className='mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md text-left'>
                                        <p className='text-sm font-medium text-yellow-800 mb-2'>
                                            Development Mode - Reset Link:
                                        </p>
                                        <Link
                                            to={`/reset-password?token=${actionData.devToken}`}
                                            className='text-sm text-blue-600 hover:text-blue-500 break-all'
                                        >
                                            /reset-password?token={actionData.devToken}
                                        </Link>
                                    </div>
                                )}

                                <Link
                                    to='/login'
                                    className='mt-6 inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50'
                                >
                                    Back to Login
                                </Link>
                            </div>
                        )
                        : (
                            <Form method='post' className='space-y-6'>
                                {actionData?.error && (
                                    <div className='p-4 bg-red-50 text-red-700 rounded-md text-sm'>
                                        {actionData.error}
                                    </div>
                                )}

                                <p className='text-sm text-gray-600'>
                                    Enter your email address and we'll send you a link to reset your password.
                                </p>

                                <div>
                                    <label htmlFor='email' className='block text-sm font-medium text-gray-700'>
                                        Email address
                                    </label>
                                    <input
                                        type='email'
                                        id='email'
                                        name='email'
                                        autoComplete='email'
                                        required
                                        className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
                                    />
                                </div>

                                <button
                                    type='submit'
                                    className='w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                                >
                                    Send Reset Link
                                </button>

                                <div className='text-center'>
                                    <Link to='/login' className='text-sm text-blue-600 hover:text-blue-500'>
                                        Back to Login
                                    </Link>
                                </div>
                            </Form>
                        )}
                </div>
            </div>
        </div>
    );
}
