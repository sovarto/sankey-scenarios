import { Form, Link, redirect } from 'react-router';
import type { Route } from './+types/login';
import { login, getCurrentUser } from '~/auth/auth.server';

export function meta({}: Route.MetaArgs) {
    return [ { title: 'Login - Sankey Scenarios' } ];
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

    if (typeof email !== 'string' || !email.trim()) {
        return { error: 'Email is required' };
    }

    if (typeof password !== 'string' || !password) {
        return { error: 'Password is required' };
    }

    const result = await login(email, password);

    if (!result.success) {
        return { error: result.error };
    }

    return redirect('/', {
        headers: {
            'Set-Cookie': result.sessionCookie
        }
    });
}

export default function Login({ actionData }: Route.ComponentProps) {
    return (
        <div className='min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
            <div className='sm:mx-auto sm:w-full sm:max-w-md'>
                <h1 className='text-center text-3xl font-bold text-gray-900'>Sankey Scenarios</h1>
                <h2 className='mt-6 text-center text-2xl font-semibold text-gray-700'>Sign in to your account</h2>
            </div>

            <div className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
                <div className='bg-white py-8 px-4 shadow rounded-lg sm:px-10'>
                    <Form method='post' className='space-y-6'>
                        {actionData?.error && (
                            <div className='p-4 bg-red-50 text-red-700 rounded-md text-sm'>{actionData.error}</div>
                        )}

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
                                autoComplete='current-password'
                                required
                                className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
                            />
                        </div>

                        <div className='flex items-center justify-between'>
                            <div className='text-sm'>
                                <Link to='/forgot-password' className='text-blue-600 hover:text-blue-500'>
                                    Forgot your password?
                                </Link>
                            </div>
                        </div>

                        <button
                            type='submit'
                            className='w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                        >
                            Sign in
                        </button>
                    </Form>

                    <div className='mt-6'>
                        <div className='relative'>
                            <div className='absolute inset-0 flex items-center'>
                                <div className='w-full border-t border-gray-300' />
                            </div>
                            <div className='relative flex justify-center text-sm'>
                                <span className='px-2 bg-white text-gray-500'>Don't have an account?</span>
                            </div>
                        </div>

                        <div className='mt-6'>
                            <Link
                                to='/signup'
                                className='w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50'
                            >
                                Create an account
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
