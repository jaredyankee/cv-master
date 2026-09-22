import { fnRegistry } from "../../private/registry/registry.js";
import { CORS } from "../../private/cors/cors.js";
import { requireUser } from "../../private/lib/auth.js";
import { bodyTooLarge } from "../../private/lib/limits.js";

/**
 * @fn job-search-background
 * POST, authenticated. Starts a listing search and returns immediately.
 *
 *   body: { auto?: boolean }
 *
 * A background function because a search is several round trips to Perplexity
 * and would not finish inside the 10 s synchronous limit. The client does not
 * wait on it: the dashboard renders, and the leads panel polls
 * GET /job-search for the run to finish. Everything else — including starting
 * a job application — stays usable while it runs.
 *
 * `auto` marks the run that fires by itself when onboarding completes. It is
 * skipped if this user has searched before, so finishing the review again, or
 * rebuilding a profile, doesn't spend their Perplexity credit a second time.
 */
export async function handler(event) {
    const cors = CORS(event);
    if (cors?.statusCode) return cors;

    const json = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });

    if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

    const tooLarge = bodyTooLarge(event, cors);
    if (tooLarge) return tooLarge;

    let user;
    try {
        user = await requireUser(event);
    } catch (err) {
        console.error("job-search-background auth:", err.message);
        return json(err.status === 403 ? 403 : 401, { message: "Unauthorized" });
    }

    let body;
    try {
        body = event.body ? JSON.parse(event.body) : {};
    } catch {
        return json(400, { message: "Body is not valid JSON" });
    }

    try {
        const run = fnRegistry("job-search:RUN");
        const result = await run(user.userId, { auto: Boolean(body.auto) });
        // Nothing is returned to anyone — a background invocation's response is
        // discarded. Logged so a search that never produces leads can be told
        // apart from one that was never attempted.
        if (!result.ok) {
            console.error(`job search FAILED for sub=${user.userId}: ${result.error}`);
        } else if (result.skipped) {
            console.log(`job search skipped for sub=${user.userId}: ${result.skipped}`);
        } else {
            console.log(`job search ok for sub=${user.userId}: ${result.found} new`);
        }
    } catch (err) {
        console.error("Error running job search:", err);
    }

    return json(202, { started: true });
}
