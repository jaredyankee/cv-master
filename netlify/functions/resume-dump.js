import { fnRegistry } from "../../private/registry/registry.js";
import { CORS } from "../../private/cors/cors.js";

/**
 * @fn resume-dump
 * GET endpoint with two modes, both keyed by user_id.
 *
 * Load (app start — does this user already have a dump?):
 *   GET /resume-dump?user_id=...            → { exists: false }
 *                                           → { exists: true, data: { resume_dump, revisions, questions, finalized } }
 *
 * Poll (while resume-dump-background processes the AI call):
 *   GET /resume-dump?ping=true&user_id=...  → { ready: false }   (still processing)
 *                                           → { ready: true, data: { resume_dump, revisions, questions } }
 */
export async function handler(event, context) {
    //const cors = CORS(event);
    //if (cors?.statusCode) {
    //    console.log("Returning cors");
    //    return cors;
    //}
    console.log(JSON.stringify(event.headers, null, 2));
    const method = event.httpMethod;
    const params = event.queryStringParameters ?? {};

    if (method !== "GET") {
        return { statusCode: 405, body: JSON.stringify({ message: "Method not allowed" }) };
    }

    if (!params.user_id) {
        return { statusCode: 400, body: JSON.stringify({ message: "user_id is required" }) };
    }

    const isPing = Boolean(params.ping);
    const fn = fnRegistry(isPing ? "registry-dump:GET" : "registry-dump:LOAD");

    try {
        const result = await fn(params.user_id);
        const body = isPing
            ? (result ? { ready: true, data: result }  : { ready: false })
            : (result ? { exists: true, data: result } : { exists: false });

        return { statusCode: 200, body: JSON.stringify(body) };
    } catch (err) {
        console.error(`Error ${isPing ? "polling" : "loading"} resume-dump:`, err);
        return { statusCode: 500, body: JSON.stringify({ message: "Internal server error" }) };
    }
}
