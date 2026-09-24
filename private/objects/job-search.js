import { getSearchKey, hasSearchKey, saveSearchKey } from "../db/users.js"
import { getResumeDumpByUser } from "../db/resume-dump.js"
import { shapeDump } from "./resume-dump.js"
import { search, buildQueries } from "../lib/search/perplexity.js"
import { toLeads, seedPreferences, normalizePreferences, postingKind, BOARD_REASON } from "../lib/leads.js"
import {
    getSearchPreferences,
    saveSearchPreferences,
    claimSearchRun,
    finishSearchRun,
    insertLeads,
    listLeadUrls,
    listLeads,
    dismissLead,
} from "../db/job-leads.js"

/** How many results to ask for per title. Each one is the user's money. */
const RESULTS_PER_QUERY = 10

/* ── shaping ─────────────────────────────────────────────────── */

export const shapeLead = (row) => ({
    id: row.id,
    url: row.url,
    title: row.title ?? "",
    snippet: row.snippet ?? "",
    company: row.company ?? "",
    source: row.source ?? "other",
    postedAt: row.posted_at ?? null,
    arrangement: row.arrangement ?? null,
    salaryFloor: row.salary_floor ?? null,
    // Rows stored before board pages were recognised carry no reason; the
    // check runs again on read so they sort themselves without a re-search.
    disqualifiedFor: row.disqualified_for
        ?? (postingKind(row.url) === 'board' ? BOARD_REASON : null),
    linkStatus: row.link_status ?? null,
    linkCheckedAt: row.link_checked_at ?? null,
    applicationId: row.job_application_id ?? null,
    createdAt: row.created_at,
})

export const shapePreferences = (row) => ({
    arrangement: row?.arrangement ?? "any",
    locations: row?.locations ?? [],
    minSalary: row?.min_salary ?? null,
    titles: row?.titles ?? [],
    seniority: row?.seniority ?? "",
    excludeCompanies: row?.exclude_companies ?? [],
})

/** Run state, so the dashboard can show progress without blocking on it. */
export const shapeRun = (row) => ({
    running: Boolean(row?.last_run_started_at) && !row?.last_run_finished_at,
    startedAt: row?.last_run_started_at ?? null,
    finishedAt: row?.last_run_finished_at ?? null,
    error: row?.last_run_error ?? null,
    found: row?.last_run_found ?? null,
    hasRun: Boolean(row?.first_run_at),
})

/* ── reads ───────────────────────────────────────────────────── */

/**
 * Everything the leads panel needs in one call: the leads, the preferences
 * behind them, and whether a search is running right now.
 */
export const getSearchState = async (userId) => {
    if (!userId) return { ok: false, error: "User id is missing" }
    const [prefsRow, leadRows, hasKey] = await Promise.all([
        getSearchPreferences(userId),
        listLeads(userId),
        hasSearchKey(userId),
    ])
    return {
        ok: true,
        leads: leadRows.map(shapeLead),
        preferences: shapePreferences(prefsRow),
        run: shapeRun(prefsRow),
        configured: Boolean(prefsRow),
        // Whether a key is on file — never the key. The panel needs to know
        // whether to ask for one, and nothing more.
        hasKey,
    }
}

/**
 * The preferences to start from: what the user has saved, or a first guess
 * read out of their dump. The guess is never stored without being shown —
 * this returns it for the form to display, and saving is a separate step.
 */
export const getOrSeedPreferences = async (userId) => {
    const existing = await getSearchPreferences(userId)
    if (existing) return { ok: true, preferences: shapePreferences(existing), seeded: false }

    const dumpRow = await getResumeDumpByUser(userId)
    const dump = dumpRow ? shapeDump(dumpRow) : null
    return {
        ok: true,
        preferences: seedPreferences(dump?.lookingFor ?? "", dump),
        seeded: true,
    }
}

/* ── writes ──────────────────────────────────────────────────── */

/**
 * Saves preferences, and a Perplexity key if one came with them.
 *
 * The key travels in the body rather than a header. The model key uses
 * X-Api-Key, which is on every allowlist; a new header would need adding to
 * the CORS allowlist in netlify.toml *and* in private/cors, and a preflight
 * that silently refuses it looks exactly like a broken save.
 */
export const savePreferences = async (userId, input, searchKey) => {
    if (!userId) return { ok: false, error: "User id is missing" }
    const key = typeof searchKey === "string" ? searchKey.trim() : ""
    if (key) await saveSearchKey(userId, key)
    const row = await saveSearchPreferences(userId, normalizePreferences(input))
    return {
        ok: true,
        preferences: shapePreferences(row),
        run: shapeRun(row),
        hasKey: key ? true : await hasSearchKey(userId),
    }
}

// Lead ids are uuids, and Postgres throws on anything that isn't one rather
// than matching nothing — so an id straight off the query string is checked
// first, and a malformed one is simply not found instead of a 500.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const dismiss = async (userId, id) => {
    if (!userId) return { ok: false, error: "User id is missing" }
    if (!id) return { ok: false, error: "Lead id is missing" }
    if (!UUID.test(id)) return { ok: false, error: "Lead not found" }
    const row = await dismissLead(userId, id)
    if (!row) return { ok: false, error: "Lead not found" }
    return { ok: true, lead: shapeLead(row) }
}

/* ── the search itself ───────────────────────────────────────── */

/**
 * Runs a search and stores whatever is new.
 *
 * `auto` marks the run that fires by itself once onboarding finishes. It is
 * skipped when this user has ever searched before, so finishing the review a
 * second time — or a rebuild — doesn't spend their credit again. A run the
 * user asked for is never skipped.
 *
 * The claim is taken before any work, and it is atomic: two tabs finishing at
 * once both call this, and only one of them searches.
 *
 * @returns {Promise<{ ok: true, found: number, skipped?: string } | { ok: false, error: string }>}
 */
export const runJobSearch = async (userId, { auto = false } = {}) => {
    if (!userId) return { ok: false, error: "User id is missing" }

    let prefsRow = await getSearchPreferences(userId)

    // The automatic run happens once, ever. Checking before the claim matters:
    // claiming sets first_run_at, so asking afterwards would always say yes.
    if (auto && prefsRow?.first_run_at) {
        return { ok: true, found: 0, skipped: "already searched once" }
    }

    // First time through, seed from the dump so the automatic run has titles
    // to search for. A user who never opens the form still gets a first pass.
    if (!prefsRow) {
        const dumpRow = await getResumeDumpByUser(userId)
        const dump = dumpRow ? shapeDump(dumpRow) : null
        prefsRow = await saveSearchPreferences(
            userId,
            normalizePreferences(seedPreferences(dump?.lookingFor ?? "", dump)),
        )
    }

    const prefs = shapePreferences(prefsRow)
    const queries = buildQueries(prefs)
    if (queries.length === 0) {
        // Nothing to search for is not a failure. Saying so beats a run that
        // finishes instantly having found nothing and looks broken.
        return { ok: true, found: 0, skipped: "no job titles to search for" }
    }

    // Checked after the cheap exits so a user without a key doesn't get a
    // claimed run they can't complete.
    const apiKey = await getSearchKey(userId)
    if (!apiKey) return { ok: true, found: 0, skipped: "no Perplexity key on file" }

    const claimed = await claimSearchRun(userId)
    if (!claimed) return { ok: true, found: 0, skipped: "a search is already running" }

    try {
        const seen = new Set(await listLeadUrls(userId))
        let inserted = 0
        const failures = []

        for (const query of queries) {
            const result = await search({ apiKey, query, maxResults: RESULTS_PER_QUERY })
            if (!result.ok) {
                failures.push(result.error)
                continue
            }
            // seen grows as we go, so two queries returning the same listing
            // store it once.
            const leads = toLeads(result.results, prefs, seen)
            for (const l of leads) seen.add(l.url)
            const rows = await insertLeads(userId, leads)
            inserted += rows.length
        }

        // Some queries working is a result, not an error. Only a total failure
        // is worth telling the user their search broke.
        const error = failures.length === queries.length ? failures[0] : null
        await finishSearchRun(userId, { found: inserted, error })
        return error ? { ok: false, error } : { ok: true, found: inserted }
    } catch (err) {
        // The claim must be released whatever happened, or the stale window is
        // the only way this user searches again.
        await finishSearchRun(userId, { found: 0, error: err?.message ?? String(err) })
        return { ok: false, error: err?.message ?? String(err) }
    }
}
