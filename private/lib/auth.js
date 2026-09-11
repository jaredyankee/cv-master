/**
 * Neon Auth token verification for Netlify functions.
 *
 * The browser signs in against Neon Auth directly, asks the client SDK for a
 * short-lived JWT (15 min), and sends it as `Authorization: Bearer <jwt>`.
 * Functions verify the signature against the project's JWKS and take the
 * user id from the `sub` claim. Nothing user-identifying is ever trusted
 * from the request body or query string.
 *
 * Env:
 *   NEON_AUTH_BASE_URL  — Neon console → Auth → Configuration → Base URL
 *   NEON_AUTH_JWKS_URL  — optional; defaults to <base>/.well-known/jwks.json
 *   ALLOWED_EMAILS      — optional; see the allowlist section below
 */

import { createRemoteJWKSet, jwtVerify } from 'jose'

export class AuthError extends Error {
    constructor(message, status = 401) {
        super(message)
        this.name = 'AuthError'
        this.status = status
    }
}

const trimSlash = s => s.replace(/\/+$/, '')

function getBaseUrl() {
    const base = process.env.NEON_AUTH_BASE_URL
    if (!base) {
        throw new AuthError(
            'NEON_AUTH_BASE_URL is not set in this runtime. Copy the Base URL from ' +
            'Neon console → Auth → Configuration into the Netlify site env (Functions scope) and redeploy.',
            500
        )
    }
    return trimSlash(base.trim())
}

function getJwksUrl() {
    const explicit = process.env.NEON_AUTH_JWKS_URL?.trim()
    return explicit || `${getBaseUrl()}/.well-known/jwks.json`
}

// Cached per JWKS URL so keys are fetched once per warm function instance.
let cachedJwks = null
let cachedFor  = null

function getJwks() {
    const url = getJwksUrl()
    if (!cachedJwks || cachedFor !== url) {
        cachedJwks = createRemoteJWKSet(new URL(url))
        cachedFor  = url
    }
    return cachedJwks
}

/* ── Allowlist ───────────────────────────────────────────────────
 *
 * Signing in is free to anyone with a Neon Auth account, but everything past
 * that point costs the site owner: Neon rows and compute, and a Netlify
 * invocation per request. BYOK covers the model bill, not the infrastructure
 * one. So who may *use* a deployment is a separate question from who may sign
 * in to it, and ALLOWED_EMAILS answers it.
 *
 * Unset or empty means open — no code change is needed to reopen a
 * deployment, and local development is unaffected.
 *
 * Env vars are strings, so the list is delimited rather than an array. Commas,
 * semicolons, spaces and newlines all separate, which means a value pasted
 * across several lines works as well as a one-liner:
 *
 *     ALLOWED_EMAILS=you@example.com, friend@example.com
 *
 * Entries match against the token's email claim *or* its subject. The subject
 * fallback matters: if a deployment's tokens carry no email claim, an
 * email-only list would lock out the owner too, and the only way back in would
 * be a redeploy. A user id always works.
 */

const ALLOWLIST_SEPARATORS = /[\s,;]+/

/** Lowercased, de-duplicated entries. Empty set means "no allowlist". */
export function parseAllowlist(raw) {
    return new Set(
        String(raw ?? '')
            .split(ALLOWLIST_SEPARATORS)
            .map(entry => entry.trim().toLowerCase())
            .filter(Boolean)
    )
}

// Re-parsed only when the env value itself changes, so warm instances don't
// re-split the string on every request.
let cachedAllowlist = null
let cachedAllowlistRaw = null

function getAllowlist() {
    const raw = process.env.ALLOWED_EMAILS ?? ''
    if (cachedAllowlistRaw !== raw) {
        cachedAllowlist = parseAllowlist(raw)
        cachedAllowlistRaw = raw
    }
    return cachedAllowlist
}

/**
 * Whether a verified identity is allowed to use this deployment.
 * Exported for testing; request paths go through `requireUser`.
 *
 * @param {{ userId?: string, email?: string|null }} user
 * @param {Set<string>} allowlist
 */
export function isAllowed(user, allowlist) {
    if (!allowlist || allowlist.size === 0) return true
    const email = user?.email?.trim().toLowerCase()
    const id    = user?.userId?.trim().toLowerCase()
    return Boolean((email && allowlist.has(email)) || (id && allowlist.has(id)))
}

/** Pulls the token out of an `Authorization: Bearer …` header. Returns null if absent. */
export function bearerToken(headers = {}) {
    const raw = headers.authorization ?? headers.Authorization ?? ''
    const match = /^bearer\s+(\S+)$/i.exec(String(raw).trim())
    return match ? match[1] : null
}

/**
 * Verifies a Neon Auth JWT and returns the identity it carries.
 * Throws AuthError(401) on any verification failure, AuthError(500) if unconfigured.
 *
 * @param {string} token
 * @returns {Promise<{ userId: string, email: string|null, name: string|null }>}
 */
export async function verifyToken(token) {
    const issuer = new URL(getBaseUrl()).origin
    let payload
    try {
        ({ payload } = await jwtVerify(token, getJwks(), { issuer }))
    } catch (err) {
        // jose codes: ERR_JWT_EXPIRED, ERR_JWS_SIGNATURE_VERIFICATION_FAILED,
        // ERR_JWT_CLAIM_VALIDATION_FAILED, ERR_JWKS_NO_MATCHING_KEY, ...
        throw new AuthError(`Invalid token (${err.code ?? err.name})`)
    }
    if (!payload.sub) throw new AuthError('Token has no subject')
    return {
        userId: payload.sub,
        email:  typeof payload.email === 'string' ? payload.email : null,
        name:   typeof payload.name  === 'string' ? payload.name  : null,
    }
}

/**
 * Resolves the calling user from a Netlify function event, or throws AuthError.
 * Netlify lowercases incoming header names.
 *
 * @param {{ headers?: Record<string, string> }} event
 */
export async function requireUser(event) {
    const token = bearerToken(event?.headers)
    if (!token) throw new AuthError('Missing bearer token')

    const user = await verifyToken(token)

    if (!isAllowed(user, getAllowlist())) {
        // The subject is an opaque id, so it is safe to log and it is what the
        // owner needs to add someone — or to diagnose a token with no email
        // claim, which would otherwise look like the allowlist is just broken.
        console.warn(`access denied: sub=${user.userId} emailClaim=${user.email ? 'present' : 'absent'}`)
        throw new AuthError('Not on the allowlist', 403)
    }

    return user
}

/** Maps an AuthError to a function response. Never echoes verification details to the client. */
export function authErrorResponse(err, headers = {}) {
    const status = [401, 403, 500].includes(err?.status) ? err.status : 401
    const message =
        status === 500 ? 'Auth is not configured on the server'
        : status === 403 ? 'This deployment is limited to invited accounts.'
        : 'Unauthorized'
    return { statusCode: status, headers, body: JSON.stringify({ message }) }
}
