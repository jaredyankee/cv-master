import { SYSTEM_PROMPTS } from "../registry/prompts.js"
import { structured } from "../lib/providers/index.js"
import { HIRING_REVIEW_TOOL, REVIEW_VERDICTS } from "../registry/schema.js"
import { getJobApplication, updateHiringReview } from "../db/job-applications.js"
import { signature } from "../lib/signature.js"
import { shapeApplication } from "./job-application.js"

const str = v => (typeof v === "string" ? v.trim() : "")
const arr = v => (Array.isArray(v) ? v : [])
const MAX_POINTS = 6

/** Fit levels the review skips unless asked: rule 5, don't spend on long shots. */
export const SKIP_AUTO_REVIEW = new Set(["Mismatch", "Out of Reach"])

/** Coerces the tool input; anything structurally wrong is dropped. */
export function normalizeReview(input) {
    return {
        verdict: REVIEW_VERDICTS.includes(input?.verdict) ? input.verdict : "Maybe",
        summary: str(input?.summary),
        strengths: arr(input?.strengths).map(s => ({
            point:       str(s?.point),
            requirement: str(s?.requirement),
        })).filter(s => s.point).slice(0, MAX_POINTS),
        concerns: arr(input?.concerns).map(c => ({
            point:       str(c?.point),
            requirement: str(c?.requirement),
            question:    str(c?.question),
        })).filter(c => c.point).slice(0, MAX_POINTS),
    }
}

/**
 * Reviews the built resume as the role's hiring manager would.
 *
 * Deliberately sent the posting and the resume only — not the dump. A real
 * reader sees just the resume, and a reviewer that knows the whole profile
 * fills in what the resume left out. That also keeps the call small: the
 * dump is the big input, and this one never pays for it.
 *
 * Reviews the resume as it is now, edits included. `signature` records which
 * version that was, so the UI can say when it has changed since. The result
 * or the error is written under `reviewId`, so a poll always ends.
 *
 * @returns {Promise<{ ok: true, application: object } | { ok: false, error: string }>}
 */
export const reviewBuiltResume = async (apiKey, { userId, applicationId, reviewId }, provider) => {
    if (!userId)        return { ok: false, error: "User id is missing" }
    if (!applicationId) return { ok: false, error: "Application id is missing" }
    if (!reviewId)      return { ok: false, error: "Review id is missing" }

    const row = await getJobApplication(userId, applicationId)
    if (!row) return { ok: false, error: "Application not found" }
    const resume = shapeApplication(row).response?.job_application
    if (!resume) return { ok: false, error: "There is no built resume to review" }

    const fail = async (error) => {
        await updateHiringReview(userId, applicationId, { ...(row.hm_review ?? {}), id: reviewId, error })
        return { ok: false, error }
    }

    // Reading two short documents against each other: the extraction-size
    // model does this well, and it runs on every application.
    const result = await structured({
        provider,
        apiKey,
        role: "extraction",
        system: SYSTEM_PROMPTS.REVIEW_RESUME,
        user: [
            `JOB DESCRIPTION:\n${str(row.job_description)}`,
            `RESUME (JSON):\n${JSON.stringify(resume, null, 2)}`,
        ].join("\n\n"),
        tool: HIRING_REVIEW_TOOL,
        maxTokens: 4000,
    })
    if (!result.ok) {
        const hint = result.status === 401 ? " — check the API key for this provider"
            : result.status === 429 ? " — rate limited, try again shortly"
            : ""
        return fail(`${result.provider ?? "model"} request failed: ${result.error}${hint}`)
    }

    const updated = await updateHiringReview(userId, applicationId, {
        id: reviewId,
        reviewedAt: new Date().toISOString(),
        signature: signature(resume),
        ...normalizeReview(result.data),
    })
    return updated ? { ok: true, application: shapeApplication(updated) } : { ok: false, error: "Application not found" }
}
