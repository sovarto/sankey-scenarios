/**
 * Global setup for Playwright tests
 *
 * Resets the test database before each test run to ensure a clean state.
 */

import postgres from 'postgres';
import { config } from 'dotenv';

export default async function globalSetup() {
    // Load .env.test for DATABASE_URL
    config({ path: '.env.test' });

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL not set in .env.test');
    }

    const sql = postgres(databaseUrl);

    try {
        // Truncate all data tables in dependency order (CASCADE handles FK constraints)
        await sql`TRUNCATE TABLE
            sessions,
            scenario_group_node_orders,
            scenario_nodes,
            scenario_local_nodes,
            scenario_groups,
            connections,
            nodes,
            groups,
            project_shares,
            scenarios,
            projects,
            user_roles,
            roles,
            users
        CASCADE`;

        console.log('[global-setup] Test database reset successfully');
    } finally {
        await sql.end();
    }
}
