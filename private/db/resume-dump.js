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
