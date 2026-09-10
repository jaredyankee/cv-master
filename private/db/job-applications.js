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
