/**
 * Coercion helpers for user-submitted payloads.
 *
 * Anything arriving from the browser is shaped defensively before it reaches
 * SQL: strings stay strings, arrays stay arrays, and everything is length-
 * capped so a malformed or hostile body cannot bloat a row. Values are
 * trimmed and truncated rather than rejected — an edit that loses the tail of
 * an absurdly long field is friendlier than one that fails outright.
 */

export const LIMITS = {
    line:      400,     // single-line fields: names, titles, dates
    text:     4000,     // free text: descriptions, summaries
    listItem: 2000,     // one bullet or skill
    list:       100,    // items in an array
    entries:     60,    // entries in a section
}

/** Trimmed single-line string, capped. Non-strings become "". */
export const str = (v, max = LIMITS.line) =>
    typeof v === 'string' ? v.trim().slice(0, max) : ''

/** Trimmed multi-line string, capped. */
export const text = (v) => str(v, LIMITS.text)

/** Array of non-empty strings, capped in both length and count. */
export const strList = (v, max = LIMITS.list) =>
    Array.isArray(v)
        ? v.map(i => str(i, LIMITS.listItem)).filter(Boolean).slice(0, max)
        : []

/** Array of objects run through `shape`, dropping anything `keep` rejects. */
export const objList = (v, shape, keep = () => true, max = LIMITS.entries) =>
    Array.isArray(v)
        ? v.slice(0, max).map(item => shape(item ?? {})).filter(keep)
        : []
