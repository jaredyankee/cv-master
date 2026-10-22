import { fnRegistry } from "../../private/registry/registry.js";
import { CORS } from "../../private/cors/cors.js";
import { requireUser, authErrorResponse } from "../../private/lib/auth.js";
import { bodyTooLarge } from "../../private/lib/limits.js";

/**
 * @fn cover-letter
 * GET and PUT, authenticated. The cover-letter paragraph bank.
 *
 * Read (also the poll after a review is requested):
 *   GET /cover-letter  → { ok: true, data: { blocks, review } }
 *
 * Save the whole bank:
 *   PUT /cover-letter  → { ok: true, data: { blocks, review } }
 *   body: { blocks: [{ key?, label, text, angles[] }] }
 *
 * The bank also arrives with GET /resume-dump on load, so this GET is only
 * hit while a review is running.
 */
export async function handler(event) {
    const cors = CORS(event);
    if (cors?.statusCode) return cors;

    const json = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });

    const oversized = bodyTooLarge(event, cors);
    if (oversized) return oversized;

    const method = event.httpMethod;
    if (method !== "GET" && method !== "PUT") {
        return json(405, { message: "Method not allowed" });
    }

    let user;
    try {
        user = await requireUser(event);
    } catch (err) {
        console.error("cover-letter auth:", err.message);
        return authErrorResponse(err, cors);
    }

    if (method === "PUT") {
        let body;
        try {
            body = JSON.parse(event.body ?? "");
        } catch {
            return json(400, { message: "Body is not valid JSON" });
        }
        try {
            const result = await fnRegistry("cover-letter:PUT")(user.userId, body?.blocks);
            if (!result.ok) return json(400, { message: result.error });
            return json(200, result);
        } catch (err) {
            console.error("Error saving cover-letter bank:", err);
            return json(500, { message: "Internal server error" });
        }
    }

    try {
        const result = await fnRegistry("cover-letter:GET")(user.userId);
        if (!result.ok) return json(404, { message: result.error });
        return json(200, result);
    } catch (err) {
        console.error("Error loading cover-letter bank:", err);
        return json(500, { message: "Internal server error" });
    }
}
