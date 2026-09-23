/**
 * Search preferences as the form edits them.
 *
 * The server stores lists as arrays; people type them as lines or with commas.
 * These convert between the two without the form having to care.
 */

export const ARRANGEMENT_OPTIONS = [
    { value: 'remote', label: 'Remote' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'onsite', label: 'On-site' },
    { value: 'any',    label: 'Any' },
]

/** One entry per line, for a textarea. */
export function listToText(list) {
    return Array.isArray(list) ? list.filter(Boolean).join('\n') : ''
}

/**
 * Back to a list. Lines and commas both separate, since people paste either;
 * blanks and repeats are dropped, case-insensitively, keeping the first
 * spelling the user typed.
 */
export function textToList(text) {
    if (typeof text !== 'string') return []
    const seen = new Set()
    const out = []
    for (const raw of text.split(/[\n,]+/)) {
        const item = raw.trim()
        if (!item) continue
        const key = item.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(item)
    }
    return out
}

/**
 * A salary field's text as a number, or null for "not stated".
 *
 * Accepts what people actually type — "130000", "130,000", "$130k", "130K" —
 * and treats anything else as unstated rather than as zero. A floor of zero
 * would read as a deliberate choice when it was really a typo.
 */
export function parseSalaryInput(text) {
    if (typeof text !== 'string' && typeof text !== 'number') return null
    const s = String(text).trim().replace(/[$,\s]/g, '')
    if (!s) return null
    const m = /^(\d+(?:\.\d+)?)([kK])?$/.exec(s)
    if (!m) return null
    const n = Math.round(parseFloat(m[1]) * (m[2] ? 1000 : 1))
    return n > 0 ? n : null
}

/** For display in the field: 130000 → "130,000". */
export function formatSalary(n) {
    return typeof n === 'number' && n > 0 ? n.toLocaleString('en-US') : ''
}

/** A one-line summary of what a search will look for, shown above the list. */
export function describePreferences(p) {
    if (!p) return ''
    const parts = []
    const titles = (p.titles ?? []).filter(Boolean)
    if (titles.length) parts.push(titles.join(', '))
    const arr = ARRANGEMENT_OPTIONS.find(o => o.value === p.arrangement)
    if (arr && arr.value !== 'any') parts.push(arr.label.toLowerCase())
    const where = (p.locations ?? []).filter(Boolean)
    if (where.length) parts.push(where.join(' or '))
    if (typeof p.minSalary === 'number' && p.minSalary > 0) parts.push(`from ${formatSalary(p.minSalary)}`)
    return parts.join(' · ')
}
