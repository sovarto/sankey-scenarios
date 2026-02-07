import { Form, Link, redirect } from 'react-router';
import type { Route } from './+types/signup';
import { signup, getCurrentUser } from '~/auth/auth.server';

export function meta({}: Route.MetaArgs) {
    return [ { title: 'Sign Up - Sankey Scenarios' } ];
}

export async function loader({ request }: Route.LoaderArgs) {
    // Redirect if already logged in
    const user = await getCurrentUser(request);
    if (user) {
        throw redirect('/');
    }
    return {};
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const email = formData.get('email');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    const name = formData.get('name');
    const displayLocale = formData.get('displayLocale');
    const regionalLocale = formData.get('regionalLocale');

    if (typeof name !== 'string' || !name.trim()) {
        return { error: 'Name is required' };
    }

    if (typeof email !== 'string' || !email.trim()) {
        return { error: 'Email is required' };
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

    const result = await signup(email, password, name.trim(), {
        displayLocale: typeof displayLocale === 'string' ? displayLocale : undefined,
        regionalLocale: typeof regionalLocale === 'string' ? regionalLocale : undefined
    });

    if (!result.success) {
        return { error: result.error };
    }

    return { success: true, message: result.message };
}

export default function Signup({ actionData }: Route.ComponentProps) {
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
                        <h2 className='text-xl font-semibold text-gray-900 mb-2'>Account Created!</h2>
                        <p className='text-gray-600 mb-6'>{actionData.message}</p>
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

    // Get browser locale for prefilling - will be captured on mount
    const browserLanguage = typeof navigator !== 'undefined' ? navigator.language : 'en';

    return (
        <div className='min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
            <div className='sm:mx-auto sm:w-full sm:max-w-md'>
                <h1 className='text-center text-3xl font-bold text-gray-900'>Sankey Scenarios</h1>
                <h2 className='mt-6 text-center text-2xl font-semibold text-gray-700'>Create your account</h2>
            </div>

            <div className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
                <div className='bg-white py-8 px-4 shadow rounded-lg sm:px-10'>
                    <Form method='post' className='space-y-6'>
                        {actionData?.error && (
                            <div className='p-4 bg-red-50 text-red-700 rounded-md text-sm'>{actionData.error}</div>
                        )}

                        {/* Hidden fields for locale - prefilled from browser, sent with form */}
                        <input type='hidden' name='displayLocale' defaultValue={browserLanguage} />
                        <input type='hidden' name='regionalLocale' defaultValue={browserLanguage} />

                        <div>
                            <label htmlFor='name' className='block text-sm font-medium text-gray-700'>Full Name</label>
                            <input
                                type='text'
                                id='name'
                                name='name'
                                autoComplete='name'
                                required
                                className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
                            />
                        </div>

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

                        <div>
                            <label htmlFor='password' className='block text-sm font-medium text-gray-700'>
                                Password
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
                                Confirm Password
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
                            Create Account
                        </button>
                    </Form>

                    <div className='mt-6'>
                        <div className='relative'>
                            <div className='absolute inset-0 flex items-center'>
                                <div className='w-full border-t border-gray-300' />
                            </div>
                            <div className='relative flex justify-center text-sm'>
                                <span className='px-2 bg-white text-gray-500'>Already have an account?</span>
                            </div>
                        </div>

                        <div className='mt-6'>
                            <Link
                                to='/login'
                                className='w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50'
                            >
                                Sign in
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
