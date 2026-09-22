import { fnRegistry } from "../../private/registry/registry.js";
import { CORS } from "../../private/cors/cors.js";
import { requireUser, authErrorResponse } from "../../private/lib/auth.js";
import { bodyTooLarge } from "../../private/lib/limits.js";

/**
 * @fn job-search
 * Authenticated. The user comes from the bearer token.
 *
 * Leads and run state (the leads panel polls this while a search runs):
 *   GET /job-search        → { leads, preferences, run, configured }
 *
 * The preferences form, seeded from the dump the first time:
 *   GET /job-search?form=1 → { preferences, seeded }
 *
 * Save preferences (never starts a search — that is the background function):
 *   PUT /job-search        → { ok: true, preferences, run, hasKey }
 *   body: { preferences, searchKey? }
 *
 * Hide a lead so a later run doesn't resurface it:
 *   PUT /job-search?dismiss=<lead id> → { ok: true, lead }
 */
export async function handler(event) {
    const cors = CORS(event);
    if (cors?.statusCode) return cors;

    const json = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });

    const method = event.httpMethod;
    if (method !== "GET" && method !== "PUT") {
        return json(405, { message: "Method not allowed" });
    }

    if (method === "PUT") {
        const tooLarge = bodyTooLarge(event, cors);
        if (tooLarge) return tooLarge;
    }

    let user;
    try {
        user = await requireUser(event);
    } catch (err) {
        console.error("job-search auth:", err.message);
        return authErrorResponse(err, cors);
    }

    const params = event.queryStringParameters ?? {};

    try {
        if (method === "PUT") {
            let body;
            try {
                body = JSON.parse(event.body ?? "");
            } catch {
                return json(400, { message: "Body is not valid JSON" });
            }

            if (params.dismiss) {
                const fn = fnRegistry("job-search:DISMISS");
                const result = await fn(user.userId, params.dismiss);
                if (!result.ok) return json(result.error === "Lead not found" ? 404 : 400, { message: result.error });
                return json(200, result);
            }

            const fn = fnRegistry("job-search:PREFS");
            const result = await fn(user.userId, body.preferences, body.searchKey);
            if (!result.ok) return json(400, { message: result.error });
            return json(200, { ok: true, ...result });
        }

        if (params.form) {
            const fn = fnRegistry("job-search:FORM");
            return json(200, await fn(user.userId));
        }

        const fn = fnRegistry("job-search:GET");
        return json(200, await fn(user.userId));
    } catch (err) {
        console.error("Error in job-search:", err);
        return json(500, { message: "Internal server error" });
    }
}
