import { fnRegistry } from "../../private/registry/registry.js";
import { CORS } from "../../private/cors/cors.js";
import { requireUser, authErrorResponse } from "../../private/lib/auth.js";

/**
 * @fn job-application
 * GET, authenticated. The user comes from the bearer token.
 *
 * Poll (after POST /job-application-background):
 *   GET /job-application?id=<uuid>  → { ready: false }
 *                                   → { ready: true, data: Application }
 *
 * List (dashboard load):
 *   GET /job-application            → { applications: Application[] }   newest first
 */
export async function handler(event) {
    const cors = CORS(event);
    if (cors?.statusCode) return cors;

    const json = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });

    if (event.httpMethod !== "GET") {
        return json(405, { message: "Method not allowed" });
    }

    let user;
    try {
        user = await requireUser(event);
    } catch (err) {
        console.error("job-application auth:", err.message);
        return authErrorResponse(err, cors);
    }

    const params = event.queryStringParameters ?? {};

    try {
        if (params.id) {
            const fn = fnRegistry("job-application:GET");
            const app = await fn(user.userId, params.id);
            return json(200, app ? { ready: true, data: app } : { ready: false });
        }
        const fn = fnRegistry("job-application:LIST");
        const applications = await fn(user.userId);
        return json(200, { applications });
    } catch (err) {
        console.error(`Error ${params.id ? "polling" : "listing"} job-application:`, err);
        return json(500, { message: "Internal server error" });
    }
}
