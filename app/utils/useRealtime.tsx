import { useEffect, useState, useCallback, useRef } from 'react';

export type RealtimeEvent = {
    type:
        | 'scenario-updated'
        | 'project-updated'
        | 'connection-added'
        | 'connection-deleted'
        | 'connection-updated'
        | 'user-joined'
        | 'user-left'
        | 'connected'
        | 'active-users';
    projectId?: number;
    scenarioId?: number;
    data?: unknown;
    userId?: number;
    users?: Array<{ userId: number; userName: string }>;
    timestamp?: number;
};

type UseRealtimeOptions = {
    projectId: number;
    scenarioId?: number;
    onEvent?: (event: RealtimeEvent) => void;
    onReconnect?: () => void;
};

export type ActiveUser = {
    userId: number;
    userName: string;
};

export function useRealtime({ projectId, scenarioId, onEvent, onReconnect }: UseRealtimeOptions) {
    const [ isConnected, setIsConnected ] = useState(false);
    const [ activeUsers, setActiveUsers ] = useState<ActiveUser[]>([]);
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onEventRef = useRef(onEvent);
    const onReconnectRef = useRef(onReconnect);

    // Keep refs updated
    useEffect(() => {
        onEventRef.current = onEvent;
        onReconnectRef.current = onReconnect;
    }, [ onEvent, onReconnect ]);

    const connect = useCallback(() => {
        // Clean up existing connection
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        // Build URL with query params
        const url = new URL('/api/realtime', window.location.origin);
        url.searchParams.set('projectId', projectId.toString());
        if (scenarioId !== undefined) {
            url.searchParams.set('scenarioId', scenarioId.toString());
        }

        const eventSource = new EventSource(url.toString());
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            setIsConnected(true);
        };

        eventSource.onmessage = event => {
            try {
                const data = JSON.parse(event.data) as RealtimeEvent;

                // Handle special events
                if (data.type === 'connected') {
                    setIsConnected(true);
                    return;
                }

                if (data.type === 'active-users' && data.users) {
                    setActiveUsers(data.users);
                    return;
                }

                if (data.type === 'user-joined' && data.data) {
                    const joinedUser = data.data as ActiveUser;
                    setActiveUsers(prev => {
                        if (prev.some(u => u.userId === joinedUser.userId)) {
                            return prev;
                        }
                        return [ ...prev, joinedUser ];
                    });
                }

                if (data.type === 'user-left' && data.data) {
                    const leftUser = data.data as ActiveUser;
                    setActiveUsers(prev => prev.filter(u => u.userId !== leftUser.userId));
                }

                // Call the event handler
                onEventRef.current?.(data);
            } catch {
                console.error('Failed to parse realtime event:', event.data);
            }
        };

        eventSource.onerror = () => {
            setIsConnected(false);
            eventSource.close();

            // Reconnect after a delay
            reconnectTimeoutRef.current = setTimeout(() => {
                connect();
                onReconnectRef.current?.();
            }, 3000);
        };
    }, [ projectId, scenarioId ]);

    useEffect(() => {
        connect();

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [ connect ]);

    return { isConnected, activeUsers };
}

/**
 * Component to display active collaborators
 */
export function ActiveCollaborators({ users, currentUserId }: { users: ActiveUser[]; currentUserId: number }) {
    const otherUsers = users.filter(u => u.userId !== currentUserId);

    if (otherUsers.length === 0) {
        return null;
    }

    return (
        <div className='flex items-center gap-2'>
            <span className='text-xs text-gray-500'>Collaborating:</span>
            <div className='flex -space-x-2'>
                {otherUsers.slice(0, 5).map(user => (
                    <div
                        key={user.userId}
                        className='w-7 h-7 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-white text-xs font-medium'
                        title={user.userName}
                    >
                        {user.userName.charAt(0).toUpperCase()}
                    </div>
                ))}
                {otherUsers.length > 5 && (
                    <div className='w-7 h-7 rounded-full bg-gray-400 border-2 border-white flex items-center justify-center text-white text-xs font-medium'>
                        +{otherUsers.length - 5}
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Connection status indicator
 */
export function ConnectionStatus({ isConnected }: { isConnected: boolean }) {
    return (
        <div className='flex items-center gap-1.5'>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className='text-xs text-gray-500'>{isConnected ? 'Live' : 'Reconnecting...'}</span>
        </div>
    );
}
