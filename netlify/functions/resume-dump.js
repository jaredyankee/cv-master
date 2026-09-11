import { fnRegistry } from "../../private/registry/registry.js";
import { CORS } from "../../private/cors/cors.js";
import { requireUser, authErrorResponse } from "../../private/lib/auth.js";

/**
 * @fn resume-dump
 * GET, authenticated. The user comes from the bearer token, never from the query.
 *
 * Load (app start — does this user already have a dump?):
 *   GET /resume-dump             → { exists: false }
 *                                → { exists: true, data: { resume_dump, revisions, questions, finalized } }
 *
 * Poll (while resume-dump-background processes the AI call):
 *   GET /resume-dump?ping=true   → { ready: false }   (still processing)
 *                                → { ready: true, data: { resume_dump, revisions, questions } }
 *
 * Save (user edits, and the review's "Finalize profile"):
 *   PUT /resume-dump             → { ok: true, data: { resume_dump } }
 *   body: { resume_dump, finalized? }
 *
 * Lifecycle (regenerating a dump without losing the old one):
 *   POST /resume-dump            → { ok: true, data: { resume_dump, dump_state, source_text, cached_dump, cached_at, finalized } }
 *   body: { action: "regenerate", mode: "NEW" | "REVISE" }
 *         { action: "recover" }      — put the cached profile back
 *         { action: "clear-cache" }  — drop the cached profile
 *
 * 401 without a valid Neon Auth token; 500 if the function has no NEON_AUTH_BASE_URL.
 */
export async function handler(event) {
    const cors = CORS(event);
    if (cors?.statusCode) return cors;

    const json = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });

    const method = event.httpMethod;
    if (method !== "GET" && method !== "PUT" && method !== "POST") {
        return json(405, { message: "Method not allowed" });
    }

    let user;
    try {
        user = await requireUser(event);
    } catch (err) {
        console.error("resume-dump auth:", err.message);
        return authErrorResponse(err, cors);
    }

    if (method === "PUT" || method === "POST") {
        let body;
        try {
            body = JSON.parse(event.body ?? "");
        } catch {
            return json(400, { message: "Body is not valid JSON" });
        }

        if (method === "POST") {
            try {
                const act = fnRegistry("registry-dump:ACT");
                const result = await act(user.userId, body);
                if (!result.ok) return json(400, { message: result.error });
                return json(200, { ok: true, data: result.data });
            } catch (err) {
                console.error("Error running resume-dump action:", err);
                return json(500, { message: "Internal server error" });
            }
        }

        try {
            const save = fnRegistry("registry-dump:PUT");
            const result = await save(user.userId, body.resume_dump, { finalized: body.finalized });
            if (!result.ok) return json(400, { message: result.error });
            return json(200, { ok: true, data: { resume_dump: result.resume_dump } });
        } catch (err) {
            console.error("Error saving resume-dump:", err);
            return json(500, { message: "Internal server error" });
        }
    }

    const params = event.queryStringParameters ?? {};
    const isPing = Boolean(params.ping);
    const fn = fnRegistry(isPing ? "registry-dump:GET" : "registry-dump:LOAD");

    try {
        const result = await fn(user.userId);
        const body = isPing
            ? (result ? { ready: true, data: result }  : { ready: false })
            : (result ? { exists: true, data: result } : { exists: false });
        return json(200, body);
    } catch (err) {
        console.error(`Error ${isPing ? "polling" : "loading"} resume-dump:`, err);
        return json(500, { message: "Internal server error" });
    }
}
