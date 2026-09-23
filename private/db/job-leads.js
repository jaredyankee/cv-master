import { sql } from "./db.js"

/**
 * job_leads and job_search_preferences.
 *
 * A lead is a listing someone found for you: a link, and whatever could be
 * read off the search result. It is not an application and never becomes one
 * by itself — promoting a lead goes through the normal job_applications flow
 * so the are-you-sure guard on a poor fit still fires.
 *
 * Every write here is scoped to the owner. An id alone is never enough.
 */

/* ── Preferences ─────────────────────────────────────────────── */

/** One user's search preferences, or null before they have any. */
export const getSearchPreferences = async (user_id) => {
    const [row] = await sql`
        SELECT * FROM job_search_preferences WHERE user_id = ${user_id} LIMIT 1
    `
    return row ?? null
}

/**
 * Creates or replaces a user's preferences.
 *
 * Run tracking is deliberately untouched: saving the form is not starting a
 * search, and clearing first_run_at here would re-arm the automatic run every
 * time someone edited a title.
 */
export const saveSearchPreferences = async (user_id, p) => {
    const [row] = await sql`
        INSERT INTO job_search_preferences (
            user_id, arrangement, locations, min_salary, titles, seniority, exclude_companies
        ) VALUES (
            ${user_id},
            ${p.arrangement},
            ${JSON.stringify(p.locations ?? [])}::jsonb,
            ${p.minSalary ?? null},
            ${JSON.stringify(p.titles ?? [])}::jsonb,
            ${p.seniority ?? null},
            ${JSON.stringify(p.excludeCompanies ?? [])}::jsonb
        )
        ON CONFLICT (user_id) DO UPDATE SET
            arrangement       = EXCLUDED.arrangement,
            locations         = EXCLUDED.locations,
            min_salary        = EXCLUDED.min_salary,
            titles            = EXCLUDED.titles,
            seniority         = EXCLUDED.seniority,
            exclude_companies = EXCLUDED.exclude_companies,
            updated_at        = now()
        RETURNING *
    `
    return row
}

/**
 * Claims the right to run a search, atomically.
 *
 * Returns the row when this caller got the claim and null when a search is
 * already running. The check and the write are one statement on purpose: two
 * tabs finishing onboarding at once, or a reload mid-run, would otherwise
 * both read "not running" and both spend the user's Perplexity credit.
 *
 * `first_run_at` is set on the first claim ever and never cleared, which is
 * what stops the automatic run firing a second time.
 *
 * A run older than the stale window is treated as abandoned — a background
 * function that died leaves last_run_started_at set forever otherwise, and
 * the user could never search again.
 */
export const claimSearchRun = async (user_id, { staleAfterMinutes = 15 } = {}) => {
    const [row] = await sql`
        UPDATE job_search_preferences SET
            last_run_started_at  = now(),
            last_run_finished_at = NULL,
            last_run_error       = NULL,
            first_run_at         = COALESCE(first_run_at, now())
        WHERE user_id = ${user_id}
          AND (
              last_run_started_at IS NULL
              OR last_run_finished_at IS NOT NULL
              OR last_run_started_at < now() - make_interval(mins => ${staleAfterMinutes})
          )
        RETURNING *
    `
    return row ?? null
}

/** Records how a run ended. `error` null means it succeeded. */
export const finishSearchRun = async (user_id, { found = 0, error = null } = {}) => {
    await sql`
        UPDATE job_search_preferences SET
            last_run_finished_at = now(),
            last_run_found       = ${found},
            last_run_error       = ${error}
        WHERE user_id = ${user_id}
    `
}

/* ── Leads ───────────────────────────────────────────────────── */

/**
 * Inserts leads, skipping any URL this user already has.
 *
 * ON CONFLICT DO NOTHING rather than a read-then-write: the unique index is
 * the dedup rule, so two overlapping runs can't both insert the same listing
 * however they interleave. Returns only the rows actually inserted, which is
 * what "found N new" should count.
 */
export const insertLeads = async (user_id, leads) => {
    if (!Array.isArray(leads) || leads.length === 0) return []

    const rows = []
    for (const l of leads) {
        const [row] = await sql`
            INSERT INTO job_leads (
                user_id, url, title, snippet, company, source, posted_at,
                arrangement, salary_floor, disqualified_for
            ) VALUES (
                ${user_id}, ${l.url}, ${l.title ?? null}, ${l.snippet ?? null},
                ${l.company ?? null}, ${l.source ?? null}, ${l.postedAt ?? null},
                ${l.arrangement ?? null}, ${l.salaryFloor ?? null}, ${l.disqualifiedFor ?? null}
            )
            ON CONFLICT (user_id, url) DO NOTHING
            RETURNING *
        `
        if (row) rows.push(row)
    }
    return rows
}

/** Canonical URLs already stored for this user, for dedup before insert. */
export const listLeadUrls = async (user_id) => {
    const rows = await sql`SELECT url FROM job_leads WHERE user_id = ${user_id}`
    return rows.map(r => r.url)
}

/** A user's leads, newest first. Dismissed ones are excluded by default. */
export const listLeads = async (user_id, { includeDismissed = false } = {}) => {
    if (includeDismissed) {
        return sql`
            SELECT * FROM job_leads
            WHERE user_id = ${user_id}
            ORDER BY created_at DESC
        `
    }
    return sql`
        SELECT * FROM job_leads
        WHERE user_id = ${user_id} AND dismissed_at IS NULL
        ORDER BY created_at DESC
    `
}

/**
 * Hides a lead without deleting it, so a later run doesn't resurface the
 * listing the user has already said no to.
 */
export const dismissLead = async (user_id, id) => {
    const [row] = await sql`
        UPDATE job_leads SET dismissed_at = now()
        WHERE id = ${id} AND user_id = ${user_id} AND dismissed_at IS NULL
        RETURNING *
    `
    return row ?? null
}

/** Records what a link check found. */
export const recordLinkCheck = async (user_id, id, status) => {
    const [row] = await sql`
        UPDATE job_leads SET
            link_checked_at = now(),
            link_status     = ${status}
        WHERE id = ${id} AND user_id = ${user_id}
        RETURNING *
    `
    return row ?? null
}

/** Ties a lead to the application it became. */
export const linkLeadToApplication = async (user_id, id, job_application_id) => {
    const [row] = await sql`
        UPDATE job_leads SET job_application_id = ${job_application_id}
        WHERE id = ${id} AND user_id = ${user_id}
        RETURNING *
    `
    return row ?? null
}
