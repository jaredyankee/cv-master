import { fnRegistry } from "../../private/registry/registry.js";
import { CORS } from "../../private/cors/cors.js";
import { requireUser } from "../../private/lib/auth.js";
import { getApiKey } from "../../private/db/users.js";
import { normalizeProvider } from "../../private/lib/providers/index.js";
import { bodyTooLarge } from "../../private/lib/limits.js";

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

    // Before auth on purpose: a multi-megabyte body shouldn't buy a JWKS fetch,
    // a Neon round trip, or fifteen minutes of background function time.
    const oversized = bodyTooLarge(event, cors);
    if (oversized) return oversized;

    // Env diagnostic — names and lengths only, never values.
    const envReport = ["DATABASE_URL", "ENCRYPTION_KEY", "SEYONA_KEY", "ANTHROPIC_API_KEY", "NEON_AUTH_BASE_URL", "NEON_AUTH_JWKS_URL"]
        .map(k => `${k}=${process.env[k] === undefined ? "UNSET" : `set(len ${process.env[k].length})`}`)
        .join(" ");
    console.log(`env: ${envReport} | CONTEXT=${process.env.CONTEXT ?? "?"} DEPLOY_ID=${process.env.DEPLOY_ID ?? "?"}`);

    if (!event?.body) {
        console.error("No body found in request");
        return { statusCode: 400, body: JSON.stringify({ message: "No body found in request" }) };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch {
        return { statusCode: 400, body: JSON.stringify({ message: "Body is not valid JSON" }) };
    }

    let user;
    try {
        user = await requireUser(event);
    } catch (err) {
        console.error("resume-dump-background auth:", err.message);
        return { statusCode: err.status ?? 401, body: JSON.stringify({ message: "Unauthorized" }) };
    }

    // BYOK. The provider comes from the form (or the user's stored choice),
    // and the key must be the one for *that* provider — pairing one provider's
    // key with another's endpoint is an opaque 401.
    const requested = normalizeProvider(body?.provider ?? headers["x-api-provider"]);
    let provider = requested;
    let apiKey = (headers["x-api-key"] ?? "").trim();
    let keySource = apiKey ? "header" : null;

    if (!apiKey) {
        try {
            const stored = await getApiKey(user.userId, requested);
            if (stored.apiKey) { apiKey = stored.apiKey.trim(); provider = stored.provider; keySource = "stored"; }
        } catch (err) {
            // A tampered or undecryptable value shouldn't take the request
            // down; fall through to the env key and then to the 401.
            console.error("Could not read the stored API key (continuing):", err.message);
        }
    }
    if (!apiKey && provider === "anthropic") {
        apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
        if (apiKey) keySource = "env";
    }

    if (!apiKey) {
        console.error(`resume-dump-background: no ${provider} key in the request, on file for this user, or in env`);
        return { statusCode: 401, body: JSON.stringify({ message: "No API key in request" }) };
    }
    // Safe fingerprint — enough to tell "wrong key" from "no key" without logging the secret
    console.log(
        `key provider=${provider} source=${keySource} ` +
        `len=${apiKey.length} prefix=${apiKey.slice(0, 7)} suffix=${apiKey.slice(-4)}`
    );

    const fn = fnRegistry("registry-dump:POST");

    // The 202 already went out, so this log is the only record of how the job
    // went. createResumeDump reports failure by returning { ok: false } rather
    // than throwing, and dropping that on the floor is why a failed ingestion
    // used to look identical to a successful one in the logs.
    try {
        const result = await fn(apiKey, { user_id: user.userId, resume_dump: body.resume_dump }, provider);
        if (result?.ok) {
            console.log(`resume-dump ingestion finished for sub=${user.userId}`);
        } else {
            const reason = result?.error?.message ?? result?.error ?? "no result returned";
            console.error(`resume-dump ingestion FAILED for sub=${user.userId}: ${typeof reason === "string" ? reason : JSON.stringify(reason)}`);
        }
    } catch (err) {
        console.error("Background resume-dump error:", err);
    }

    // Response body is ignored by Netlify for background functions (202 sent immediately)
    return { statusCode: 202 };
}
