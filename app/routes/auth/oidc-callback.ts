import { redirect } from 'react-router';
import type { Route } from './+types/oidc-callback';
import { getCurrentUser, loginOrCreateOidcUser } from '~/auth/auth.server';
import { isOidcEnabled, handleOidcCallback, clearOidcStateCookie } from '~/auth/oidc.server';

export async function loader({ request }: Route.LoaderArgs) {
    if (!isOidcEnabled()) {
        throw redirect('/login');
    }

    // Redirect if already logged in
    const user = await getCurrentUser(request);
    if (user) {
        throw redirect('/');
    }

    try {
        const oidcUser = await handleOidcCallback(request);
        const result = await loginOrCreateOidcUser(oidcUser);

        if (!result.success) {
            const errorParam = encodeURIComponent(result.error);
            throw redirect(`/login?error=${errorParam}`, {
                headers: {
                    'Set-Cookie': clearOidcStateCookie()
                }
            });
        }

        throw redirect('/', {
            headers: [
                [ 'Set-Cookie', result.sessionCookie ],
                [ 'Set-Cookie', clearOidcStateCookie() ],
            ]
        });
    } catch (error) {
        // Re-throw redirect responses
        if (error instanceof Response) {
            throw error;
        }

        console.error('OIDC callback error:', error);
        const message = error instanceof Error ? error.message : 'Authentication failed';
        const errorParam = encodeURIComponent(message);
        throw redirect(`/login?error=${errorParam}`, {
            headers: {
                'Set-Cookie': clearOidcStateCookie()
            }
        });
    }
}
