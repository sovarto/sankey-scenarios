import { index, prefix, route, type RouteConfig } from '@react-router/dev/routes';

export default [
    index('routes/home.tsx'),
    route('settings', 'routes/settings.tsx'),

    // Auth routes
    route('login', 'routes/auth/login.tsx'),
    route('signup', 'routes/auth/signup.tsx'),
    route('logout', 'routes/auth/logout.tsx'),
    route('forgot-password', 'routes/auth/forgot-password.tsx'),
    route('reset-password', 'routes/auth/reset-password.tsx'),
    route('auth/oidc', 'routes/auth/oidc.ts'),
    route('auth/oidc/callback', 'routes/auth/oidc-callback.ts'),

    // API routes
    route('api/realtime', 'routes/api/realtime.ts'),
    route('api/projects/:projectId/shares', 'routes/api/project-shares.ts'),

    // Admin routes
    ...prefix('admin', [
        ...prefix('users', [ index('routes/admin/users/index.tsx'), route(':userId', 'routes/admin/users/view.tsx') ]),
    ]),

    // Projects routes
    ...prefix('projects', [
        index('routes/projects/index.tsx'),
        route('new', 'routes/projects/new.tsx'),
        route(':projectId', 'routes/projects/view.tsx'),
        route(':projectId/edit', 'routes/projects/edit.tsx'),

        // Scenarios nested under projects
        route(':projectId/scenarios/new', 'routes/scenarios/new.tsx'),
        route(':projectId/scenarios/:scenarioId', 'routes/scenarios/view.tsx'),
        route(':projectId/scenarios/:scenarioId/edit', 'routes/scenarios/edit.tsx'),

        // Groups nested under projects
        route(':projectId/groups', 'routes/groups/index.tsx'),
        route(':projectId/groups/new', 'routes/groups/new.tsx'),
        route(':projectId/groups/:groupId', 'routes/groups/view.tsx'),

        // Nodes nested under projects
        route(':projectId/nodes', 'routes/nodes/index.tsx'),
        route(':projectId/nodes/new', 'routes/nodes/new.tsx'),
        route(':projectId/nodes/:nodeId', 'routes/nodes/view.tsx'),
        route(':projectId/nodes/:nodeId/edit', 'routes/nodes/edit.tsx'),
    ]),
] satisfies RouteConfig;
