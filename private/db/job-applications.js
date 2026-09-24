import { sql } from "./db.js"

/**
 * job_applications — one row per application. The row is written once, after
 * the model has produced the fit assessment, built resume, and cover-letter
 * outline, so "the row exists" is the signal the UI polls for. The client
 * supplies the id up front so it can poll for exactly its own row.
 *
 * `status` is the user's lifecycle (draft → applied → …), not a processing
 * state. A row with fit_level IS NULL would mean the AI step is incomplete;
 * this module never writes such a row.
 */

/**
 * @param {object} a  everything for one row; JSON columns are passed as JS values
 */
export const insertJobApplication = async (a) => {
    const [row] = await sql`
        INSERT INTO job_applications (
            id,
            user_id,
            resume_dump_id,
            company_name,
            job_title,
            job_description,
            notes,
            additional_questions,
            fit_level,
            fit_rationale,
            app_contact,
            app_summary,
            app_experience,
            app_education,
            app_skills,
            cl_mission,
            cl_culture,
            cl_intents,
            ai_notes,
            ai_answers,
            ai_filter_detected,
            ai_filter_detail
        ) VALUES (
            ${a.id},
            ${a.user_id},
            ${a.resume_dump_id ?? null},
            ${a.company_name ?? null},
            ${a.job_title ?? null},
            ${a.job_description},
            ${a.notes ?? null},
            ${JSON.stringify(a.additional_questions ?? [])}::jsonb,
            ${a.fit_level}::fit_level,
            ${a.fit_rationale ?? null},
            ${JSON.stringify(a.app_contact ?? {})}::jsonb,
            ${a.app_summary ?? null},
            ${JSON.stringify(a.app_experience ?? [])}::jsonb,
            ${JSON.stringify(a.app_education ?? [])}::jsonb,
            ${JSON.stringify(a.app_skills ?? [])}::jsonb,
            ${a.cl_mission ?? null},
            ${a.cl_culture ?? null},
            ${JSON.stringify(a.cl_intents ?? [])}::jsonb,
            ${a.ai_notes ?? null},
            ${JSON.stringify(a.ai_answers ?? [])}::jsonb,
            ${a.ai_filter_detected ?? false},
            ${a.ai_filter_detail ?? null}
        )
        RETURNING *
    `
    return row
}

/**
 * Overwrites the built-resume columns of one application with an edited copy.
 * The fit assessment, cover-letter outline, and the user's own inputs are left
 * alone: editing the resume is tailoring the deliverable, not re-running the
 * analysis that produced it.
 *
 * Scoped to the owner, so an id alone is not enough to write to a row.
 * Returns null when the application doesn't exist or isn't theirs.
 *
 * @param {string} user_id
 * @param {string} id
 * @param {object} ja  the complete job_application object
 */
export const updateJobApplicationResume = async (user_id, id, ja) => {
    const [row] = await sql`
        UPDATE job_applications SET
            app_contact    = ${JSON.stringify(ja.contact    ?? {})}::jsonb,
            app_summary    = ${ja.summary ?? null},
            app_experience = ${JSON.stringify(ja.experience ?? [])}::jsonb,
            app_education  = ${JSON.stringify(ja.education  ?? [])}::jsonb,
            app_skills     = ${JSON.stringify(ja.skills     ?? [])}::jsonb,
            updated_at     = now()
        WHERE id = ${id} AND user_id = ${user_id}
        RETURNING *
    `
    return row ?? null
}

/**
 * Moves one application along the user's lifecycle. Nothing else on the row is
 * touched: where an application has got to is not a fact about the analysis.
 *
 * Scoped to the owner, like every other write here. Returns null when the
 * application doesn't exist or isn't theirs.
 *
 * @param {string} user_id
 * @param {string} id
 * @param {string} status  a label of job_application_status
 */
export const updateJobApplicationStatus = async (user_id, id, status) => {
    const [row] = await sql`
        UPDATE job_applications SET
            status     = ${status}::job_application_status,
            updated_at = now()
        WHERE id = ${id} AND user_id = ${user_id}
        RETURNING *
    `
    return row ?? null
}

/**
 * Removes one application for good. A lead it was started from keeps its row:
 * job_leads.job_application_id is ON DELETE SET NULL, so the listing goes back
 * to being one you haven't applied to.
 *
 * Scoped to the owner. Returns null when the application doesn't exist or
 * isn't theirs.
 *
 * @param {string} user_id
 * @param {string} id
 */
export const deleteJobApplication = async (user_id, id) => {
    const [row] = await sql`
        DELETE FROM job_applications
        WHERE id = ${id} AND user_id = ${user_id}
        RETURNING id
    `
    return row ?? null
}

/**
 * The labels of the job_application_status enum, in their declared order.
 *
 * Read from Postgres rather than written out here. The enum lives in the
 * database, so a list in JS would be a copy, and a copy that drifts doesn't
 * fail loudly — it fails as `invalid input value for enum` on the write, after
 * the user has clicked. Asking the type itself cannot drift.
 *
 * The declared order is the pipeline order, which is what "advance" walks.
 *
 * Cached per warm instance: the type changes with a migration, not with a
 * request, and every query is Neon compute the site owner pays for.
 */
let cachedStatuses = null

export const listStatusValues = async () => {
    if (cachedStatuses) return cachedStatuses
    const rows = await sql`
        SELECT enumlabel
        FROM pg_enum
        JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
        WHERE pg_type.typname = 'job_application_status'
        ORDER BY pg_enum.enumsortorder
    `
    cachedStatuses = rows.map(r => r.enumlabel)
    return cachedStatuses
}

/** One application, scoped to its owner. Returns null if it doesn't exist or isn't theirs. */
export const getJobApplication = async (user_id, id) => {
    const [row] = await sql`
        SELECT * FROM job_applications
        WHERE id = ${id} AND user_id = ${user_id}
        LIMIT 1
    `
    return row ?? null
}

/** All of a user's applications, newest first. */
export const listJobApplications = async (user_id) => {
    return sql`
        SELECT * FROM job_applications
        WHERE user_id = ${user_id}
        ORDER BY created_at DESC
    `
}
