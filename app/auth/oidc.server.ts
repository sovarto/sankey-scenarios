import * as client from 'openid-client';
import { randomBytes } from 'crypto';

// OIDC is optional — enabled only when all required env vars are set
const OIDC_ISSUER_URL = process.env.OIDC_ISSUER_URL;
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID;
const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET;
const OIDC_SCOPES = process.env.OIDC_SCOPES || 'openid email profile';

// Group-based role mapping (comma-separated group names)
// Users in admin groups get admin + member roles; users in member groups get member role.
// Users not in any configured group are denied access.
// When no groups are configured, all OIDC users are allowed (legacy behaviour).
const OIDC_ADMIN_GROUPS = parseGroupList(process.env.OIDC_ADMIN_GROUPS);
const OIDC_MEMBER_GROUPS = parseGroupList(process.env.OIDC_MEMBER_GROUPS);

// The OIDC claim that contains the user's groups (defaults to "groups")
const OIDC_GROUPS_CLAIM = process.env.OIDC_GROUPS_CLAIM || 'groups';

function parseGroupList(value: string | undefined): string[] {
    if (!value) return [];
    return value.split(',').map(g => g.trim()).filter(Boolean);
}

export function isGroupMappingEnabled(): boolean {
    return OIDC_ADMIN_GROUPS.length > 0 || OIDC_MEMBER_GROUPS.length > 0;
}

export function isOidcEnabled(): boolean {
    return !!(OIDC_ISSUER_URL && OIDC_CLIENT_ID);
}

// Lazily-resolved OIDC configuration (discovered from issuer)
let configPromise: Promise<client.Configuration> | null = null;

function getConfig(): Promise<client.Configuration> {
    if (!configPromise) {
        if (!OIDC_ISSUER_URL || !OIDC_CLIENT_ID) {
            throw new Error('OIDC is not configured');
        }
        configPromise = client.discovery(
            new URL(OIDC_ISSUER_URL),
            OIDC_CLIENT_ID,
            OIDC_CLIENT_SECRET || undefined,
        );
    }
    return configPromise;
}

const OIDC_STATE_COOKIE = 'oidc_state';

export function buildRedirectUri(request: Request): string {
    const url = new URL(request.url);
    return `${url.origin}/auth/oidc/callback`;
}

export async function startOidcLogin(request: Request): Promise<{ url: string; stateCookie: string }> {
    const config = await getConfig();
    const redirectUri = buildRedirectUri(request);

    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = randomBytes(16).toString('hex');
    const nonce = randomBytes(16).toString('hex');

    const parameters: Record<string, string> = {
        redirect_uri: redirectUri,
        scope: OIDC_SCOPES,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
        nonce,
    };

    const url = client.buildAuthorizationUrl(config, parameters);

    // Store state, nonce, and code_verifier in a short-lived cookie
    const statePayload = JSON.stringify({ state, nonce, codeVerifier });
    const encoded = Buffer.from(statePayload).toString('base64');
    const stateCookie =
        `${OIDC_STATE_COOKIE}=${encoded}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`;

    return { url: url.href, stateCookie };
}

export type OidcUserInfo = {
    subject: string;
    email: string;
    name: string;
    groups: string[];
};

export async function handleOidcCallback(
    request: Request,
): Promise<OidcUserInfo> {
    const config = await getConfig();
    const redirectUri = buildRedirectUri(request);

    // Retrieve state cookie
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = Object.fromEntries(
        cookieHeader.split(';').map(c => {
            const [ key, ...val ] = c.trim().split('=');
            return [ key, val.join('=') ];
        }),
    );

    const encoded = cookies[OIDC_STATE_COOKIE];
    if (!encoded) {
        throw new Error('Missing OIDC state cookie');
    }

    const { state, nonce, codeVerifier } = JSON.parse(
        Buffer.from(encoded, 'base64').toString(),
    ) as { state: string; nonce: string; codeVerifier: string };

    const currentUrl = new URL(request.url);

    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedState: state,
        expectedNonce: nonce,
        idTokenExpected: true,
    });

    const claims = tokens.claims();
    if (!claims) {
        throw new Error('No ID token claims received');
    }

    // Try to get name from claims; fall back to userinfo endpoint
    let name = (claims.name as string | undefined)
        || (claims.preferred_username as string | undefined)
        || '';
    let email = (claims.email as string | undefined) || '';

    // If we still lack name or email, call userinfo
    if (!name || !email) {
        const userinfo = await client.fetchUserInfo(config, tokens.access_token!, claims.sub);
        name = name || (userinfo.name as string | undefined) || (userinfo.preferred_username as string | undefined) || claims.sub;
        email = email || (userinfo.email as string | undefined) || '';
    }

    if (!email) {
        throw new Error('OIDC provider did not return an email address. Ensure the "email" scope is requested.');
    }

    // Extract groups from claims (typically an array of strings)
    let groups: string[] = [];
    const rawGroups = (claims as Record<string, unknown>)[OIDC_GROUPS_CLAIM];
    if (Array.isArray(rawGroups)) {
        groups = rawGroups.filter((g): g is string => typeof g === 'string');
    }

    return {
        subject: claims.sub,
        email,
        name,
        groups,
    };
}

export function clearOidcStateCookie(): string {
    return `${OIDC_STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * Determine which application roles an OIDC user should have based on their group membership.
 *
 * When group mapping is configured (OIDC_ADMIN_GROUPS / OIDC_MEMBER_GROUPS):
 *   - Members of admin groups → { admin, member }
 *   - Members of member groups → { member }
 *   - Members of neither → null (access denied)
 *
 * When group mapping is NOT configured, returns undefined (caller decides).
 */
export function resolveOidcRoles(groups: string[]): Set<string> | null | undefined {
    if (!isGroupMappingEnabled()) {
        return undefined; // no group mapping configured – fall back to legacy behaviour
    }

    const roles = new Set<string>();

    const isAdmin = groups.some(g => OIDC_ADMIN_GROUPS.includes(g));
    const isMember = groups.some(g => OIDC_MEMBER_GROUPS.includes(g));

    if (isAdmin) {
        roles.add('admin');
        roles.add('member');
    } else if (isMember) {
        roles.add('member');
    } else {
        return null; // not in any allowed group → access denied
    }

    return roles;
}
