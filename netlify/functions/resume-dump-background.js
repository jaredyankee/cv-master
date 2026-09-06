import { fnRegistry } from "../../private/registry/registry.js";
import { CORS } from "../../private/cors/cors.js";

/**
 * @fn resume-dump-background
 * Netlify background function — Netlify returns 202 to the client immediately
 * and gives this function up to 15 minutes to complete.
 *
 * Runs the AI ingestion of the resume dump and writes the structured
 * result + diff to the DB. The UI polls /resume-dump?ping=true for completion.
 *
 * POST only.
 * Headers:
 *   x-api-key  — Anthropic API key (self-serve)
 * Body:
 *   { user_id, resume_dump }
 */
export async function handler(event, context) {
    const cors = CORS(event);
    if (cors?.statusCode) return cors;

    const method = event.httpMethod;
    const headers = event.headers;

    if (method !== "POST") {
        return { statusCode: 405, body: JSON.stringify({ message: "Method not allowed" }) };
    }

    if (!headers["x-api-key"]) {
        return { statusCode: 401, body: JSON.stringify({ message: "No API key in request" }) };
    }

    if (!event?.body) {
        return { statusCode: 400, body: JSON.stringify({ message: "No body found in request" }) };
    }

    const body = JSON.parse(event.body);
    console.log("trying request");
    const fn = fnRegistry("registry-dump:POST");

    try {
        console.log("trying fn");
        await fn(headers["x-api-key"], body);
    } catch (err) {
        console.error("Background resume-dump error:", err);
    }

    // Response body is ignored by Netlify for background functions (202 sent immediately)
    return { statusCode: 202 };
}
