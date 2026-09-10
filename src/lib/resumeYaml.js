/**
 * Serializes a built job application into RenderCV's `cv:` YAML schema,
 * ready to paste into a RenderCV input file.
 *
 * Mapping from JobApplicationOutput (src/schemas/jobApplication.js):
 *   contact.name      → cv.name
 *   contact.title     → cv.headline
 *   contact.location  → cv.location
 *   contact.email     → cv.email
 *   contact.phone     → cv.phone
 *   contact.links[]   → cv.website + cv.social_networks[]
 *   summary           → sections.summary[]
 *   experience[]      → sections.experience[]  (title → position)
 *   skills[]          → sections.skills[]      (category → label, items → details)
 *   education[]       → sections.education[]   (school → institution)
 *
 * This is a format transform, not a content one: nothing is invented and
 * nothing is dropped except empty values.
 */

// ── YAML scalar emitting ─────────────────────────────────────

const RESERVED = /^(y|n|yes|no|true|false|on|off|null|~)$/i
const NUMERIC  = /^[-+]?(\d[\d_]*)(\.\d*)?([eE][-+]?\d+)?$/
const INDICATOR = /^[-?:,[\]{}#&*!|>'"%@`]/

/** True when a plain scalar would be ambiguous or invalid and needs quoting. */
function needsQuotes(s) {
    return (
        s === '' ||
        s !== s.trim() ||
        INDICATOR.test(s) ||
        /:(\s|$)/.test(s) ||   // "foo: bar" would parse as a mapping
        /\s#/.test(s) ||       // starts a comment
        RESERVED.test(s) ||
        NUMERIC.test(s)
    )
}

/** One-line scalar. Newlines are collapsed — every field here is single-line. */
function scalar(value) {
    const s = String(value).replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
    if (!needsQuotes(s)) return s
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/** Always-quoted scalar, for values YAML would otherwise read as a number or date. */
function quoted(value) {
    const s = String(value).replace(/\s*\n\s*/g, ' ').trim()
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

const has = v => Array.isArray(v) ? v.length > 0 : Boolean(v && String(v).trim())
const clean = v => String(v ?? '').trim()

// ── Dates ────────────────────────────────────────────────────

const MONTHS = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

/**
 * Normalizes a date to what RenderCV accepts: "YYYY", "YYYY-MM",
 * "YYYY-MM-DD", or "present". Anything unrecognized passes through
 * unchanged rather than being guessed at.
 */
export function normalizeDate(value) {
    const s = clean(value)
    if (!s) return null
    if (/^(present|current|now|ongoing|today)$/i.test(s)) return 'present'
    if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(s)) return s

    // "May 2023", "Sept. 2023"
    const named = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{4})$/)
    if (named) {
        const m = MONTHS[named[1].slice(0, 3).toLowerCase()]
        if (m) return `${named[2]}-${String(m).padStart(2, '0')}`
    }

    // "05/2023" or "2023/05"
    const slashed = s.match(/^(\d{1,2})\/(\d{4})$/) || s.match(/^(\d{4})\/(\d{1,2})$/)
    if (slashed) {
        const [year, month] = slashed[2].length === 4
            ? [slashed[2], slashed[1]]
            : [slashed[1], slashed[2]]
        const m = Number(month)
        if (m >= 1 && m <= 12) return `${year}-${String(m).padStart(2, '0')}`
    }

    return s
}

// ── Links ────────────────────────────────────────────────────

/** host fragment → RenderCV network name, and how to pull the username. */
const NETWORKS = [
    { host: /(^|\.)github\.com$/,        network: 'GitHub',         depth: 1 },
    { host: /(^|\.)gitlab\.com$/,        network: 'GitLab',         depth: 1 },
    { host: /(^|\.)linkedin\.com$/,      network: 'LinkedIn',       depth: 1, strip: /^(in|company|pub)$/ },
    { host: /(^|\.)(twitter|x)\.com$/,   network: 'X',              depth: 1 },
    { host: /(^|\.)instagram\.com$/,     network: 'Instagram',      depth: 1 },
    { host: /(^|\.)youtube\.com$/,       network: 'YouTube',        depth: 1, strip: /^(c|user|channel)$/ },
    { host: /(^|\.)orcid\.org$/,         network: 'ORCID',          depth: 1 },
    { host: /(^|\.)researchgate\.net$/,  network: 'ResearchGate',   depth: 1, strip: /^profile$/ },
    { host: /(^|\.)stackoverflow\.com$/, network: 'StackOverflow',  depth: 2, strip: /^users$/ },
    { host: /(^|\.)t\.me$/,              network: 'Telegram',       depth: 1 },
]

function parseUrl(raw) {
    const s = clean(raw)
    if (!s) return null
    try {
        return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`)
    } catch {
        return null
    }
}

/**
 * Splits contact links into a personal website and recognized social profiles.
 * The first link that isn't a known network becomes the website.
 *
 * @returns {{ website: string|null, socials: {network: string, username: string}[] }}
 */
export function splitLinks(links = []) {
    let website = null
    const socials = []
    const seen = new Set()

    for (const raw of links) {
        const url = parseUrl(raw)
        if (!url) continue
        const host = url.hostname.replace(/^www\./, '')
        const match = NETWORKS.find(n => n.host.test(host))

        if (!match) {
            if (!website) website = url.href.replace(/\/$/, '')
            continue
        }

        let parts = url.pathname.split('/').filter(Boolean)
        if (match.strip) parts = parts.filter((p, i) => !(i === 0 && match.strip.test(p)))
        const username = parts.slice(0, match.depth).join('/')
        if (!username) continue

        const key = `${match.network}:${username}`
        if (seen.has(key)) continue
        seen.add(key)
        socials.push({ network: match.network, username })
    }

    return { website, socials }
}

// ── Education degree parsing ─────────────────────────────────

// Group 2 is the separator, captured so its shape can be judged below. The
// punctuation class must absorb the whole run, so that "A.S., Computer Science"
// yields "Computer Science" and not ", Computer Science".
const DEGREE = /^(B\.?S\.?c?|M\.?S\.?c?|B\.?A\.?|M\.?A\.?|B\.?Eng\.?|M\.?Eng\.?|Ph\.?D\.?|A\.?S\.?|A\.?A\.?S?\.?|MBA)([.,]+\s*|\s+in\s+|\s+)(.+)$/i

/** A degree line is short; a prose highlight is not. */
const DEGREE_MAX_LEN = 60

const NO_DEGREE = highlights => ({ degree: null, area: null, rest: highlights })

/**
 * RenderCV renders `degree` and `area` distinctly, so a highlight like
 * "A.S., Computer Science" is worth splitting into them.
 *
 * Deliberately conservative — a false positive silently mangles the entry.
 * It only fires on the first highlight, only for a recognized abbreviation,
 * only when the line is short, and when the separator is weak (a bare space)
 * it additionally requires the area to be capitalized like a field of study.
 * That last rule is what keeps "MA state certification for teaching..." intact.
 */
export function parseDegree(highlights = []) {
    const first = clean(highlights[0])
    if (!first || first.length > DEGREE_MAX_LEN) return NO_DEGREE(highlights)

    const m = first.match(DEGREE)
    if (!m) return NO_DEGREE(highlights)

    const area = clean(m[3]).replace(/[.,;]+$/, '')
    if (!area) return NO_DEGREE(highlights)

    const strongSeparator = /[.,]/.test(m[2]) || /\bin\b/i.test(m[2])
    if (!strongSeparator && !/^[A-Z]/.test(area)) return NO_DEGREE(highlights)

    return {
        degree: m[1].replace(/\./g, '').toUpperCase(),
        area,
        rest: highlights.slice(1),
    }
}

// ── Serializer ───────────────────────────────────────────────

const IND = '  '

function highlightLines(highlights, indent) {
    const items = (highlights ?? []).map(clean).filter(Boolean)
    if (!items.length) return []
    return [`${indent}highlights:`, ...items.map(h => `${indent}${IND}- ${scalar(h)}`)]
}

/**
 * @param {object} jobApplication  the `job_application` object from a JobApplicationResponse
 * @returns {string} RenderCV-compatible YAML, newline-terminated
 */
export function toRenderCvYaml(jobApplication) {
    const ja = jobApplication ?? {}
    const contact = ja.contact ?? {}
    const out = ['cv:']

    if (has(contact.name))  out.push(`${IND}name: ${scalar(contact.name)}`)
    if (has(contact.title)) out.push(`${IND}headline: ${quoted(contact.title)}`)

    // ── sections ──
    const sections = []

    if (has(ja.summary)) {
        sections.push(`${IND.repeat(2)}summary:`)
        sections.push(`${IND.repeat(3)}- ${scalar(ja.summary)}`)
    }

    const experience = (ja.experience ?? []).filter(e => has(e?.company) || has(e?.title))
    if (experience.length) {
        sections.push(`${IND.repeat(2)}experience:`)
        for (const e of experience) {
            const rows = []
            if (has(e.company)) rows.push(`company: ${scalar(e.company)}`)
            if (has(e.title))   rows.push(`position: ${scalar(e.title)}`)
            const start = normalizeDate(e.startDate)
            const end   = normalizeDate(e.endDate)
            if (start) rows.push(`start_date: ${quoted(start)}`)
            if (end)   rows.push(`end_date: ${quoted(end)}`)

            sections.push(`${IND.repeat(3)}- ${rows[0]}`)
            for (const r of rows.slice(1)) sections.push(`${IND.repeat(4)}${r}`)
            sections.push(...highlightLines(e.highlights, IND.repeat(4)))
        }
    }

    const skills = (ja.skills ?? [])
        .map(s => ({ label: clean(s?.category), details: (s?.items ?? []).map(clean).filter(Boolean) }))
        .filter(s => s.label && s.details.length)
    if (skills.length) {
        sections.push(`${IND.repeat(2)}skills:`)
        for (const s of skills) {
            sections.push(`${IND.repeat(3)}- label: ${scalar(s.label)}`)
            sections.push(`${IND.repeat(4)}details: ${scalar(s.details.join(', '))}`)
        }
    }

    const education = (ja.education ?? []).filter(e => has(e?.school))
    if (education.length) {
        sections.push(`${IND.repeat(2)}education:`)
        for (const e of education) {
            const { degree, area, rest } = parseDegree(e.highlights)
            const rows = [`institution: ${scalar(e.school)}`]
            if (area)   rows.push(`area: ${scalar(area)}`)
            if (degree) rows.push(`degree: ${scalar(degree)}`)
            const start = normalizeDate(e.startDate)
            const end   = normalizeDate(e.endDate)
            if (start) rows.push(`start_date: ${quoted(start)}`)
            if (end)   rows.push(`end_date: ${quoted(end)}`)

            sections.push(`${IND.repeat(3)}- ${rows[0]}`)
            for (const r of rows.slice(1)) sections.push(`${IND.repeat(4)}${r}`)
            sections.push(...highlightLines(rest, IND.repeat(4)))
        }
    }

    if (sections.length) {
        out.push(`${IND}sections:`)
        out.push(...sections)
    }

    // ── contact block (after sections, matching the RenderCV samples) ──
    if (has(contact.location)) out.push(`${IND}location: ${scalar(contact.location)}`)
    if (has(contact.email))    out.push(`${IND}email: ${scalar(contact.email)}`)
    if (has(contact.phone))    out.push(`${IND}phone: ${quoted(contact.phone)}`)

    const { website, socials } = splitLinks(contact.links)
    if (website) out.push(`${IND}website: ${scalar(website)}`)
    if (socials.length) {
        out.push(`${IND}social_networks:`)
        for (const s of socials) {
            out.push(`${IND.repeat(2)}- network: ${scalar(s.network)}`)
            out.push(`${IND.repeat(3)}username: ${scalar(s.username)}`)
        }
    }

    return out.join('\n') + '\n'
}
