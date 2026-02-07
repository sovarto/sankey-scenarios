import { randomBytes } from 'crypto';
import { eq, and, gt } from 'drizzle-orm';
import { database } from '~/database/context';
import * as schema from '~/database/schema';

const SESSION_EXPIRY_DAYS = 7;

export function generateSessionId(): string {
    return randomBytes(32).toString('hex');
}

export async function createSession(userId: number): Promise<string> {
    const db = database();
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await db.insert(schema.sessions).values({
        id: sessionId,
        userId,
        expiresAt
    });

    return sessionId;
}

export async function getSession(sessionId: string) {
    const db = database();

    const session = await db.query.sessions.findFirst({
        where: and(eq(schema.sessions.id, sessionId), gt(schema.sessions.expiresAt, new Date())),
        with: {
            user: {
                with: {
                    userRoles: {
                        with: { role: true }
                    }
                }
            }
        }
    });

    if (!session) {
        return null;
    }

    // Check if user is active
    if (session.user.status !== 'active') {
        await deleteSession(sessionId);
        return null;
    }

    return session;
}

export async function deleteSession(sessionId: string): Promise<void> {
    const db = database();
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
}

export async function deleteAllUserSessions(userId: number): Promise<void> {
    const db = database();
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

// Cookie helpers
const SESSION_COOKIE_NAME = 'session';

export function getSessionCookie(request: Request): string | null {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) {
        return null;
    }

    const cookies = Object.fromEntries(
        cookieHeader.split(';').map(c => {
            const [ key, ...val ] = c.trim().split('=');
            return [ key, val.join('=') ];
        })
    );

    return cookies[SESSION_COOKIE_NAME] || null;
}

export function createSessionCookie(sessionId: string): string {
    const expires = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    return `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}`;
}

export function createLogoutCookie(): string {
    return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
