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
 *
 * Save an edited built resume:
 *   PUT /job-application?id=<uuid>  → { ok: true, data: Application }
 *   body: { job_application }
 */
export async function handler(event) {
    const cors = CORS(event);
    if (cors?.statusCode) return cors;

    const json = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });

    const method = event.httpMethod;
    if (method !== "GET" && method !== "PUT") {
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

    if (method === "PUT") {
        if (!params.id) return json(400, { message: "id is required" });

        let body;
        try {
            body = JSON.parse(event.body ?? "");
        } catch {
            return json(400, { message: "Body is not valid JSON" });
        }

        try {
            const save = fnRegistry("job-application:PUT");
            const result = await save(user.userId, params.id, body.job_application);
            if (!result.ok) return json(result.error === "Application not found" ? 404 : 400, { message: result.error });
            return json(200, { ok: true, data: result.application });
        } catch (err) {
            console.error("Error saving job-application:", err);
            return json(500, { message: "Internal server error" });
        }
    }

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
