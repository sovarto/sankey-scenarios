/**
 * Real-time collaboration system using Server-Sent Events
 */

export type RealtimeEvent = {
    type:
        | 'scenario-updated'
        | 'project-updated'
        | 'connection-added'
        | 'connection-deleted'
        | 'connection-updated'
        | 'user-joined'
        | 'user-left';
    projectId: number;
    scenarioId?: number;
    data: unknown;
    userId: number; // The user who made the change
    timestamp: number;
};

type Subscriber = {
    userId: number;
    userName: string;
    controller: ReadableStreamDefaultController;
    projectId: number;
    scenarioId?: number;
};

// Global state for managing SSE connections
const subscribers = new Map<string, Subscriber>();

function getSubscriberId(userId: number, projectId: number, scenarioId?: number): string {
    return `${userId}-${projectId}-${scenarioId ?? 'project'}`;
}

/**
 * Subscribe a user to real-time updates for a project/scenario
 */
export function subscribe(userId: number, userName: string, projectId: number, scenarioId?: number): ReadableStream {
    const subscriberId = getSubscriberId(userId, projectId, scenarioId);

    // Remove any existing subscription for this user/project/scenario combo
    const existing = subscribers.get(subscriberId);
    if (existing) {
        try {
            existing.controller.close();
        } catch {
            // Ignore if already closed
        }
        subscribers.delete(subscriberId);
    }

    return new ReadableStream({
        start(controller) {
            const subscriber: Subscriber = {
                userId,
                userName,
                controller,
                projectId,
                scenarioId
            };
            subscribers.set(subscriberId, subscriber);

            // Send initial connection event
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`));

            // Notify others that a user joined
            broadcastToProject(projectId, scenarioId, {
                type: 'user-joined',
                projectId,
                scenarioId,
                data: { userId, userName },
                userId,
                timestamp: Date.now()
            }, userId);

            // Send list of active users to the new subscriber
            const activeUsers = getActiveUsers(projectId, scenarioId);
            controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'active-users', users: activeUsers })}\n\n`)
            );
        },
        cancel() {
            const subscriber = subscribers.get(subscriberId);
            if (subscriber) {
                subscribers.delete(subscriberId);
                // Notify others that a user left
                broadcastToProject(projectId, scenarioId, {
                    type: 'user-left',
                    projectId,
                    scenarioId,
                    data: { userId, userName },
                    userId,
                    timestamp: Date.now()
                }, userId);
            }
        }
    });
}

/**
 * Get active users for a project/scenario
 */
export function getActiveUsers(projectId: number, scenarioId?: number): Array<{ userId: number; userName: string }> {
    const users: Array<{ userId: number; userName: string }> = [];
    const seenUserIds = new Set<number>();

    for (const subscriber of subscribers.values()) {
        if (subscriber.projectId === projectId && !seenUserIds.has(subscriber.userId)) {
            // For scenario-specific views, only show users in the same scenario
            if (scenarioId === undefined || subscriber.scenarioId === scenarioId) {
                users.push({ userId: subscriber.userId, userName: subscriber.userName });
                seenUserIds.add(subscriber.userId);
            }
        }
    }

    return users;
}

/**
 * Broadcast an event to all subscribers of a project/scenario
 * excludeUserId: optionally exclude the user who made the change
 */
export function broadcastToProject(
    projectId: number,
    scenarioId: number | undefined,
    event: RealtimeEvent,
    excludeUserId?: number,
): void {
    const encoder = new TextEncoder();
    const message = `data: ${JSON.stringify(event)}\n\n`;

    for (const subscriber of subscribers.values()) {
        // Skip the user who made the change
        if (excludeUserId !== undefined && subscriber.userId === excludeUserId) {
            continue;
        }

        // Match on project ID
        if (subscriber.projectId !== projectId) {
            continue;
        }

        // For scenario-specific events, only send to users viewing that scenario
        // For project-level events (scenarioId undefined), send to all project subscribers
        if (scenarioId !== undefined && subscriber.scenarioId !== undefined && subscriber.scenarioId !== scenarioId) {
            continue;
        }

        try {
            subscriber.controller.enqueue(encoder.encode(message));
        } catch {
            // Connection closed, will be cleaned up by cancel handler
        }
    }
}

/**
 * Broadcast a scenario update event
 */
export function broadcastScenarioUpdate(
    projectId: number,
    scenarioId: number,
    type: RealtimeEvent['type'],
    data: unknown,
    userId: number,
): void {
    broadcastToProject(projectId, scenarioId, {
        type,
        projectId,
        scenarioId,
        data,
        userId,
        timestamp: Date.now()
    }, userId);
}

/**
 * Broadcast a project update event
 */
export function broadcastProjectUpdate(
    projectId: number,
    type: RealtimeEvent['type'],
    data: unknown,
    userId: number,
): void {
    broadcastToProject(projectId, undefined, {
        type,
        projectId,
        data,
        userId,
        timestamp: Date.now()
    }, userId);
}
