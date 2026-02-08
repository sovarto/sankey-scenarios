/**
 * Server-Sent Events endpoint for real-time collaboration
 */

import type { Route } from './+types/realtime';
import { requireMember } from '~/auth/auth.server';
import { requireProjectAccess } from '~/utils/project-ownership.server';
import { subscribe } from '~/utils/realtime.server';

export async function loader({ request }: Route.LoaderArgs) {
    const user = await requireMember(request);

    const url = new URL(request.url);
    const projectIdParam = url.searchParams.get('projectId');
    const scenarioIdParam = url.searchParams.get('scenarioId');

    if (!projectIdParam) {
        throw new Response('projectId is required', { status: 400 });
    }

    const projectId = parseInt(projectIdParam, 10);
    if (isNaN(projectId)) {
        throw new Response('Invalid projectId', { status: 400 });
    }

    // Verify user has access to this project
    await requireProjectAccess(request, projectId);

    const scenarioId = scenarioIdParam ? parseInt(scenarioIdParam, 10) : undefined;

    // Create SSE stream
    const stream = subscribe(user.id, user.name, projectId, scenarioId);

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive'
        }
    });
}
