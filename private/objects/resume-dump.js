import Anthropic from "@anthropic-ai/sdk"
import { SYSTEM_PROMPTS } from "../registry/prompts.js"
import {
    insertResumeDump,
    insertResumeDumpDiff,
    getResumeDumpResult,
    getResumeDumpByUser,
    updateResumeDump,
    finalizeResumeDumpDiff,
} from "../db/resume-dump.js";
import { ensureUser, saveApiKey } from "../db/users.js";
import { RESUME_DUMP_TOOL } from "../registry/schema.js";
import { str, text, strList, objList } from "../lib/normalize.js";

/** Maps a resume_dumps row (snake_case columns) to the ResumeDump shape the UI uses. */
export const shapeDump = (row) => ({
    contact: {
        name:     row.contact_name,
        email:    row.contact_email,
        phone:    row.contact_phone,
        location: row.contact_location,
        links:    row.contact_links    ?? [],
    },
    positioning:  row.positioning,
    education:    row.education        ?? [],
    experience:   row.experience       ?? [],
    freelance:    row.freelance         ?? [],
    projects:     row.projects         ?? [],
    portfolio:    row.portfolio,
    skills:       row.skills           ?? [],
    gaps:         row.gaps             ?? [],
    workingStyle: row.working_style,
    lookingFor:   row.looking_for,
})

/**
 * Polling handler for the GET /resume-dump?ping endpoint.
 * Returns null if the background job hasn't written results yet,
 * or { resume_dump, revisions, questions } once it has.
 *
 * @param {string} user_id
 * @returns {Promise<{ resume_dump: object, revisions: any[], questions: any[] } | null>}
 */
export const getResumeDumpPoll = async (user_id) => {
    const row = await getResumeDumpResult(user_id)
    if (!row) return null

    return {
        resume_dump: shapeDump(row),
        revisions:   row.revisions ?? [],
        questions:   row.questions ?? [],
    }
}

/**
 * Load handler for GET /resume-dump?user_id=... (no ping).
 * Returns null if the user has never completed a dump, otherwise the dump
 * plus the latest review diff so the UI can go straight to the dashboard
 * (and still offer "Edit profile" → review).
 *
 * @param {string} user_id
 * @returns {Promise<{ resume_dump: object, revisions: any[], questions: any[], finalized: boolean } | null>}
 */
export const getResumeDump = async (user_id) => {
    const row = await getResumeDumpByUser(user_id)
    if (!row) return null

    return {
        resume_dump: shapeDump(row),
        revisions:   row.revisions ?? [],
        questions:   row.questions ?? [],
        finalized:   Boolean(row.onboarding_finalized || row.diff_finalized),
    }
}

/**
 * Coerces a client-submitted dump into the exact shape the columns expect.
 * Unknown keys are dropped; nothing is invented.
 *
 * @param {object} dump
 * @returns {object} a ResumeDump safe to persist
 */
export const normalizeDump = (dump) => {
    const d = dump ?? {}
    const c = d.contact ?? {}

    const role = e => ({
        company:     str(e.company),
        title:       str(e.title),
        startDate:   str(e.startDate),
        endDate:     str(e.endDate),
        description: text(e.description),
        // Context-only: the model may use it to judge fit, but must not put
        // it on a built resume. Set by the user, never inferred.
        excludeFromResume: Boolean(e.excludeFromResume),
    })

    return {
        contact: {
            name:     str(c.name),
            email:    str(c.email),
            phone:    str(c.phone),
            location: str(c.location),
            links:    strList(c.links),
        },
        positioning: text(d.positioning),
        education: objList(d.education, e => ({
            school:    str(e.school),
            degree:    str(e.degree),
            field:     str(e.field),
            startDate: str(e.startDate),
            endDate:   str(e.endDate),
            notes:     text(e.notes),
        }), e => e.school || e.degree || e.field),
        experience: objList(d.experience, role, e => e.company || e.title),
        freelance:  objList(d.freelance,  role, e => e.company || e.title),
        projects: objList(d.projects, p => ({
            name:              str(p.name),
            description:       text(p.description),
            links:             strList(p.links),
            excludeFromResume: Boolean(p.excludeFromResume),
        }), p => p.name || p.description),
        portfolio: text(d.portfolio),
        skills: objList(d.skills, s => ({
            category: str(s.category),
            items:    strList(s.items),
        }), s => s.category && s.items.length),
        gaps:         strList(d.gaps),
        workingStyle: text(d.workingStyle),
        lookingFor:   text(d.lookingFor),
    }
}

/**
 * Persists a user-edited dump. Used both by the section editors and by the
 * review step's "Finalize profile", which passes finalized: true.
 *
 * @param {string} userId
 * @param {object} dump
 * @param {{ finalized?: boolean }} [options]
 * @returns {Promise<{ ok: true, resume_dump: object } | { ok: false, error: string }>}
 */
export const saveResumeDump = async (userId, dump, { finalized } = {}) => {
    if (!userId) return { ok: false, error: "User id is missing" }
    if (!dump || typeof dump !== "object") return { ok: false, error: "resume_dump is missing" }

    const normalized = normalizeDump(dump)
    const row = await updateResumeDump(userId, normalized, { finalized })
    if (!row) return { ok: false, error: "No resume dump on file for this user" }

    if (finalized) await finalizeResumeDumpDiff(userId)

    return { ok: true, resume_dump: shapeDump(row) }
}

export const createResumeDump = async (apiKey, payload) => {
    // return if ID/dump already exists; can't have multiple dumps yet
    //@todo id checks when DB gets implemented
    if (!payload?.user_id) {
        return {
            ok: false,
            error: "User id is missing"
        };
    }
    const userId = payload.user_id;
    if (!payload?.resume_dump) {
        return {
            ok: false,
            error: {
                status: 400,
                message: "Resume dump is missing" 
            }
        };
    }
    
    // The apiKey option is sent as the x-api-key header on every request and
    // takes precedence over the ANTHROPIC_API_KEY env var.
    const anthropic = new Anthropic({ apiKey });
    
    const system = SYSTEM_PROMPTS["CREATE_RESUME_DUMP"];
    const user = payload.resume_dump;

    try {
        const response = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 8192, // @todo verify token usage
            system,
            tools: [
                {
                    name: "emit_resume_dump",
                    description: "Returns the resume_dump",
                    input_schema: RESUME_DUMP_TOOL.input_schema
                }
            ],
            tool_choice: { type: "tool", name: "emit_resume_dump" },
            messages: [
                {
                    role: "user",
                    content: user
                }
            ]
        });
        // Log shape/usage only — the content block holds the user's full profile.
        console.log(`resume-dump response: stop_reason=${response.stop_reason} blocks=${response.content?.length ?? 0} usage=${JSON.stringify(response.usage ?? {})}`);

        const toolUse = response.content?.find(block => block.type === "tool_use");
        if (!toolUse?.input) {
            throw new Error("resume_dump returned no tool_use block", response?.stop_reason);
        }


        // checking to see the full shape of a anthropic message response
        if (response.content.length > 0) {
            let data = toolUse.input;

            // database updates
            // 1. users row must exist before resume_dumps can reference it
            await ensureUser(userId);

            // 2. store the encrypted key — non-fatal. If ENCRYPTION_KEY is
            //    misconfigured the dump should still be saved; the user just
            //    re-enters the key next time.
            try {
                await saveApiKey(userId, apiKey);
            } catch (keyErr) {
                console.error("Could not store the API key (continuing):", keyErr.message);
            }

            // 3. the dump and its review diff
            const dump = await insertResumeDump(userId, data.resume_dump);
            await insertResumeDumpDiff(userId, dump.id, data.revisions, data.questions);


            return {
                ok: true,
                result: data
            }
        }
    } catch (err) {
        // Anthropic SDK errors carry the HTTP status + the API's error body;
        // surface both so a 401 (bad key) vs 404 (bad model) is obvious in the logs.
        if (err?.status) {
            console.error(`Anthropic API error ${err.status}:`, JSON.stringify(err.error ?? err.message));
        }
        console.error("An error occured building the resume dump", err);
        return {
            ok: false,
            error: err
        };
    }

}