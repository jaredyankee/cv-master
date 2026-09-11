/**
 * Request guards that run before anything expensive.
 *
 * Every function here is cheap and synchronous on purpose: the point is to
 * reject junk before it reaches JSON.parse, the JWKS fetch, Neon, or the model.
 */

/**
 * Largest request body any endpoint accepts.
 *
 * Sized for the longest thing a person actually submits — a whole career
 * written out freely is on the order of tens of kilobytes — with a wide margin.
 * It exists to stop a multi-megabyte paste from becoming Neon storage, model
 * tokens, and function time, not to police normal use.
 */
export const MAX_BODY_BYTES = 256 * 1024

/** Byte length of a body, counting UTF-8 rather than UTF-16 code units. */
export function bodyBytes(body) {
    if (!body) return 0
    if (typeof body !== 'string') return 0
    // Buffer is available in the functions runtime; TextEncoder is the fallback
    // so this module stays usable (and testable) anywhere.
    return typeof Buffer !== 'undefined'
        ? Buffer.byteLength(body, 'utf8')
        : new TextEncoder().encode(body).length
}

/**
 * A 413 response when the body is over the cap, or null when it is fine.
 *
 * @param {{ body?: string }} event
 * @param {Record<string,string>} headers  CORS headers to echo back
 * @param {number} [limit]
 */
export function bodyTooLarge(event, headers = {}, limit = MAX_BODY_BYTES) {
    const size = bodyBytes(event?.body)
    if (size <= limit) return null
    console.warn(`request body rejected: ${size} bytes exceeds ${limit}`)
    return {
        statusCode: 413,
        headers,
        body: JSON.stringify({
            message: `Request body is too large (${Math.round(size / 1024)} KB; the limit is ${Math.round(limit / 1024)} KB).`,
        }),
    }
}
