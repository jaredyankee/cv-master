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
    return verifyToken(token)
}

/** Maps an AuthError to a function response. Never echoes verification details to the client. */
export function authErrorResponse(err, headers = {}) {
    const status = err?.status === 500 ? 500 : 401
    return {
        statusCode: status,
        headers,
        body: JSON.stringify({ message: status === 500 ? 'Auth is not configured on the server' : 'Unauthorized' }),
    }
}
