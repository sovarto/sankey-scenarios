import { eq, and } from 'drizzle-orm';
import { requireMember } from '~/auth/auth.server';
import type { AuthUser } from '~/auth/auth.server';

import { database } from '~/database/context';
import * as schema from '~/database/schema';

/**
 * Verify that the current user owns the specified project.
 * Returns the user and project if valid, throws 404 if not found or not owned.
 */
export async function requireProjectOwnership(
    request: Request,
    projectId: number,
): Promise<{ user: AuthUser; project: { id: number; name: string } }> {
    const user = await requireMember(request);
    const db = database();

    const project = await db.query.projects.findFirst({
        where: and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.id)),
        columns: { id: true, name: true }
    });

    if (!project) {
        throw new Response('Project not found', { status: 404 });
    }

    return { user, project };
}

/**
 * Parse and validate a project ID from route params.
 */
export function parseProjectId(projectId: string): number {
    const id = parseInt(projectId, 10);
    if (isNaN(id)) {
        throw new Response('Invalid project ID', { status: 400 });
    }
    return id;
}
