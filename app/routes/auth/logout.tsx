import { redirect } from 'react-router';
import type { Route } from './+types/logout';
import { logout } from '~/auth/auth.server';

export async function loader({ request }: Route.LoaderArgs) {
    const logoutCookie = await logout(request);
    return redirect('/login', {
        headers: {
            'Set-Cookie': logoutCookie
        }
    });
}

export async function action({ request }: Route.ActionArgs) {
    const logoutCookie = await logout(request);
    return redirect('/login', {
        headers: {
            'Set-Cookie': logoutCookie
        }
    });
}
