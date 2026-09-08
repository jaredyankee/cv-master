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
 * 401 without a valid Neon Auth token; 500 if the function has no NEON_AUTH_BASE_URL.
 */
export async function handler(event) {
    const cors = CORS(event);

    const json = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });

    if (event.httpMethod !== "GET") {
        return json(405, { message: "Method not allowed" });
    }

    let user;
    try {
        user = await requireUser(event);
    } catch (err) {
        console.error("resume-dump auth:", err.message);
        return authErrorResponse(err, cors);
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
