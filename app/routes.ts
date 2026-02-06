import { index, prefix, route, type RouteConfig } from '@react-router/dev/routes';

export default [
    index('routes/home.tsx'),

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
        route(':projectId/groups/:groupId/edit', 'routes/groups/edit.tsx'),
    ]),
] satisfies RouteConfig;
