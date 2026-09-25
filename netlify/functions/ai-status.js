import { fnRegistry } from "../../private/registry/registry.js";
import { CORS } from "../../private/cors/cors.js";
import { requireUser, authErrorResponse } from "../../private/lib/auth.js";

/**
 * @fn ai-status
 * GET, authenticated. The user comes from the bearer token.
 *
 * Which provider and models this user's AI calls go to, and which keys are on
 * file — each key as its last four characters only:
 *
 *   GET /ai-status → { ok: true, provider, providers: [{ id, label, active,
 *                      key: { set, last4, unreadable? },
 *                      models: { reasoning, extraction } }],
 *                      search: { id, label, key } }
 *
 * Fetched when the user opens the panel, not on every dashboard load: it
 * decrypts each stored key to find its hint, and that is work worth doing
 * only when someone is looking.
 */
export async function handler(event) {
    const cors = CORS(event);
    if (cors?.statusCode) return cors;

    // Key hints are per-user and not for any shared cache to keep.
    const headers = { ...cors, "Cache-Control": "no-store" };
    const json = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

    if (event.httpMethod !== "GET") return json(405, { message: "Method not allowed" });

    let user;
    try {
        user = await requireUser(event);
    } catch (err) {
        console.error("ai-status auth:", err.message);
        return authErrorResponse(err, cors);
    }

    try {
        const fn = fnRegistry("ai-status:GET");
        const result = await fn(user.userId);
        if (!result.ok) return json(400, { message: result.error });
        return json(200, result);
    } catch (err) {
        // The message only: nothing on this path holds a key by the time it
        // could throw, but there is no reason to print more than we need.
        console.error("Error reading ai-status:", err?.message ?? err);
        return json(500, { message: "Internal server error" });
    }
}
