import { getAuthToken } from './auth'

/**
 * Fetch wrapper for our Netlify functions.
 * Attaches the Neon Auth JWT as a bearer token when the user is signed in;
 * the functions identify the user from that token, never from the payload.
 *
 * @param {string} endpoint  e.g. "/resume-dump?ping=true"
 * @param {string} method
 * @param {Record<string,string>} [headers]
 * @param {any} [payload]   JSON-encoded when provided
 */
export const appRequest = async (endpoint, method, headers = {}, payload) => {
    if (!endpoint) {
        return {
            ok: false,
            message: "endpoint is missing from request"
        }
    }

    // `npm run demo`: fictional data, served in the browser. MODE is a
    // build-time constant, so production bundles drop this branch and the
    // demo files with it.
    if (import.meta.env.MODE === "demo") {
        const { demoRequest } = await import("./demo/server.js");
        return demoRequest(endpoint, method, payload);
    }

    // Relative outside local dev, so every deploy (production, a deploy
    // preview, a branch deploy) calls its own functions. A hardcoded
    // production URL had previews running new UI against old functions.
    const baseUrl = import.meta.env.VITE_CURRENT_ENVIRONMENT == "localenvironment"
        ? "http://localhost:8888/.netlify/functions"
        : "/.netlify/functions";

    const requestUrl = `${baseUrl}${endpoint}`;
    const token = await getAuthToken();

    const requestData = {
        method,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...headers,
        },
    };
    if (payload !== undefined) requestData.body = JSON.stringify(payload);

    return fetch(requestUrl, requestData);
}
