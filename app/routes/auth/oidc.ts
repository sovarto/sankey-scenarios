import { redirect } from 'react-router';
import type { Route } from './+types/oidc';
import { getCurrentUser } from '~/auth/auth.server';
import { isOidcEnabled, startOidcLogin } from '~/auth/oidc.server';

export async function loader({ request }: Route.LoaderArgs) {
    if (!isOidcEnabled()) {
        throw redirect('/login');
    }

    // Redirect if already logged in
    const user = await getCurrentUser(request);
    if (user) {
        throw redirect('/');
    }

    const { url, stateCookie } = await startOidcLogin(request);
    throw redirect(url, {
        headers: {
            'Set-Cookie': stateCookie
        }
    });
}
