import { fnRegistry } from "../../private/registry/registry.js";
import { CORS } from "../../private/cors/cors.js";
import { requireUser } from "../../private/lib/auth.js";
import { bodyTooLarge } from "../../private/lib/limits.js";
import { resolveApiKey } from "../../private/lib/request-key.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @fn cover-letter-background
 * Netlify background function — 202 immediately, then up to 15 minutes.
 *
 * POST only. Body is one of:
 *   { action: "review", reviewId: uuid }
 *       Proofread the paragraph bank. Poll GET /cover-letter until
 *       data.review.id === reviewId.
 *   { action: "build", applicationId: uuid, buildId: uuid }
 *       Build one application's letter. Poll GET /job-application?id=… until
 *       data.coverLetter.id === buildId.
 *
 * Either way the result, or the error, is written under the client's id, so
 * the poll ends rather than running out its budget.
 *
 * Headers:
 *   Authorization — Bearer <Neon Auth JWT>
 *   x-api-key     — optional; falls back to the user's stored key
 */
export async function handler(event) {
    const cors = CORS(event);
    if (cors?.statusCode) return cors;

    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: JSON.stringify({ message: "Method not allowed" }) };
    }

    const oversized = bodyTooLarge(event, cors);
    if (oversized) return oversized;

    let user;
    try {
        user = await requireUser(event);
    } catch (err) {
        console.error("cover-letter-background auth:", err.message);
        return { statusCode: err.status ?? 401, body: JSON.stringify({ message: "Unauthorized" }) };
    }

    let body;
    try {
        body = JSON.parse(event.body ?? "");
    } catch {
        return { statusCode: 400, body: JSON.stringify({ message: "Body is not valid JSON" }) };
    }

    const isReview = body?.action === "review";
    const isBuild  = body?.action === "build";
    if (!isReview && !isBuild) {
        return { statusCode: 400, body: JSON.stringify({ message: "action must be review or build" }) };
    }
    if (isReview && !UUID.test(body.reviewId ?? "")) {
        return { statusCode: 400, body: JSON.stringify({ message: "reviewId must be a UUID" }) };
    }
    if (isBuild && !(UUID.test(body.applicationId ?? "") && UUID.test(body.buildId ?? ""))) {
        return { statusCode: 400, body: JSON.stringify({ message: "applicationId and buildId must be UUIDs" }) };
    }

    const { apiKey, provider } = await resolveApiKey(event, body, user.userId, "cover-letter-background");
    if (!apiKey) {
        console.error(`cover-letter-background: no ${provider} key available for this user`);
        return { statusCode: 400, body: JSON.stringify({ message: `No ${provider} API key on file` }) };
    }

    try {
        const result = isReview
            ? await fnRegistry("cover-letter:REVIEW")(apiKey, { userId: user.userId, reviewId: body.reviewId }, provider)
            : await fnRegistry("cover-letter:BUILD")(apiKey, { userId: user.userId, applicationId: body.applicationId, buildId: body.buildId }, provider);
        if (!result?.ok) console.error(`cover-letter-background ${body.action} failed:`, result?.error);
    } catch (err) {
        console.error("Background cover-letter error:", err);
    }

    return { statusCode: 202 };
}
