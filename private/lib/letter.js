/**
 * Pure helpers for the cover-letter bank and the built letter. No I/O, so the
 * guards here can be tested without a model or a database.
 */

import { str, text, strList, objList } from "./normalize.js"

const ANGLE_LIMIT = 12

/** "Integrations: impact" → "integrations-impact". Never empty. */
export const slugify = (v) =>
    String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "paragraph"

/**
 * Coerces a client-submitted bank into what the column stores. Keys are
 * derived from the label when absent and made unique, because a key is how a
 * built letter points back at its source — two paragraphs sharing one would
 * make that pointer ambiguous.
 *
 * @param {any} blocks
 * @returns {{ key: string, label: string, text: string, angles: string[] }[]}
 */
export function normalizeBlocks(blocks) {
    const seen = new Set()
    return objList(blocks, b => {
        const label = str(b.label)
        let key = slugify(str(b.key) || label)
        for (let n = 2; seen.has(key); n++) key = `${slugify(str(b.key) || label)}-${n}`
        seen.add(key)
        return {
            key,
            label,
            text:   text(b.text),
            angles: [...new Set(strList(b.angles, ANGLE_LIMIT))],
        }
    }, b => b.text || b.label)
}

const COMPANY = /\[(company|employer|organi[sz]ation)\]/gi
const ROLE    = /\[(role|title|position|job title)\]/gi

/**
 * Fills [company] and [role] from what the posting analysis extracted. In code
 * rather than by the model: it is a lookup, not a judgment, and a model told
 * it may substitute here is a model with a reason to touch the text. A
 * placeholder with nothing to fill it stays as written, which is visible.
 */
export function fillPlaceholders(s, { company, role } = {}) {
    let out = String(s ?? "")
    if (company) out = out.replace(COMPANY, company)
    if (role)    out = out.replace(ROLE, role)
    return out
}

const words = s => String(s ?? "").toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []

/** Length of the longest common subsequence of two word lists. */
function lcs(a, b) {
    let prev = new Array(b.length + 1).fill(0)
    for (let i = 1; i <= a.length; i++) {
        const cur = new Array(b.length + 1).fill(0)
        for (let j = 1; j <= b.length; j++) {
            cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1])
        }
        prev = cur
    }
    return prev[b.length]
}

/**
 * Words added plus words removed, going from `source` to `built`. A tense
 * change costs about two per verb ("built" out, "build" in).
 */
export function wordDrift(source, built) {
    const a = words(source)
    const b = words(built)
    const common = lcs(a, b)
    return { changed: (a.length - common) + (b.length - common), total: a.length }
}

/**
 * Whether a model's version of a paragraph stayed within "tense only". Past
 * the budget it has rewritten something, and the user's text is used instead.
 * The prompt asks for restraint; this is what makes it a rule.
 */
export function withinTenseBudget(source, built) {
    const { changed, total } = wordDrift(source, built)
    return changed <= Math.max(4, Math.ceil(total * 0.15))
}
