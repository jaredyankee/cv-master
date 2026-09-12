import { SYSTEM_PROMPTS } from "../registry/prompts.js"
import {
    insertResumeDump,
    insertResumeDumpDiff,
    getResumeDumpResult,
    getResumeDumpByUser,
    updateResumeDump,
    finalizeResumeDumpDiff,
    cacheAndResetResumeDump,
    clearCachedDump,
} from "../db/resume-dump.js";
import { ensureUser, saveApiKey, getKeyStatus } from "../db/users.js";
import { structured } from "../lib/providers/index.js";
import { RESUME_DUMP_TOOL } from "../registry/schema.js";
import { str, text, strList, objList } from "../lib/normalize.js";

/** Maps a resume_dumps row (snake_case columns) to the ResumeDump shape the UI uses. */
export const shapeDump = (input) => {
    // Callers guard for a missing row, but a dump shaped from nothing should be
    // an empty dump, not a crash — this runs on every load and every save.
    const row = input ?? {}
    return {
        contact: {
            name:     row.contact_name,
            email:    row.contact_email,
            phone:    row.contact_phone,
            location: row.contact_location,
            links:    row.contact_links ?? [],
        },
        positioning:  row.positioning,
        education:    row.education   ?? [],
        experience:   row.experience  ?? [],
        freelance:    row.freelance   ?? [],
        projects:     row.projects    ?? [],
        portfolio:    row.portfolio,
        skills:       row.skills      ?? [],
        gaps:         row.gaps        ?? [],
        workingStyle: row.working_style,
        lookingFor:   row.looking_for,
        // Part of the profile, so a rebuild caches and recovers them with the
        // rest rather than stranding them on a profile that no longer exists.
        answers:      row.answers ?? [],
    }
}

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
 * A row existing at all is what "this user has dumped before" means — it is
 * only ever created by a completed ingestion — so the response carries no
 * separate flag for it. `dump_state` says where in the regenerate flow they
 * are, and the client routes on that.
 *
 * @param {string} user_id
 * @returns {Promise<{ resume_dump: object, revisions: any[], questions: any[], finalized: boolean, dump_state: string, source_text: string|null, cached_dump: object|null, cached_at: string|null, has_api_key: boolean } | null>}
 */
export const getResumeDump = async (user_id) => {
    const row = await getResumeDumpByUser(user_id)
    if (!row) return null

    return {
        resume_dump: shapeDump(row),
        revisions:   row.revisions ?? [],
        questions:   row.questions ?? [],
        finalized:   Boolean(row.onboarding_finalized || row.diff_finalized),
        dump_state:  row.dump_state ?? 'READY',
        source_text: row.source_text ?? null,
        cached_dump: row.cached_dump ?? null,
        cached_at:   row.cached_at ?? null,
        ...(await keyStatusFields(user_id)),
    }
}

/**
 * Which provider the user is on and which providers they already have a key
 * for, so the form can mark the key field optional per provider instead of
 * asking again for one already on file.
 */
const keyStatusFields = async (user_id) => {
    const { provider, configured } = await getKeyStatus(user_id)
    return {
        provider,
        configured_providers: configured,
        // Kept for the existing client contract: a key for the active provider.
        has_api_key: configured.includes(provider),
    }
}

/**
 * What a regeneration should put in the cache slot, given the dump row it is
 * about to clear. `null` means "leave whatever is cached alone".
 *
 * Regenerating straight off the review screen is the common way to reject a
 * bad extraction. Caching that extraction would overwrite the reviewed profile
 * it replaced — the one actually worth keeping — so an unreviewed dump never
 * displaces an existing cache.
 *
 * @param {object} row  a resume_dumps row
 * @returns {object|null} the outgoing profile in ResumeDump shape, or null
 */
export const cacheSnapshotFor = (row) => {
    const outgoingWasReviewed = Boolean(row?.onboarding_finalized)
    if (row?.cached_dump && !outgoingWasReviewed) return null
    return shapeDump(row)
}

/**
 * Starts a regeneration. The profile the user has now moves to the cache slot
 * and the live dump is emptied, so the dashboard shows the "generate" state
 * rather than a half-real profile.
 *
 * Refuses when the live dump is already cleared: a second regenerate would
 * overwrite the cache with an empty snapshot and lose the profile the first
 * one was protecting.
 *
 * @param {string} userId
 * @param {'NEW'|'REVISE'} mode
 */
export const startDumpRegeneration = async (userId, mode) => {
    if (!userId) return { ok: false, error: "User id is missing" }
    if (mode !== "NEW" && mode !== "REVISE") {
        return { ok: false, error: "mode must be NEW or REVISE" }
    }

    const row = await getResumeDumpByUser(userId)
    if (!row) return { ok: false, error: "No resume dump on file for this user" }
    if (row.dump_state && row.dump_state !== "READY") {
        return { ok: false, error: "A regeneration is already in progress" }
    }

    // Close out any review the user walked away from instead of finalizing.
    // The rebuild replaces the profile that review was about, so it is no
    // longer pending on anything — and left open it would sit in the table as
    // a candidate "latest unfinalized diff" forever.
    await finalizeResumeDumpDiff(userId)

    const updated = await cacheAndResetResumeDump(userId, mode, cacheSnapshotFor(row))
    if (!updated) return { ok: false, error: "No resume dump on file for this user" }

    return { ok: true, data: dumpStateResponse(updated) }
}

/**
 * Puts the cached profile back and returns to READY. Used both by the cache
 * chip's "Recover" and as the way out of a regeneration the user changed their
 * mind about.
 *
 * The restored profile keeps its finalized flag: it was a reviewed profile
 * before it was cached, and recovering it is not a new extraction to review.
 */
export const recoverCachedDump = async (userId) => {
    if (!userId) return { ok: false, error: "User id is missing" }

    const row = await getResumeDumpByUser(userId)
    if (!row) return { ok: false, error: "No resume dump on file for this user" }
    if (!row.cached_dump) return { ok: false, error: "There is nothing cached to recover" }

    const restored = await updateResumeDump(userId, normalizeDump(row.cached_dump), {
        finalized:  true,
        dumpState:  "READY",
        clearCache: true,
    })
    if (!restored) return { ok: false, error: "No resume dump on file for this user" }

    return { ok: true, data: dumpStateResponse(restored) }
}

/** Drops the cached profile. The live dump is untouched. */
export const clearDumpCache = async (userId) => {
    if (!userId) return { ok: false, error: "User id is missing" }
    const row = await clearCachedDump(userId)
    if (!row) return { ok: false, error: "No resume dump on file for this user" }
    return { ok: true, data: dumpStateResponse(row) }
}

/** The slice of a dump row the lifecycle endpoints hand back to the client. */
const dumpStateResponse = (row) => ({
    resume_dump: shapeDump(row),
    dump_state:  row.dump_state ?? "READY",
    source_text: row.source_text ?? null,
    cached_dump: row.cached_dump ?? null,
    cached_at:   row.cached_at ?? null,
    finalized:   Boolean(row.onboarding_finalized),
})

/**
 * Entry point for POST /resume-dump — the dump lifecycle actions that are not
 * an ingestion. Kept in one place so the handler stays a thin switch.
 *
 * @param {string} userId
 * @param {{ action?: string, mode?: string }} body
 */
export const runDumpAction = async (userId, body) => {
    const action = body?.action
    switch (action) {
        case "regenerate":  return startDumpRegeneration(userId, body?.mode)
        case "recover":     return recoverCachedDump(userId)
        case "clear-cache": return clearDumpCache(userId)
        default:
            return { ok: false, error: `Unknown action: ${action ?? "(none)"}` }
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
        // The review's probe questions and what the user said back. `placed`
        // marks an answer already merged into a section, so the dashboard
        // doesn't show it a second time as a loose note.
        answers: objList(d.answers, a => ({
            question:  text(a.question),
            reference: text(a.reference),
            answer:    text(a.answer),
            section:   str(a.section),
            placed:    Boolean(a.placed),
        }), a => a.question && a.answer),
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

export const createResumeDump = async (apiKey, payload, provider) => {
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
    
    const system = SYSTEM_PROMPTS["CREATE_RESUME_DUMP"];
    const user = payload.resume_dump;

    // Extraction, not judgment: a mid-tier model reads free text into fields
    // perfectly well, and the frontier model's price is the user's to pay.
    const result = await structured({
        provider,
        apiKey,
        role: "extraction",
        system,
        user,
        tool: {
            name: "emit_resume_dump",
            description: "Returns the resume_dump",
            input_schema: RESUME_DUMP_TOOL.input_schema,
        },
        maxTokens: 8192,
    });

    if (!result.ok) {
        console.error("An error occured building the resume dump:", result.error);
        return { ok: false, error: result.error };
    }

    const data = result.data;

    try {
        // database updates
        // 1. users row must exist before resume_dumps can reference it
        await ensureUser(userId);

        // 2. store the encrypted key — non-fatal. If ENCRYPTION_KEY is
        //    misconfigured the dump should still be saved; the user just
        //    re-enters the key next time.
        try {
            await saveApiKey(userId, provider, apiKey);
        } catch (keyErr) {
            console.error("Could not store the API key (continuing):", keyErr.message);
        }

        // 3. the dump and its review diff. The raw text is stored
        //    alongside so "Revise full dump" can hand the user back their
        //    own words instead of the model's paraphrase of them.
        const dump = await insertResumeDump(userId, data.resume_dump, { sourceText: user });
        await insertResumeDumpDiff(userId, dump.id, data.revisions, data.questions);


        return { ok: true, result: data }
    } catch (err) {
        console.error("An error occured storing the resume dump", err);
        return { ok: false, error: err?.message ?? String(err) };
    }
}