import { fnRegistry } from "../../private/registry/registry.js";
import { CORS } from "../../private/cors/cors.js";
import { requireUser, authErrorResponse } from "../../private/lib/auth.js";

/**
 * @fn job-application
 * GET, PUT and DELETE, authenticated. The user comes from the bearer token.
 *
 * Poll (after POST /job-application-background):
 *   GET /job-application?id=<uuid>  → { ready: false }
 *                                   → { ready: true, data: Application }
 *
 * List (dashboard load):
 *   GET /job-application            → { applications: Application[], statuses: string[] }
 *                                     applications newest first; statuses in pipeline order
 *
 * Save an edited built resume:
 *   PUT /job-application?id=<uuid>  → { ok: true, data: Application }
 *   body: { job_application }
 *
 * Move it along the user's lifecycle:
 *   PUT /job-application?id=<uuid>  → { ok: true, data: Application }
 *   body: { status }
 *
 * Delete it:
 *   DELETE /job-application?id=<uuid> → { ok: true, id }
 *                                     404 when it doesn't exist or isn't theirs
 *
 * The two PUTs are separate paths on purpose. Editing the resume rewrites the
 * deliverable; changing the status records what happened to it. A single
 * handler taking both would let a status change carry a resume body.
 */
export async function handler(event) {
    const cors = CORS(event);
    if (cors?.statusCode) return cors;

    const json = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });

    const method = event.httpMethod;
    if (method !== "GET" && method !== "PUT" && method !== "DELETE") {
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

    if (method === "DELETE") {
        if (!params.id) return json(400, { message: "id is required" });
        try {
            const fn = fnRegistry("job-application:DEL");
            const result = await fn(user.userId, params.id);
            if (!result.ok) return json(result.error === "Application not found" ? 404 : 400, { message: result.error });
            return json(200, result);
        } catch (err) {
            console.error("Error deleting job-application:", err);
            return json(500, { message: "Internal server error" });
        }
    }

    if (method === "PUT") {
        if (!params.id) return json(400, { message: "id is required" });

        let body;
        try {
            body = JSON.parse(event.body ?? "");
        } catch {
            return json(400, { message: "Body is not valid JSON" });
        }

        // Which write this is, decided by what the body carries. Sending both
        // is a mistake worth naming rather than resolving by precedence.
        const wantsStatus = body?.status !== undefined;
        const wantsResume = body?.job_application !== undefined;
        if (wantsStatus && wantsResume) {
            return json(400, { message: "Send either job_application or status, not both" });
        }
        if (!wantsStatus && !wantsResume) {
            return json(400, { message: "Body must carry job_application or status" });
        }

        try {
            const save = fnRegistry(wantsStatus ? "job-application:STAT" : "job-application:PUT");
            const result = wantsStatus
                ? await save(user.userId, params.id, body.status)
                : await save(user.userId, params.id, body.job_application);
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
        // { applications, statuses }
        return json(200, await fn(user.userId));
    } catch (err) {
        console.error(`Error ${params.id ? "polling" : "listing"} job-application:`, err);
        return json(500, { message: "Internal server error" });
    }
}
