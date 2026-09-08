import { fnRegistry } from "../../private/registry/registry.js";
import { CORS } from "../../private/cors/cors.js";
import { requireUser } from "../../private/lib/auth.js";

/**
 * @fn resume-dump-background
 * Netlify background function — Netlify returns 202 to the client immediately
 * and gives this function up to 15 minutes to complete.
 *
 * Runs the AI ingestion of the resume dump and writes the structured
 * result + diff to the DB. The UI polls /resume-dump?ping=true for completion.
 *
 * Because the 202 is sent before this code runs, any status returned here is
 * invisible to the client. Auth failures are logged and the job is skipped;
 * the client already checks for a session before calling.
 *
 * POST only.
 * Headers:
 *   Authorization — Bearer <Neon Auth JWT>  (identifies the user)
 *   x-api-key     — Anthropic API key (BYOK)
 * Body:
 *   { resume_dump }
 */
export async function handler(event) {
    const cors = CORS(event);
    if (cors?.statusCode) {
        console.error("Returning cors");
        return cors;
    }

    const method = event.httpMethod;
    const headers = event.headers;

    if (method !== "POST") {
        console.error("Method not allowed")
        return { statusCode: 405, body: JSON.stringify({ message: "Method not allowed" }) };
    }

    // Env diagnostic — names and lengths only, never values.
    const envReport = ["DATABASE_URL", "ENCRYPTION_KEY", "SEYONA_KEY", "ANTHROPIC_API_KEY", "NEON_AUTH_BASE_URL", "NEON_AUTH_JWKS_URL"]
        .map(k => `${k}=${process.env[k] === undefined ? "UNSET" : `set(len ${process.env[k].length})`}`)
        .join(" ");
    console.log(`env: ${envReport} | CONTEXT=${process.env.CONTEXT ?? "?"} DEPLOY_ID=${process.env.DEPLOY_ID ?? "?"}`);

    let user;
    try {
        user = await requireUser(event);
    } catch (err) {
        console.error("resume-dump-background auth:", err.message);
        return { statusCode: err.status ?? 401, body: JSON.stringify({ message: "Unauthorized" }) };
    }

    // BYOK: the Anthropic key comes from the form via the X-Api-Key header.
    // Netlify lowercases incoming header names. ANTHROPIC_API_KEY in the site
    // env is an optional fallback for single-user deployments.
    const apiKey = (headers["x-api-key"] ?? process.env.ANTHROPIC_API_KEY ?? "").trim();
    if (!apiKey) {
        console.error("resume-dump-background: no Anthropic key in x-api-key header or ANTHROPIC_API_KEY env");
        return { statusCode: 401, body: JSON.stringify({ message: "No API key in request" }) };
    }
    // Safe fingerprint — enough to tell "wrong key" from "no key" without logging the secret
    console.log(
        `Anthropic key source=${headers["x-api-key"] ? "header" : "env"} ` +
        `len=${apiKey.length} prefix=${apiKey.slice(0, 7)} suffix=${apiKey.slice(-4)}`
    );

    if (!event?.body) {
        console.error("No body found in request");
        return { statusCode: 400, body: JSON.stringify({ message: "No body found in request" }) };
    }

    const body = JSON.parse(event.body);
    const fn = fnRegistry("registry-dump:POST");

    try {
        await fn(apiKey, { user_id: user.userId, resume_dump: body.resume_dump });
    } catch (err) {
        console.error("Background resume-dump error:", err);
    }

    // Response body is ignored by Netlify for background functions (202 sent immediately)
    return { statusCode: 202 };
}
