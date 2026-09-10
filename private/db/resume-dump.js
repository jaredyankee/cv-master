import { sql } from "./db.js"

/**
 * Returns the latest unfinalized diff + its parent dump for a user.
 * Used by the polling endpoint to check whether the background AI job has finished.
 * Returns null if no unfinalized diff exists yet.
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
            diff.id        AS diff_id,
            diff.revisions,
            diff.questions
        FROM resume_dumps d
        JOIN resume_dump_diffs diff ON diff.resume_dump_id = d.id
        WHERE d.user_id = ${user_id}
          AND diff.finalized = FALSE
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
            d.onboarding_finalized,
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
export const insertResumeDump = async (user_id, resume_dump) => {
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
            looking_for
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
            ${lookingFor          ?? null}
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
 * @param {string} user_id
 * @param {object} resume_dump  the complete dump; the client sends all of it
 * @param {{ finalized?: boolean }} [options]
 */
export const updateResumeDump = async (user_id, resume_dump, { finalized } = {}) => {
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
            onboarding_finalized = COALESCE(${finalized ?? null}, onboarding_finalized)
        WHERE user_id = ${user_id}
        RETURNING *
    `;

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
