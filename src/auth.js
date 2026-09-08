/**
 * Neon Auth client (managed Better Auth).
 *
 * The browser talks to Neon Auth directly at VITE_NEON_AUTH_URL (the Base URL
 * shown in Neon console → Auth → Configuration). Sessions live in an HttpOnly
 * cookie on the auth domain; for our own functions we send a short-lived JWT
 * as a bearer token (see api.js).
 */
import { createAuthClient } from '@neondatabase/auth'
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters'

const url = import.meta.env.VITE_NEON_AUTH_URL?.trim()

/** False when the app was built without VITE_NEON_AUTH_URL; App shows a setup notice. */
export const AUTH_CONFIGURED = Boolean(url)

if (!AUTH_CONFIGURED) {
    console.warn('VITE_NEON_AUTH_URL is not set — sign-in is disabled until it is.')
}

export const authClient = createAuthClient(url || 'http://localhost:0/auth-not-configured', {
    adapter: BetterAuthReactAdapter(),
})

// ── JWT for our Netlify functions ────────────────────────────
// Neon returns a `set-auth-jwt` header on session responses and the SDK copies
// it into `session.token`, caching the session (60 s, expiry-aware) and
// refreshing it as needed. That is the same source the SDK's own internal
// helper uses. If it isn't there, fall back to the JWT plugin's GET /token.

const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const looksLikeJwt = v => typeof v === 'string' && JWT_SHAPE.test(v)

/**
 * Returns a valid JWT for the signed-in user, or null when signed out or when
 * the auth service is unreachable. Never returns an opaque session token.
 */
export async function getAuthToken() {
    if (!AUTH_CONFIGURED) return null
    try {
        const session = await authClient.getSession()
        const fromSession = session?.data?.session?.token
        if (looksLikeJwt(fromSession)) return fromSession
        if (!session?.data?.user) return null                  // signed out

        const result = await authClient.token()
        const fromToken = result?.data?.token ?? result?.data?.session?.token
        if (looksLikeJwt(fromToken)) return fromToken

        if (result?.error) console.warn('Auth token request failed', result.error)
        return null
    } catch (err) {
        console.error('Could not get an auth token', err)
        return null
    }
}
