import Anthropic from "@anthropic-ai/sdk"
import { SYSTEM_PROMPTS } from "../registry/prompts.js"
import { JOB_APPLICATION_TOOL, FIT_LEVELS, INTENT_CATEGORIES } from "../registry/schema.js"
import { getResumeDumpByUser } from "../db/resume-dump.js"
import { shapeDump } from "./resume-dump.js"
import {
    insertJobApplication,
    getJobApplication,
    listJobApplications as listJobApplicationRows,
} from "../db/job-applications.js"

// Fit assessment + resume assembly is judgment-heavy, so this uses the
// current Opus with adaptive thinking (on by default there). Forced tool_choice
// is fine alongside thinking on the Claude API.
export const MODEL = "claude-opus-5"
const MAX_TOKENS = 16000

// ── shaping ──────────────────────────────────────────────────

/** Maps a job_applications row to the Application shape the UI uses. */
export const shapeApplication = (row) => ({
    id:          row.id,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
    status:      row.status,
    companyName: row.company_name ?? "",
    jobTitle:    row.job_title ?? "",
    jobDescription: row.job_description,
    notes:       row.notes ?? "",
    questions:   Array.isArray(row.additional_questions) ? row.additional_questions : [],
    response: row.fit_level
        ? {
            fit_criteria: { level: row.fit_level, rationale: row.fit_rationale ?? "" },
            job_application: {
                contact:    row.app_contact ?? {},
                summary:    row.app_summary ?? "",
                experience: row.app_experience ?? [],
                education:  row.app_education ?? [],
                skills:     row.app_skills ?? [],
            },
            cover_letter: {
                mission: row.cl_mission ?? "",
                culture: row.cl_culture ?? "",
                intents: row.cl_intents ?? [],
            },
            notes:     row.ai_notes ?? "",
            answers:   row.ai_answers ?? [],
            ai_filter: row.ai_filter_detected
                ? { detected: true, detail: row.ai_filter_detail ?? "" }
                : null,
        }
        : null,
})

// ── request building ─────────────────────────────────────────

const str = v => (typeof v === "string" ? v.trim() : "")

/**
 * Builds the messages.create() payload. Exported so the prompt shape can be
 * tested without calling the API.
 *
 * The dump goes in a cache-marked system block: a user firing off several
 * applications in a row re-reads it from cache instead of paying for it again.
 */
export function buildRequest(dump, { jobDescription, notes = "", questions = [] }) {
    const sections = [
        `JOB DESCRIPTION:\n${str(jobDescription)}`,
    ]
    if (str(notes)) sections.push(`NOTES FROM THE CANDIDATE:\n${str(notes)}`)
    const qs = (questions ?? []).map(str).filter(Boolean)
    if (qs.length) sections.push(`QUESTIONS THE APPLICATION ASKS:\n${qs.map((q, i) => `${i + 1}. ${q}`).join("\n")}`)

    return {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: "adaptive" },
        system: [
            { type: "text", text: SYSTEM_PROMPTS.BUILD_JOB_APPLICATION },
            {
                type: "text",
                text: `RESUME DUMP (the candidate's complete profile, JSON):\n${JSON.stringify(dump, null, 2)}`,
                cache_control: { type: "ephemeral" },
            },
        ],
        tools: [JOB_APPLICATION_TOOL],
        tool_choice: { type: "tool", name: JOB_APPLICATION_TOOL.name },
        messages: [{ role: "user", content: sections.join("\n\n") }],
    }
}

// ── result validation ────────────────────────────────────────

const arr = v => (Array.isArray(v) ? v : [])
const strs = v => arr(v).map(str).filter(Boolean)

/**
 * Coerces the tool input into exactly what the row needs. Anything the model
 * got structurally wrong is dropped rather than stored. Throws only when the
 * fit level is unusable, since the row cannot be written without it.
 */
export function normalizeResult(input) {
    const level = str(input?.fit_criteria?.level)
    if (!FIT_LEVELS.includes(level)) {
        throw new Error(`Model returned an unknown fit level: ${JSON.stringify(level)}`)
    }
    const ja = input.job_application ?? {}
    const cl = input.cover_letter ?? {}
    const contact = ja.contact ?? {}

    return {
        company_name:  str(input.company_name) || null,
        job_title:     str(input.job_title) || null,
        fit_level:     level,
        fit_rationale: str(input.fit_criteria?.rationale) || null,
        app_contact: {
            name:     str(contact.name),
            title:    str(contact.title),
            location: str(contact.location),
            email:    str(contact.email),
            phone:    str(contact.phone),
            links:    strs(contact.links),
        },
        app_summary: str(ja.summary) || null,
        app_experience: arr(ja.experience).map(e => ({
            company:    str(e?.company),
            title:      str(e?.title),
            startDate:  str(e?.startDate),
            endDate:    str(e?.endDate),
            highlights: strs(e?.highlights),
        })).filter(e => e.company || e.title),
        app_education: arr(ja.education).map(e => ({
            school:     str(e?.school),
            startDate:  str(e?.startDate),
            endDate:    str(e?.endDate),
            highlights: strs(e?.highlights),
        })).filter(e => e.school),
        app_skills: arr(ja.skills).map(s => ({
            category: str(s?.category),
            items:    strs(s?.items),
        })).filter(s => s.items.length),
        cl_mission: str(cl.mission) || null,
        cl_culture: str(cl.culture) || null,
        cl_intents: arr(cl.intents).map(i => ({
            category:   INTENT_CATEGORIES.includes(i?.category) ? i.category : "warning",
            confidence: Math.max(0, Math.min(100, Math.round(Number(i?.confidence) || 0))),
            rationale:  str(i?.rationale),
            ...(str(i?.blurb) ? { blurb: str(i.blurb) } : {}),
        })).filter(i => i.rationale),
        ai_notes: str(input.notes) || null,
        ai_answers: arr(input.answers).map(a => ({
            question: str(a?.question),
            answer:   str(a?.answer),
        })).filter(a => a.question),
        ai_filter_detected: Boolean(input.ai_filter?.detected),
        ai_filter_detail:   input.ai_filter?.detected ? (str(input.ai_filter.detail) || null) : null,
    }
}

// ── handlers ─────────────────────────────────────────────────

/**
 * Background handler: load the dump, run the model, write the row.
 *
 * @param {string} apiKey
 * @param {{ userId: string, id: string, jobDescription: string, notes?: string, questions?: string[] }} payload
 * @returns {Promise<{ ok: true, application: object } | { ok: false, error: string }>}
 */
export const createJobApplication = async (apiKey, payload) => {
    const { userId, id, jobDescription, notes = "", questions = [] } = payload ?? {}
    if (!userId) return { ok: false, error: "User id is missing" }
    if (!id)     return { ok: false, error: "Application id is missing" }
    if (!str(jobDescription)) return { ok: false, error: "Job description is missing" }

    const dumpRow = await getResumeDumpByUser(userId)
    if (!dumpRow) return { ok: false, error: "No resume dump on file for this user" }
    const dump = shapeDump(dumpRow)

    const anthropic = new Anthropic({ apiKey })
    let response
    try {
        response = await anthropic.messages.create(buildRequest(dump, { jobDescription, notes, questions }))
    } catch (err) {
        if (err instanceof Anthropic.AuthenticationError) {
            return { ok: false, error: "Anthropic rejected the API key (401)" }
        }
        if (err instanceof Anthropic.RateLimitError) {
            return { ok: false, error: "Anthropic rate limit hit (429); try again shortly" }
        }
        if (err instanceof Anthropic.APIError) {
            console.error(`Anthropic API error ${err.status}:`, err.message)
            return { ok: false, error: `Anthropic API error ${err.status}` }
        }
        throw err
    }

    console.log(
        `job-application response: stop_reason=${response.stop_reason} blocks=${response.content?.length ?? 0} ` +
        `usage=${JSON.stringify(response.usage ?? {})}`
    )

    if (response.stop_reason === "refusal") {
        return { ok: false, error: `Model declined the request${response.stop_details?.category ? ` (${response.stop_details.category})` : ""}` }
    }

    const toolUse = response.content?.find(block => block.type === "tool_use")
    if (!toolUse?.input) {
        return { ok: false, error: `Model returned no tool_use block (stop_reason=${response.stop_reason})` }
    }

    let fields
    try {
        fields = normalizeResult(toolUse.input)
    } catch (err) {
        return { ok: false, error: err.message }
    }

    const row = await insertJobApplication({
        id,
        user_id:              userId,
        resume_dump_id:       dumpRow.id,
        job_description:      str(jobDescription),
        notes:                str(notes) || null,
        additional_questions: strs(questions),
        ...fields,
    })

    return { ok: true, application: shapeApplication(row) }
}

/** Poll target: the shaped application if its row exists for this user, else null. */
export const getJobApplicationPoll = async (userId, id) => {
    const row = await getJobApplication(userId, id)
    return row ? shapeApplication(row) : null
}

/** All of the user's applications, newest first, shaped for the UI. */
export const listJobApplications = async (userId) => {
    const rows = await listJobApplicationRows(userId)
    return rows.map(shapeApplication)
}
