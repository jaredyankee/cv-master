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

    let baseUrl;
    if (import.meta.env.VITE_CURRENT_ENVIRONMENT == "localenvironment") {
        baseUrl = "http://localhost:8888/.netlify/functions";
    } else {
        baseUrl = "https://cvmaster-jy.netlify.app/.netlify/functions";
    }

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
