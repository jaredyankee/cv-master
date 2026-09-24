/**
 * Turning raw search results into job leads.
 *
 * Everything here is deterministic. A search returns a title, a URL and a
 * snippet; this module decides what that URL *is*, what can be read off it
 * for free, and which results conflict with what the user told us they want —
 * all without a model call.
 *
 * The rule that shapes the whole file: **unknown never disqualifies.** A
 * snippet that doesn't mention the arrangement is not an on-site job, and a
 * posting that doesn't publish a range is not underpaid. Dropping those would
 * quietly eat the best listings, since the terse postings are often the good
 * ones. Only a fact the text actually states can rule a lead out.
 *
 * Nothing in here is generated. The company is read off the board URL, the
 * arrangement and salary are read out of the text the search returned. A model
 * gets to rank what survives; it never gets to author a lead.
 */

/* ── URLs ────────────────────────────────────────────────────── */

/**
 * Query parameters that identify where a click came from rather than which
 * job it points at. Stripped so the same posting reached two ways dedupes to
 * one lead. Board-specific job ids (gh_jid, ashby_jid) are deliberately NOT
 * here: on a company's own careers page they are the only thing naming the
 * role.
 */
const TRACKING_PARAMS = new Set([
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'gh_src', 'lever-source', 'lever-origin', 'ref', 'referrer', 'source',
    'src', 'trk', 'trackingid', 'fbclid', 'gclid',
])

/**
 * A URL reduced to the thing that makes it unique, for dedup.
 *
 * Returns null for anything that isn't a usable http(s) URL, which is how a
 * malformed search result gets dropped rather than stored.
 *
 * @param {string} raw
 * @returns {string|null}
 */
export function canonicalUrl(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return null

    let u
    try {
        u = new URL(raw.trim())
    } catch {
        return null
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null

    u.protocol = 'https:'
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '')
    u.hash = ''
    u.port = ''

    for (const key of [...u.searchParams.keys()]) {
        if (TRACKING_PARAMS.has(key.toLowerCase())) u.searchParams.delete(key)
    }
    // Stable order, so ?a=1&b=2 and ?b=2&a=1 are one lead.
    u.searchParams.sort()

    // A trailing slash is never meaningful on a job posting.
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
        u.pathname = u.pathname.slice(0, -1)
    }

    return u.toString()
}

/**
 * Which applicant tracking system a URL belongs to, if it's one we recognise.
 *
 * Worth knowing for two reasons: the board tells you how much to trust the
 * link (a Greenhouse posting is live or gone, never stale), and on these
 * hosts the company name is part of the path.
 */
const ATS_HOSTS = [
    { source: 'greenhouse',     match: /(^|\.)greenhouse\.io$/,      slug: 1 },
    { source: 'lever',          match: /(^|\.)lever\.co$/,           slug: 1 },
    { source: 'ashby',          match: /(^|\.)ashbyhq\.com$/,        slug: 1 },
    { source: 'smartrecruiters',match: /(^|\.)smartrecruiters\.com$/,slug: 1 },
    { source: 'workable',       match: /(^|\.)workable\.com$/,       slug: 1 },
    { source: 'workday',        match: /(^|\.)myworkdayjobs\.com$/,  slug: null },
    { source: 'icims',          match: /(^|\.)icims\.com$/,          slug: null },
    { source: 'taleo',          match: /(^|\.)taleo\.net$/,          slug: null },
]

/** @returns {{ source: string, slug: number|null }|null} */
function atsFor(hostname) {
    return ATS_HOSTS.find(a => a.match.test(hostname)) ?? null
}

/** The board a lead came from, or 'other' for a company's own careers page. */
export function leadSource(url) {
    const canonical = canonicalUrl(url)
    if (!canonical) return null
    return atsFor(new URL(canonical).hostname)?.source ?? 'other'
}

/**
 * The company, read off the board URL.
 *
 * `boards.greenhouse.io/acmecorp/jobs/123` is Acme Corp's board by
 * construction — that is a fact about the URL, not an inference about the
 * page, which is why it is safe to take without asking a model. Hosts that
 * don't put the company in the path (Workday tenants, iCIMS) return null and
 * the company stays unknown until someone reads the posting.
 *
 * @returns {string|null}
 */
export function companyFromUrl(url) {
    const canonical = canonicalUrl(url)
    if (!canonical) return null

    const u = new URL(canonical)
    const ats = atsFor(u.hostname)
    if (!ats || ats.slug === null) return null

    const segments = u.pathname.split('/').filter(Boolean)
    // Some boards prefix the slug with a section ("/embed/job_board").
    const slug = segments[ats.slug - 1]
    if (!slug || /^(jobs?|careers?|embed|search|company)$/i.test(slug)) return null

    return slug
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase()) || null
}

/**
 * What a posting URL looks like on each board — the part after the host.
 *
 * Search returns a mix of single postings and a company's whole job board,
 * and they look alike in results: a board page's title is "Jobs at Acme" and
 * its snippet is a fragment of the table of every opening. A board is not a
 * listing. These hosts have a fixed URL grammar, so which one a result is can
 * be read off the path.
 */
const POSTING_PATHS = {
    // /acme/jobs/6012345, or an embedded application form carrying a token.
    greenhouse: u => /^\/[^/]+\/jobs\/\d+/.test(u.pathname)
        || (/^\/embed\/job_app/.test(u.pathname) && u.searchParams.has('token')),
    // /acme/<uuid>, optionally /apply after it.
    lever: u => /^\/[^/]+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(u.pathname),
    ashby: u => /^\/[^/]+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(u.pathname),
    // /acme/j/ABC123DEF
    workable: u => /\/j\/[A-Za-z0-9]+/.test(u.pathname),
    // /Acme/743999812345678-backend-engineer
    smartrecruiters: u => /^\/[^/]+\/\d{6,}/.test(u.pathname),
}

/**
 * Whether a URL is one job, a company's board of jobs, or can't be told.
 *
 * 'unknown' covers a company's own careers site and the boards whose URLs
 * carry no structure worth trusting. It is treated as a posting: the rule
 * everywhere in this file is that only a stated fact rules a lead out, and a
 * URL we can't parse states nothing.
 *
 * @returns {'posting'|'board'|'unknown'}
 */
export function postingKind(url) {
    const canonical = canonicalUrl(url)
    if (!canonical) return 'unknown'
    const u = new URL(canonical)
    const ats = atsFor(u.hostname)
    const test = ats && POSTING_PATHS[ats.source]
    if (!test) return 'unknown'
    return test(u) ? 'posting' : 'board'
}

export const BOARD_REASON = "A company's job board, not a single posting"

/* ── What the text states ────────────────────────────────────── */

const ONSITE_NEGATIONS = [
    /\bremote\s*[:-]\s*no\b/i,
    /\bno\s+remote\b/i,
    /\bnot\s+(?:a\s+)?remote\b/i,
    /\bon-?site\s+(?:only|required)\b/i,
    /\bin-?office\s+(?:only|required)\b/i,
    /\bno\s+remote\s+work\b/i,
]

/**
 * Where the job is worked, as the text states it — or null when it doesn't.
 *
 * Null is the common case and the important one: it means "the snippet didn't
 * say", which must never be treated as a conflict.
 *
 * @returns {'remote'|'hybrid'|'onsite'|null}
 */
export function arrangementOf(text) {
    const s = typeof text === 'string' ? text : ''
    if (!s.trim()) return null

    // An explicit denial outranks the word "remote" appearing anywhere —
    // "Remote: No" contains it and means the opposite.
    if (ONSITE_NEGATIONS.some(re => re.test(s))) return 'onsite'

    if (/\bhybrid\b/i.test(s)) return 'hybrid'
    if (/\bremote\b/i.test(s)) return 'remote'
    if (/\bon-?site\b|\bin-?office\b|\bin\s+office\b/i.test(s)) return 'onsite'

    return null
}

// A plausible annual salary. Below this is an hourly rate or a typo; above it
// is funding, revenue or equity — neither is what someone is paid.
const SALARY_MIN = 10_000
const SALARY_MAX = 1_000_000

// Only trust a lone figure when the text says what it is.
const SALARY_CONTEXT = /\b(salary|salaries|base pay|base salary|compensation|pay range|paid|per year|per annum|annually|\/\s*yr|\/\s*year|a year)\b/i

const AMOUNT = String.raw`\$\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?\s?[kK]|\d{5,7})`
const RANGE_RE = new RegExp(`${AMOUNT}\\s*(?:-|–|—|to)\\s*${AMOUNT}`)
const SINGLE_RE = new RegExp(AMOUNT, 'g')

function toNumber(raw) {
    const s = raw.replace(/[$\s,]/g, '')
    if (/[kK]$/.test(s)) return Math.round(parseFloat(s) * 1000)
    const n = Number(s)
    return Number.isFinite(n) ? n : null
}

const plausible = n => n !== null && n >= SALARY_MIN && n <= SALARY_MAX

/**
 * The bottom of the advertised range, or null when the text doesn't advertise
 * one.
 *
 * Deliberately conservative. A range is taken at face value; a lone figure is
 * only believed when salary words sit nearby, because postings are full of
 * numbers that are not the salary — funding raised, revenue, the 401(k). A
 * wrong read here would reject a job the user wanted, so "no idea" is the
 * better answer whenever it isn't clear.
 *
 * @returns {number|null}
 */
export function salaryFloorOf(text) {
    const s = typeof text === 'string' ? text : ''
    if (!s.trim()) return null

    const range = RANGE_RE.exec(s)
    if (range) {
        const low = toNumber(range[1])
        const high = toNumber(range[2])
        // Both ends have to look like pay, or this is some other pair of
        // numbers that happens to be written as a range.
        if (plausible(low) && plausible(high)) return Math.min(low, high)
        return null
    }

    if (!SALARY_CONTEXT.test(s)) return null

    const found = [...s.matchAll(SINGLE_RE)].map(m => toNumber(m[1])).filter(plausible)
    // More than one candidate and no range to disambiguate: a bonus, a stipend
    // and a base all look alike here.
    return found.length === 1 ? found[0] : null
}

/* ── Seeding preferences ─────────────────────────────────────── */

export const ARRANGEMENTS = ['remote', 'hybrid', 'onsite', 'any']

/**
 * A first guess at structured preferences, read out of the dump's
 * `lookingFor` prose.
 *
 * The same two parsers used on listings, pointed at the user's own sentence:
 * "remote, around $130k" states an arrangement and a floor as plainly as a
 * posting does. Nothing is invented — a sentence that doesn't name a floor
 * produces no floor, and the form shows the user what was read so they can
 * correct it before anything is searched.
 *
 * Titles don't come from `lookingFor` — it mixes them with everything else,
 * and picking out which words are the job title is the kind of guess that
 * belongs to the user. They come from the jobs the user has actually held
 * instead, which is their own text and needs no interpretation.
 *
 * @param {string} lookingFor
 * @param {object} [dump]  the resume dump, for seeding titles
 */
export function seedPreferences(lookingFor, dump) {
    const text = typeof lookingFor === 'string' ? lookingFor : ''
    return {
        arrangement: arrangementOf(text) ?? 'any',
        locations: [],
        minSalary: salaryFloorOf(text),
        titles: seedTitlesFromDump(dump),
        seniority: '',
        excludeCompanies: [],
    }
}

/**
 * The titles a user has actually held, newest first, deduplicated.
 *
 * Without this the automatic first search would have nothing to search for:
 * a query needs a title, and the one place a title exists verbatim is the
 * user's own history. It is copied, never paraphrased.
 *
 * Entries marked excludeFromResume are skipped. The user has said that work
 * is not for sharing, and searching for more of it would be acting on exactly
 * what they asked to keep private.
 */
export function seedTitlesFromDump(dump, max = 3) {
    const entries = [
        ...(Array.isArray(dump?.experience) ? dump.experience : []),
        ...(Array.isArray(dump?.freelance) ? dump.freelance : []),
    ]

    const seen = new Set()
    const titles = []
    for (const e of entries) {
        if (e?.excludeFromResume) continue
        const title = typeof e?.title === 'string' ? e.title.trim() : ''
        if (!title) continue
        const key = title.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        titles.push(title)
        if (titles.length >= max) break
    }
    return titles
}

/** Coerces a preferences payload into the stored shape. */
export function normalizePreferences(input) {
    const p = input ?? {}
    const list = v => (Array.isArray(v) ? v.map(s => (typeof s === 'string' ? s.trim() : '')).filter(Boolean).slice(0, 40) : [])
    const salary = Number(p.minSalary)

    return {
        arrangement: ARRANGEMENTS.includes(p.arrangement) ? p.arrangement : 'any',
        locations: list(p.locations),
        // 0 and negatives mean "unstated" rather than "free" — a floor of zero
        // would filter nothing anyway, and storing it as a number invites a
        // comparison that reads as deliberate.
        minSalary: Number.isFinite(salary) && salary > 0 ? Math.round(salary) : null,
        titles: list(p.titles),
        seniority: typeof p.seniority === 'string' ? p.seniority.trim().slice(0, 200) : '',
        excludeCompanies: list(p.excludeCompanies),
    }
}

/* ── Filtering ───────────────────────────────────────────────── */

/**
 * Why this lead conflicts with the user's stated preferences, or null when it
 * doesn't. Only facts the text states can rule a lead out.
 *
 * This is the Mismatch test from the fit prompt, applied to the little that a
 * search result gives us — the half that is arithmetic rather than judgement,
 * done before a single token is spent.
 *
 * @param {{ title?: string, snippet?: string, url?: string }} lead
 * @param {{ arrangement?: string, minSalary?: number|null, excludeCompanies?: string[] }} prefs
 * @returns {string|null}
 */
export function disqualify(lead, prefs = {}) {
    // First, because it isn't a preference: a board is not a listing at all.
    // Set aside rather than dropped — "Samsara is hiring" can still be worth
    // a look, and a filter you can't see is one you can't catch being wrong.
    if (postingKind(lead?.url ?? '') === 'board') return BOARD_REASON

    const text = `${lead?.title ?? ''} ${lead?.snippet ?? ''}`
    const wanted = prefs.arrangement

    const arrangement = arrangementOf(text)
    if (arrangement && wanted === 'remote' && arrangement === 'onsite') {
        return 'On-site, and you asked for remote'
    }
    if (arrangement && wanted === 'onsite' && arrangement === 'remote') {
        return 'Remote, and you asked for on-site'
    }

    const floor = salaryFloorOf(text)
    if (typeof prefs.minSalary === 'number' && floor !== null && floor < prefs.minSalary) {
        return `Advertised from ${floor.toLocaleString()}, below your floor`
    }

    const company = lead?.company ?? companyFromUrl(lead?.url ?? '')
    if (company && Array.isArray(prefs.excludeCompanies)) {
        const hit = prefs.excludeCompanies.find(
            c => typeof c === 'string' && c.trim() && c.trim().toLowerCase() === company.toLowerCase()
        )
        if (hit) return `You asked to skip ${hit.trim()}`
    }

    return null
}

/**
 * Search results as storable leads: canonicalised, annotated with what could
 * be read for free, and deduped against each other and against what the user
 * has already been shown.
 *
 * Disqualified leads are returned too, carrying the reason. Hiding them would
 * make the filter impossible to trust — and impossible to notice when it is
 * wrong.
 *
 * @param {Array<{url: string, title?: string, snippet?: string, date?: string}>} results
 * @param {object} prefs
 * @param {Iterable<string>} seenUrls  canonical URLs already stored for this user
 */
export function toLeads(results, prefs = {}, seenUrls = []) {
    const seen = new Set(seenUrls)
    const leads = []

    for (const r of Array.isArray(results) ? results : []) {
        const url = canonicalUrl(r?.url)
        if (!url || seen.has(url)) continue
        seen.add(url)

        const title = typeof r?.title === 'string' ? r.title.trim() : ''
        const snippet = typeof r?.snippet === 'string' ? r.snippet.trim() : ''
        const lead = {
            url,
            title,
            snippet,
            postedAt: typeof r?.date === 'string' && r.date.trim() ? r.date.trim() : null,
            source: leadSource(url),
            company: companyFromUrl(url),
            arrangement: arrangementOf(`${title} ${snippet}`),
            salaryFloor: salaryFloorOf(`${title} ${snippet}`),
        }
        lead.disqualifiedFor = disqualify(lead, prefs)
        leads.push(lead)
    }

    return leads
}
