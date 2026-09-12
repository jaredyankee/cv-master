import { sql } from "./db.js"

/**
 * Returns the latest unfinalized diff + its parent dump for a user.
 * Used by the polling endpoint to check whether the background AI job has finished.
 * Returns null if the job hasn't written its results yet.
 *
 * `dump_state = 'READY'` is load-bearing, not decoration. A diff row is not
 * proof that *this* ingestion finished: diffs outlive the dump they describe,
 * and any review the user abandoned rather than finalized leaves one behind.
 * A rebuild empties the dump's columns while those old diffs sit untouched, so
 * without this clause the first poll after a resubmit joins the *emptied* dump
 * to a *stale* diff and reports ready — handing the UI a blank profile and
 * last time's revisions, seconds after submitting and long before the model
 * has answered. Only a completed ingestion puts the row back in READY.
 *
 * @param {string} user_id
 */
export const getResumeDumpResult = async (user_id) => {
    const [row] = await sql`
        SELECT
            d.contact_name,
            d.contact_email,
            d.contact_phone,
            d.contact_location,
            d.contact_links,
            d.positioning,
            d.education,
            d.experience,
            d.freelance,
            d.projects,
            d.portfolio,
            d.skills,
            d.gaps,
            d.working_style,
            d.looking_for,
            d.answers,
            diff.id        AS diff_id,
            diff.revisions,
            diff.questions
        FROM resume_dumps d
        JOIN resume_dump_diffs diff ON diff.resume_dump_id = d.id
        WHERE d.user_id = ${user_id}
          AND diff.finalized = FALSE
          AND d.dump_state = 'READY'
        ORDER BY diff.created_at DESC
        LIMIT 1
    `
    return row ?? null
}

/**
 * Returns the user's resume dump (there is at most one per user) joined
 * with their most recent diff, whether or not that diff is finalized.
 * Used on app load to decide between onboarding and the dashboard.
 * Returns null if the user has no dump yet.
 *
 * @param {string} user_id
 */
export const getResumeDumpByUser = async (user_id) => {
    const [row] = await sql`
        SELECT
            d.id,
            d.contact_name,
            d.contact_email,
            d.contact_phone,
            d.contact_location,
            d.contact_links,
            d.positioning,
            d.education,
            d.experience,
            d.freelance,
            d.projects,
            d.portfolio,
            d.skills,
            d.gaps,
            d.working_style,
            d.looking_for,
            d.answers,
            d.onboarding_finalized,
            d.dump_state,
            d.source_text,
            d.cached_dump,
            d.cached_at,
            diff.id        AS diff_id,
            diff.finalized AS diff_finalized,
            diff.revisions,
            diff.questions
        FROM resume_dumps d
        LEFT JOIN LATERAL (
            SELECT id, finalized, revisions, questions
            FROM resume_dump_diffs
            WHERE resume_dump_id = d.id
            ORDER BY created_at DESC
            LIMIT 1
        ) diff ON TRUE
        WHERE d.user_id = ${user_id}
        LIMIT 1
    `
    return row ?? null
}

/**
 * Inserts or updates a user's resume dump.
 * UPSERTS on user_id — one active dump per user.
 * Resets onboarding_finalized to FALSE on conflict (re-onboarding).
 * Returns the dump's UUID so the caller can insert the diff row.
 */
export const insertResumeDump = async (user_id, resume_dump, { sourceText } = {}) => {
    const {
        contact,
        positioning,
        education,
        experience,
        freelance,
        projects,
        portfolio,
        skills,
        gaps,
        workingStyle,
        lookingFor,
    } = resume_dump

    const [row] = await sql`
        INSERT INTO resume_dumps (
            user_id,
            contact_name,
            contact_email,
            contact_phone,
            contact_location,
            contact_links,
            positioning,
            education,
            experience,
            freelance,
            projects,
            portfolio,
            skills,
            gaps,
            working_style,
            looking_for,
            source_text,
            dump_state
        ) VALUES (
            ${user_id},
            ${contact.name        ?? null},
            ${contact.email       ?? null},
            ${contact.phone       ?? null},
            ${contact.location    ?? null},
            ${contact.links       ?? []},
            ${positioning         ?? null},
            ${JSON.stringify(education  ?? [])}::jsonb,
            ${JSON.stringify(experience ?? [])}::jsonb,
            ${JSON.stringify(freelance  ?? [])}::jsonb,
            ${JSON.stringify(projects   ?? [])}::jsonb,
            ${portfolio           ?? null},
            ${JSON.stringify(skills     ?? [])}::jsonb,
            ${gaps                ?? []},
            ${workingStyle        ?? null},
            ${lookingFor          ?? null},
            ${sourceText          ?? null},
            'READY'
        )
        ON CONFLICT (user_id) DO UPDATE SET
            contact_name         = EXCLUDED.contact_name,
            contact_email        = EXCLUDED.contact_email,
            contact_phone        = EXCLUDED.contact_phone,
            contact_location     = EXCLUDED.contact_location,
            contact_links        = EXCLUDED.contact_links,
            positioning          = EXCLUDED.positioning,
            education            = EXCLUDED.education,
            experience           = EXCLUDED.experience,
            freelance            = EXCLUDED.freelance,
            projects             = EXCLUDED.projects,
            portfolio            = EXCLUDED.portfolio,
            skills               = EXCLUDED.skills,
            gaps                 = EXCLUDED.gaps,
            working_style        = EXCLUDED.working_style,
            looking_for          = EXCLUDED.looking_for,
            -- Keep the text that produced this dump, so "Revise full dump"
            -- can hand the user back their own words. COALESCE so a caller
            -- that has no source text doesn't erase the stored one.
            source_text          = COALESCE(EXCLUDED.source_text, resume_dumps.source_text),
            -- A finished ingestion always lands in READY, whichever state the
            -- regenerate flow was in. cached_dump is deliberately untouched:
            -- the previous profile stays recoverable after the new one lands.
            dump_state           = 'READY',
            onboarding_finalized = FALSE
        RETURNING *
    `;

    return row
}

/**
 * Overwrites a user's dump with an edited copy.
 *
 * Distinct from insertResumeDump, which is the AI ingestion path and clears
 * `onboarding_finalized` because a fresh extraction needs reviewing again. A
 * user edit is a deliberate correction, so it leaves that flag alone unless
 * `finalized` is passed — which is how the review's "Finalize profile" marks
 * the dump as reviewed.
 *
 * Returns null when the user has no dump to update.
 *
 * `dumpState` and `clearCache` are what makes this the recover path too:
 * restoring a cached profile is the same column write plus a return to READY
 * and an emptied cache slot.
 *
 * @param {string} user_id
 * @param {object} resume_dump  the complete dump; the client sends all of it
 * @param {{ finalized?: boolean, dumpState?: 'NEW'|'REVISE'|'READY', clearCache?: boolean }} [options]
 */
export const updateResumeDump = async (user_id, resume_dump, { finalized, dumpState, clearCache = false } = {}) => {
    const {
        contact = {},
        positioning,
        education,
        experience,
        freelance,
        projects,
        portfolio,
        skills,
        gaps,
        workingStyle,
        lookingFor,
        answers,
    } = resume_dump

    const [row] = await sql`
        UPDATE resume_dumps SET
            contact_name         = ${contact.name     ?? null},
            contact_email        = ${contact.email    ?? null},
            contact_phone        = ${contact.phone    ?? null},
            contact_location     = ${contact.location ?? null},
            contact_links        = ${contact.links    ?? []},
            positioning          = ${positioning      ?? null},
            education            = ${JSON.stringify(education  ?? [])}::jsonb,
            experience           = ${JSON.stringify(experience ?? [])}::jsonb,
            freelance            = ${JSON.stringify(freelance  ?? [])}::jsonb,
            projects             = ${JSON.stringify(projects   ?? [])}::jsonb,
            portfolio            = ${portfolio        ?? null},
            skills               = ${JSON.stringify(skills     ?? [])}::jsonb,
            gaps                 = ${gaps             ?? []},
            working_style        = ${workingStyle     ?? null},
            looking_for          = ${lookingFor       ?? null},
            answers              = ${JSON.stringify(answers ?? [])}::jsonb,
            onboarding_finalized = COALESCE(${finalized ?? null}, onboarding_finalized),
            dump_state           = COALESCE(${dumpState ?? null}::dump_state, dump_state),
            cached_dump          = CASE WHEN ${clearCache} THEN NULL ELSE cached_dump END,
            cached_at            = CASE WHEN ${clearCache} THEN NULL ELSE cached_at   END
        WHERE user_id = ${user_id}
        RETURNING *
    `;

    return row ?? null
}

/**
 * Starts a regeneration: snapshots the profile the user has now into the cache
 * slot, empties the live columns, and records which flow they chose.
 *
 * The snapshot is passed in already shaped (camelCase, the shape the UI
 * renders) rather than assembled in SQL, so there is exactly one mapping
 * between columns and the ResumeDump shape and it lives in shapeDump.
 *
 * `source_text` survives on purpose — REVISE hands it straight back to the
 * user. So does the diff history; a new ingestion writes a fresh diff.
 *
 * @param {string} user_id
 * @param {'NEW'|'REVISE'} dump_state
 * @param {object|null} cached_dump  the outgoing profile in ResumeDump shape,
 *        or null to leave whatever is already cached in place
 */
export const cacheAndResetResumeDump = async (user_id, dump_state, cached_dump) => {
    const replaceCache = cached_dump != null
    const [row] = await sql`
        UPDATE resume_dumps SET
            cached_dump          = CASE WHEN ${replaceCache} THEN ${JSON.stringify(cached_dump ?? null)}::jsonb ELSE cached_dump END,
            cached_at            = CASE WHEN ${replaceCache} THEN NOW() ELSE cached_at END,
            dump_state           = ${dump_state}::dump_state,
            contact_name         = NULL,
            contact_email        = NULL,
            contact_phone        = NULL,
            contact_location     = NULL,
            contact_links        = ${[]},
            positioning          = NULL,
            education            = '[]'::jsonb,
            experience           = '[]'::jsonb,
            freelance            = '[]'::jsonb,
            projects             = '[]'::jsonb,
            portfolio            = NULL,
            skills               = '[]'::jsonb,
            gaps                 = ${[]},
            working_style        = NULL,
            looking_for          = NULL,
            answers              = '[]'::jsonb,
            onboarding_finalized = FALSE
        WHERE user_id = ${user_id}
        RETURNING *
    `
    return row ?? null
}

/**
 * Empties the cache slot without touching the live dump. The user has decided
 * they don't want the old profile back.
 */
export const clearCachedDump = async (user_id) => {
    const [row] = await sql`
        UPDATE resume_dumps
        SET cached_dump = NULL, cached_at = NULL
        WHERE user_id = ${user_id}
        RETURNING *
    `
    return row ?? null
}

/**
 * Marks the active review diff as finalized so the poll query stops
 * returning it. No-op when there is no unfinalized diff.
 */
export const finalizeResumeDumpDiff = async (user_id) => {
    await sql`
        UPDATE resume_dump_diffs
        SET finalized = TRUE
        WHERE user_id = ${user_id} AND finalized = FALSE
    `
}

/**
 * Inserts the AI's pending review (revisions + questions) for a dump.
 * A new row is created on each re-analysis; only the unfinalized row
 * is "active." Returns the diff's UUID.
 *
 */
export const insertResumeDumpDiff = async (user_id, resume_dump_id, revisions, questions) => {
    const [row] = await sql`
        INSERT INTO resume_dump_diffs (
            user_id,
            resume_dump_id,
            revisions,
            questions
        ) VALUES (
            ${user_id},
            ${resume_dump_id},
            ${JSON.stringify(revisions ?? [])}::jsonb,
            ${JSON.stringify(questions ?? [])}::jsonb
        )
        RETURNING *
    `;

    return row
}
