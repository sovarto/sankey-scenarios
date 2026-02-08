/**
 * API endpoint for managing project shares
 */

import { eq, and, ilike } from 'drizzle-orm';
import type { Route } from './+types/project-shares';
import { requireMember } from '~/auth/auth.server';
import { database } from '~/database/context';
import * as schema from '~/database/schema';

// Loader: Get current shares for a project (only owner can see shares)
export async function loader({ request, params }: Route.LoaderArgs) {
    const user = await requireMember(request);
    const db = database();
    const projectId = parseInt(params.projectId, 10);

    if (isNaN(projectId)) {
        throw new Response('Invalid project ID', { status: 400 });
    }

    // Only owner can view shares
    const project = await db.query.projects.findFirst({
        where: and(
            eq(schema.projects.id, projectId),
            eq(schema.projects.userId, user.id)
        ),
        columns: { id: true }
    });

    if (!project) {
        throw new Response('Project not found or you are not the owner', { status: 404 });
    }

    // Get all shares
    const shares = await db.query.projectShares.findMany({
        where: eq(schema.projectShares.projectId, projectId),
        with: {
            user: {
                columns: { id: true, name: true, email: true }
            }
        }
    });

    return { shares };
}

// Action: Add, update, or remove shares
export async function action({ request, params }: Route.ActionArgs) {
    const user = await requireMember(request);
    const db = database();
    const projectId = parseInt(params.projectId, 10);

    if (isNaN(projectId)) {
        throw new Response('Invalid project ID', { status: 400 });
    }

    // Only owner can manage shares
    const project = await db.query.projects.findFirst({
        where: and(
            eq(schema.projects.id, projectId),
            eq(schema.projects.userId, user.id)
        ),
        columns: { id: true }
    });

    if (!project) {
        throw new Response('Project not found or you are not the owner', { status: 404 });
    }

    const formData = await request.formData();
    const intent = formData.get('intent');

    switch (intent) {
        case 'add-share': {
            const email = formData.get('email')?.toString()?.toLowerCase();
            const permission = formData.get('permission')?.toString() || 'readonly';

            if (!email) {
                return { error: 'Email is required' };
            }

            if (permission !== 'readonly' && permission !== 'readwrite') {
                return { error: 'Invalid permission level' };
            }

            // Find user by email
            const targetUser = await db.query.users.findFirst({
                where: ilike(schema.users.email, email),
                columns: { id: true, name: true, email: true }
            });

            if (!targetUser) {
                return { error: 'User not found with that email' };
            }

            // Can't share with yourself
            if (targetUser.id === user.id) {
                return { error: 'You cannot share with yourself' };
            }

            // Check if share already exists
            const existingShare = await db.query.projectShares.findFirst({
                where: and(
                    eq(schema.projectShares.projectId, projectId),
                    eq(schema.projectShares.userId, targetUser.id)
                )
            });

            if (existingShare) {
                // Update existing share
                await db.update(schema.projectShares).set({ permission }).where(
                    eq(schema.projectShares.id, existingShare.id)
                );
            } else {
                // Create new share
                await db.insert(schema.projectShares).values({
                    projectId,
                    userId: targetUser.id,
                    permission
                });
            }

            return { success: true, user: targetUser, permission };
        }

        case 'update-permission': {
            const shareId = parseInt(formData.get('shareId')?.toString() || '', 10);
            const permission = formData.get('permission')?.toString();

            if (isNaN(shareId)) {
                return { error: 'Invalid share ID' };
            }

            if (permission !== 'readonly' && permission !== 'readwrite') {
                return { error: 'Invalid permission level' };
            }

            await db.update(schema.projectShares).set({ permission }).where(and(
                eq(schema.projectShares.id, shareId),
                eq(schema.projectShares.projectId, projectId)
            ));

            return { success: true };
        }

        case 'remove-share': {
            const shareId = parseInt(formData.get('shareId')?.toString() || '', 10);

            if (isNaN(shareId)) {
                return { error: 'Invalid share ID' };
            }

            await db.delete(schema.projectShares).where(and(
                eq(schema.projectShares.id, shareId),
                eq(schema.projectShares.projectId, projectId)
            ));

            return { success: true };
        }

        case 'search-users': {
            const query = formData.get('query')?.toString()?.toLowerCase();

            if (!query || query.length < 2) {
                return { users: [] };
            }

            // Search for users by email or name (exclude project owner and already shared users)
            const existingShareUserIds = await db.query.projectShares.findMany({
                where: eq(schema.projectShares.projectId, projectId),
                columns: { userId: true }
            });

            const excludeIds = [ user.id, ...existingShareUserIds.map(s => s.userId) ];

            const users = await db.query.users.findMany({
                where: and(
                    eq(schema.users.status, 'active'),
                    // Simple search - in production you might want full-text search
                    ilike(schema.users.email, `%${query}%`)
                ),
                columns: { id: true, name: true, email: true },
                limit: 10
            });

            return {
                users: users.filter(u => !excludeIds.includes(u.id))
            };
        }

        default:
            return { error: 'Invalid action' };
    }
}
