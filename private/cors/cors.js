/**
 * Browser origin gate for the Netlify functions.
 *
 * Returns the CORS response headers to attach on success, or a full
 * { statusCode, headers, body } response the caller should return as-is
 * (the OPTIONS preflight answer, or a 403 for a disallowed origin).
 *
 * Browsers send `Origin` on every cross-origin request and on all POST /
 * PUT / DELETE requests. A same-origin GET (the deployed app calling its own
 * functions) carries no `Origin` at all, only `Referer` and
 * `sec-fetch-site: same-origin`. Requests with no `Origin` are therefore
 * same-origin or non-browser clients; CORS cannot gate either of those, so
 * they pass through here and are gated by authentication instead.
 *
 * @param {object} event   Netlify function event (headers are lowercased)
 * @param {string|null} page  optional extra origin to allow
 */
export const CORS = (event, page = null) => {
    const allowed = [
        'http://localhost:5173',
        'http://localhost:5174',
        'https://cvmaster-jy.netlify.app',
    ];
    if (page !== null) allowed.push(page);

    const headers = event.headers ?? {};
    const origin  = headers.origin ?? null;
    const allowOrigin = origin && allowed.includes(origin) ? origin : null;

    const cors = {
        ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {}),
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': headers['access-control-request-headers'] || 'Content-Type, Authorization, X-Api-Key',
        'Content-Type': 'application/json',
        'Vary': 'Origin',
    };

    // Preflight: answer for allowed origins, refuse the rest.
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: allowOrigin ? 204 : 403, headers: cors, body: '' };
    }

    // No Origin header → same-origin or non-browser. Nothing for CORS to decide.
    if (!origin) return cors;

    if (!allowOrigin) {
        console.warn('CORS: origin not allowed:', origin);
        return {
            statusCode: 403,
            headers: cors,
            body: JSON.stringify({ error: 'Origin not allowed', origin }),
        };
    }

    return cors;
}
