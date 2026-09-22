/**
 * Job listing search, via Perplexity's Search API.
 *
 * Deliberately the Search API and not the chat models. `/search` returns a
 * ranked `results[]` of real indexed pages; a chat model returns prose with
 * citations, and a chat model asked for job links will produce plausible URLs
 * that 404. Rule 1 of this codebase is that the model never invents the
 * user's content — the same reasoning says it doesn't get to invent a job
 * either. Discovery comes from an index; a model may later rank what the
 * index returned, never author it.
 *
 * Env:
 *   PERPLEXITY_SEARCH_URL  — override the endpoint (tests point this at a mock)
 */

const DEFAULT_URL = 'https://api.perplexity.ai/search'

/**
 * Boards worth searching, most reliable first.
 *
 * Greenhouse, Lever and Ashby serve static, crawlable job pages, so the index
 * has them and the links stay valid until the role closes. Workday and iCIMS
 * are JavaScript-rendered behind session-scoped URLs: patchily indexed, and
 * what is indexed goes stale. They are left out rather than filling results
 * with links that were dead before the search ran.
 *
 * The API caps this list at 20 domains.
 */
export const JOB_BOARDS = [
    'boards.greenhouse.io',
    'job-boards.greenhouse.io',
    'jobs.lever.co',
    'jobs.ashbyhq.com',
    'apply.workable.com',
    'jobs.smartrecruiters.com',
]

/**
 * The search queries a set of preferences implies — one per title, because a
 * single query mixing every title returns a blend of all of them and ranks
 * none of them well.
 *
 * Preferences the index can't act on are left out rather than stuffed in:
 * a salary floor is not a search term, and asking for it only biases results
 * towards postings that happen to quote numbers.
 *
 * @param {{ titles?: string[], arrangement?: string, locations?: string[], seniority?: string }} prefs
 * @returns {string[]}
 */
export function buildQueries(prefs = {}) {
    const titles = (prefs.titles ?? []).map(t => String(t).trim()).filter(Boolean)
    if (titles.length === 0) return []

    const seniority = String(prefs.seniority ?? '').trim()
    const arrangement = prefs.arrangement === 'remote' ? 'remote'
        : prefs.arrangement === 'hybrid' ? 'hybrid'
            : prefs.arrangement === 'onsite' ? 'on-site'
                : ''
    // One location per query would multiply the request count; the index
    // handles a short disjunction in the text well enough.
    const where = (prefs.locations ?? []).map(l => String(l).trim()).filter(Boolean).slice(0, 3).join(' OR ')

    return titles.map(title =>
        [seniority, title, arrangement, where, 'job opening']
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim()
    )
}

/**
 * Pulls the results out of a Search API response. Exported for testing.
 *
 * Anything without a URL is dropped here rather than downstream: a result
 * that can't be linked to is not a lead, whatever else it carries.
 */
export function parseSearchResponse(body) {
    const results = Array.isArray(body?.results) ? body.results : []
    return results
        .filter(r => typeof r?.url === 'string' && r.url.trim())
        .map(r => ({
            url: r.url.trim(),
            title: typeof r.title === 'string' ? r.title.trim() : '',
            snippet: typeof r.snippet === 'string' ? r.snippet.trim() : '',
            date: typeof r.date === 'string' && r.date.trim() ? r.date.trim()
                : typeof r.last_updated === 'string' && r.last_updated.trim() ? r.last_updated.trim()
                    : null,
        }))
}

/**
 * Runs one search.
 *
 * @param {object} req
 * @param {string} req.apiKey
 * @param {string} req.query
 * @param {number} [req.maxResults]
 * @param {string[]} [req.domains]  allowlist; the API caps it at 20
 * @returns {Promise<{ ok: true, results: object[] } | { ok: false, error: string, status: number|null }>}
 */
export async function search({ apiKey, query, maxResults = 10, domains = JOB_BOARDS }) {
    if (!apiKey) return { ok: false, error: 'No Perplexity API key on file', status: null }
    if (!query?.trim()) return { ok: false, error: 'Search query is empty', status: null }

    const url = process.env.PERPLEXITY_SEARCH_URL?.trim() || DEFAULT_URL

    let res
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: query.trim(),
                max_results: maxResults,
                search_domain_filter: domains.slice(0, 20),
            }),
        })
    } catch (err) {
        // A network failure is not a bad key; say which so the UI doesn't send
        // the user off to regenerate a credential that was fine.
        return { ok: false, error: `Could not reach Perplexity: ${err?.message ?? err}`, status: null }
    }

    if (!res.ok) {
        let detail = ''
        try {
            const body = await res.json()
            detail = body?.error?.message ?? body?.detail ?? ''
        } catch { /* a non-JSON error body tells us nothing extra */ }
        // Never log or echo the key; the status is what distinguishes the
        // cases the caller actually has to handle.
        console.error(`[perplexity] search failed (${res.status})`)
        return {
            ok: false,
            status: res.status,
            error: res.status === 401 ? 'Perplexity rejected the API key'
                : res.status === 429 ? 'Perplexity rate limited the search — try again shortly'
                    : `Perplexity returned ${res.status}${detail ? `: ${detail}` : ''}`,
        }
    }

    let body
    try {
        body = await res.json()
    } catch {
        return { ok: false, error: 'Perplexity returned a response that was not JSON', status: res.status }
    }

    const results = parseSearchResponse(body)
    // Count only — the snippets describe roles the user is considering.
    console.log(`[perplexity] search ok, ${results.length} results`)
    return { ok: true, results }
}
