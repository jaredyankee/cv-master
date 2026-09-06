import { fnRegistry } from "../../private/registry/registry.js";
import { CORS } from "../../private/cors/cors.js";

/**
 * @fn resume-dump
 * GET endpoint — polling target while resume-dump-background processes the AI call.
 *
 * GET /resume-dump                       → 404 (nothing to get without ping)
 * GET /resume-dump?ping=true&user_id=... → { ready: false }   (still processing)
 *                                        → { ready: true, data: {...} } (done)
 */
export async function handler(event, context) {
    const cors = CORS(event);
    if (cors?.statusCode) {
        console.log("Returning cors");
        return cors;
    }

    const method = event.httpMethod;
    const params = event.queryStringParameters;

    if (method !== "GET") {
        return { statusCode: 405, body: JSON.stringify({ message: "Method not allowed" }) };
    }

    if (!params?.ping) {
        return { statusCode: 404, body: JSON.stringify({ message: "Not found" }) };
    }

    if (!params?.user_id) {
        return { statusCode: 400, body: JSON.stringify({ message: "user_id is required" }) };
    }

    const fn = fnRegistry("registry-dump:GET");
    try {
        const result = await fn(params.user_id);
        if (!result) {
            return {
                statusCode: 200,
                body: JSON.stringify({ ready: false })
            };
        }
        return {
            statusCode: 200,
            body: JSON.stringify({ ready: true, data: result })
        };
    } catch (err) {
        console.error("Error polling resume-dump:", err);
        return { statusCode: 500, body: JSON.stringify({ message: "Internal server error" }) };
    }
}
