import { eq } from 'drizzle-orm';
import { redirect } from 'react-router';
import { hashPassword, verifyPassword, generateToken } from './password.server';
import { createSession, createSessionCookie, deleteSession, getSession, getSessionCookie, createLogoutCookie, deleteAllUserSessions } from './session.server';
import { database } from '~/database/context';
import * as schema from '~/database/schema';

export type AuthUser = {
    id: number;
    email: string;
    name: string;
    status: string;
    roles: string[];
    displayLocale: string | null;
    regionalLocale: string | null;
};

export async function getCurrentUser(request: Request): Promise<AuthUser | null> {
    const sessionId = getSessionCookie(request);
    if (!sessionId) {
        return null;
    }

    const session = await getSession(sessionId);
    if (!session) {
        return null;
    }

    return {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        status: session.user.status,
        roles: session.user.userRoles.map(ur => ur.role.name),
        displayLocale: session.user.displayLocale,
        regionalLocale: session.user.regionalLocale
    };
}

export async function requireUser(request: Request): Promise<AuthUser> {
    const user = await getCurrentUser(request);
    if (!user) {
        throw redirect('/login');
    }
    return user;
}

export async function requireAdmin(request: Request): Promise<AuthUser> {
    const user = await requireUser(request);
    if (!user.roles.includes('admin')) {
        throw redirect('/');
    }
    return user;
}

export async function requireMember(request: Request): Promise<AuthUser> {
    const user = await requireUser(request);
    if (!user.roles.includes('member') && !user.roles.includes('admin')) {
        throw redirect('/');
    }
    return user;
}

export async function login(
    email: string,
    password: string,
): Promise<{ success: true; sessionCookie: string; user: AuthUser } | { success: false; error: string }> {
    const db = database();

    const user = await db.query.users.findFirst({
        where: eq(schema.users.email, email.toLowerCase()),
        with: {
            userRoles: {
                with: { role: true }
            }
        }
    });

    if (!user) {
        return { success: false, error: 'Invalid email or password' };
    }

    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
        return { success: false, error: 'Invalid email or password' };
    }

    if (user.status === 'pending') {
        return { success: false, error: 'Your account is pending approval by an administrator' };
    }

    if (user.status === 'blocked') {
        return { success: false, error: 'Your account has been blocked. Please contact an administrator' };
    }

    const sessionId = await createSession(user.id);
    const sessionCookie = createSessionCookie(sessionId);

    return {
        success: true,
        sessionCookie,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            status: user.status,
            roles: user.userRoles.map(ur => ur.role.name),
            displayLocale: user.displayLocale,
            regionalLocale: user.regionalLocale
        }
    };
}

export async function signup(email: string, password: string, name: string, options?: {
    displayLocale?: string;
    regionalLocale?: string;
}): Promise<{ success: true; message: string } | { success: false; error: string }> {
    const db = database();

    // Check if email already exists
    const existing = await db.query.users.findFirst({
        where: eq(schema.users.email, email.toLowerCase())
    });

    if (existing) {
        return { success: false, error: 'An account with this email already exists' };
    }

    const passwordHash = await hashPassword(password);

    // Check if this is the first user - make them an admin and active
    const userCount = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
    const isFirstUser = userCount.length === 0;

    const [ newUser ] = await db.insert(schema.users).values({
        email: email.toLowerCase(),
        passwordHash,
        name,
        status: isFirstUser ? 'active' : 'pending',
        displayLocale: options?.displayLocale || null,
        regionalLocale: options?.regionalLocale || null
    }).returning({ id: schema.users.id });

    // Get or create the member role
    let memberRole = await db.query.roles.findFirst({
        where: eq(schema.roles.name, 'member')
    });

    if (!memberRole) {
        [ memberRole ] = await db.insert(schema.roles).values({
            name: 'member',
            description: 'Can work with diagrams'
        }).returning();
    }

    // Assign member role
    await db.insert(schema.userRoles).values({
        userId: newUser.id,
        roleId: memberRole.id
    });

    // If first user, also make them admin
    if (isFirstUser) {
        let adminRole = await db.query.roles.findFirst({
            where: eq(schema.roles.name, 'admin')
        });

        if (!adminRole) {
            [ adminRole ] = await db.insert(schema.roles).values({
                name: 'admin',
                description: 'Can manage users and accept signups'
            }).returning();
        }

        await db.insert(schema.userRoles).values({
            userId: newUser.id,
            roleId: adminRole.id
        });

        return {
            success: true,
            message: 'Account created! You are the first user and have been granted admin access.'
        };
    }

    return { success: true, message: 'Account created! Please wait for an administrator to approve your account.' };
}

export async function logout(request: Request): Promise<string> {
    const sessionId = getSessionCookie(request);
    if (sessionId) {
        await deleteSession(sessionId);
    }
    return createLogoutCookie();
}

export async function requestPasswordReset(
    email: string,
): Promise<{ success: true; token: string } | { success: false; error: string }> {
    const db = database();

    const user = await db.query.users.findFirst({
        where: eq(schema.users.email, email.toLowerCase())
    });

    if (!user) {
        // Don't reveal whether the email exists
        return { success: true, token: '' };
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.update(schema.users).set({
        resetToken: token,
        resetTokenExpiresAt: expiresAt,
        updatedAt: new Date()
    }).where(eq(schema.users.id, user.id));

    return { success: true, token };
}

export async function resetPassword(
    token: string,
    newPassword: string,
): Promise<{ success: true } | { success: false; error: string }> {
    const db = database();

    const user = await db.query.users.findFirst({
        where: eq(schema.users.resetToken, token)
    });

    if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
        return { success: false, error: 'Invalid or expired reset token' };
    }

    const passwordHash = await hashPassword(newPassword);

    await db.update(schema.users).set({
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
        updatedAt: new Date()
    }).where(eq(schema.users.id, user.id));

    // Invalidate all sessions
    await deleteAllUserSessions(user.id);

    return { success: true };
}
