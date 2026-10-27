import { fnRegistry } from "../../private/registry/registry.js";
import { CORS } from "../../private/cors/cors.js";
import { requireUser } from "../../private/lib/auth.js";
import { bodyTooLarge } from "../../private/lib/limits.js";
import { resolveApiKey } from "../../private/lib/request-key.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @fn resume-review-background
 * Netlify background function — 202 immediately, then up to 15 minutes.
 *
 * The hiring manager's read of one application's built resume, on request:
 * after the resume is edited, or for a long shot the automatic pass skipped.
 * The automatic pass runs inside job-application-background.
 *
 * POST only. Body: { applicationId: uuid, reviewId: uuid }
 * Poll GET /job-application?id=… until data.hmReview.id === reviewId.
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
        console.error("resume-review-background auth:", err.message);
        return { statusCode: err.status ?? 401, body: JSON.stringify({ message: "Unauthorized" }) };
    }

    let body;
    try {
        body = JSON.parse(event.body ?? "");
    } catch {
        return { statusCode: 400, body: JSON.stringify({ message: "Body is not valid JSON" }) };
    }
    if (!(UUID.test(body?.applicationId ?? "") && UUID.test(body?.reviewId ?? ""))) {
        return { statusCode: 400, body: JSON.stringify({ message: "applicationId and reviewId must be UUIDs" }) };
    }

    const { apiKey, provider } = await resolveApiKey(event, body, user.userId, "resume-review-background");
    if (!apiKey) {
        console.error(`resume-review-background: no ${provider} key available for this user`);
        return { statusCode: 400, body: JSON.stringify({ message: `No ${provider} API key on file` }) };
    }

    try {
        const result = await fnRegistry("job-application:REVIEW")(
            apiKey, { userId: user.userId, applicationId: body.applicationId, reviewId: body.reviewId }, provider);
        if (!result?.ok) console.error("resume-review-background failed:", result?.error);
    } catch (err) {
        console.error("Background resume review error:", err);
    }

    return { statusCode: 202 };
}
