import { fnRegistry } from "../../private/registry/registry.js";
import { CORS } from "../../private/cors/cors.js";
import { requireUser } from "../../private/lib/auth.js";
import { getApiKey } from "../../private/db/users.js";
import { normalizeProvider } from "../../private/lib/providers/index.js";
import { bodyTooLarge } from "../../private/lib/limits.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @fn job-application-background
 * Netlify background function — 202 is returned to the client immediately;
 * this code then has up to 15 minutes.
 *
 * Loads the user's resume dump, sends it with the posting to the model, and
 * inserts the finished application row. The client polls
 * GET /job-application?id=<the id it generated> until the row exists.
 *
 * POST only.
 * Headers:
 *   Authorization — Bearer <Neon Auth JWT>
 *   x-api-key     — optional Anthropic key; falls back to the user's stored key
 * Body:
 *   { id: uuid (client-generated), jobDescription, notes?, questions?: string[] }
 */
export async function handler(event) {
    const cors = CORS(event);
    if (cors?.statusCode) return cors;

    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: JSON.stringify({ message: "Method not allowed" }) };
    }

    // Before auth on purpose: a multi-megabyte body shouldn't buy a JWKS fetch,
    // a Neon round trip, or fifteen minutes of background function time.
    const oversized = bodyTooLarge(event, cors);
    if (oversized) return oversized;

    let user;
    try {
        user = await requireUser(event);
    } catch (err) {
        console.error("job-application-background auth:", err.message);
        return { statusCode: err.status ?? 401, body: JSON.stringify({ message: "Unauthorized" }) };
    }

    if (!event.body) {
        return { statusCode: 400, body: JSON.stringify({ message: "No body found in request" }) };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch {
        return { statusCode: 400, body: JSON.stringify({ message: "Body is not valid JSON" }) };
    }

    if (!UUID.test(body.id ?? "")) {
        console.error("job-application-background: missing or invalid id");
        return { statusCode: 400, body: JSON.stringify({ message: "id must be a UUID" }) };
    }
    if (!body.jobDescription?.trim()) {
        return { statusCode: 400, body: JSON.stringify({ message: "jobDescription is required" }) };
    }

    // BYOK. Header first, then the key stored for the provider the user
    // asked for — never another provider's key against this one's endpoint.
    const requested = normalizeProvider(body.provider ?? event.headers["x-api-provider"]);
    let provider = requested;
    let apiKey = (event.headers["x-api-key"] ?? "").trim();
    if (!apiKey) {
        try {
            const stored = await getApiKey(user.userId, requested);
            if (stored.apiKey) { apiKey = stored.apiKey; provider = stored.provider; }
        } catch (err) {
            console.error("job-application-background: could not read stored API key:", err.message);
        }
    }
    if (!apiKey && provider === "anthropic") apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
    if (!apiKey) {
        console.error(`job-application-background: no ${provider} key available for this user`);
        return { statusCode: 400, body: JSON.stringify({ message: `No ${provider} API key on file` }) };
    }

    const fn = fnRegistry("job-application:POST");
    try {
        const result = await fn(apiKey, {
            userId:         user.userId,
            id:             body.id,
            jobDescription: body.jobDescription,
            notes:          body.notes ?? "",
            questions:      Array.isArray(body.questions) ? body.questions : [],
        }, provider);
        if (!result?.ok) console.error("job-application-background failed:", result?.error);
    } catch (err) {
        console.error("Background job-application error:", err);
    }

    // Response body is ignored by Netlify for background functions (202 sent immediately)
    return { statusCode: 202 };
}
