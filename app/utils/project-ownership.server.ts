import { eq, and } from 'drizzle-orm';
import { requireMember } from '~/auth/auth.server';
import type { AuthUser } from '~/auth/auth.server';

import { database } from '~/database/context';
import * as schema from '~/database/schema';

export type ProjectAccess = {
    user: AuthUser;
    project: { id: number; name: string };
    permission: 'owner' | 'readwrite' | 'readonly';
    isOwner: boolean;
    canWrite: boolean;
};

/**
 * Verify that the current user has access to the specified project.
 * Returns the user, project, and permission level if valid.
 * Throws 404 if not found or not accessible.
 */
export async function requireProjectAccess(request: Request, projectId: number): Promise<ProjectAccess> {
    const user = await requireMember(request);
    const db = database();

    // First check if user owns the project
    const ownedProject = await db.query.projects.findFirst({
        where: and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.id)),
        columns: { id: true, name: true }
    });

    if (ownedProject) {
        return {
            user,
            project: ownedProject,
            permission: 'owner',
            isOwner: true,
            canWrite: true
        };
    }

    // Check if project is shared with the user
    const share = await db.query.projectShares.findFirst({
        where: and(
            eq(schema.projectShares.projectId, projectId),
            eq(schema.projectShares.userId, user.id)
        ),
        with: {
            project: {
                columns: { id: true, name: true }
            }
        }
    });

    if (share) {
        const permission = share.permission as 'readonly' | 'readwrite';
        return {
            user,
            project: share.project,
            permission,
            isOwner: false,
            canWrite: permission === 'readwrite'
        };
    }

    throw new Response('Project not found', { status: 404 });
}

/**
 * Verify that the current user has write access to the specified project.
 * Returns the user and project if valid, throws 404 if not found or 403 if readonly.
 */
export async function requireProjectWriteAccess(request: Request, projectId: number): Promise<ProjectAccess> {
    const access = await requireProjectAccess(request, projectId);

    if (!access.canWrite) {
        throw new Response('You do not have permission to modify this project', { status: 403 });
    }

    return access;
}

/**
 * Legacy function - verify that the current user owns the specified project.
 * @deprecated Use requireProjectAccess or requireProjectWriteAccess instead
 */
export async function requireProjectOwnership(
    request: Request,
    projectId: number,
): Promise<{ user: AuthUser; project: { id: number; name: string } }> {
    const access = await requireProjectAccess(request, projectId);
    return { user: access.user, project: access.project };
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
