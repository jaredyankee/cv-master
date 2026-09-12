/**
 * Where an answer to a review question goes, and what the section looks like
 * once it's there.
 *
 * No model is involved. The question already carries a target — the model said
 * where the answer belongs at the moment it asked — so placing the answer is
 * resolving that target and concatenating two pieces of the user's own text.
 * Every word that ends up in the dump is a word the user typed, which is the
 * strongest form of "never invent content" available: there is nothing here
 * that *could* embellish.
 *
 * The composed text is a starting point shown to the user, not a commitment.
 * They edit it before accepting.
 */

/** Sections that hold a list of entries, and the field an answer extends. */
const LIST_SECTIONS = {
    experience: { field: 'description', nameKeys: ['company', 'title'] },
    freelance:  { field: 'description', nameKeys: ['company', 'title'] },
    projects:   { field: 'description', nameKeys: ['name'] },
    education:  { field: 'notes',       nameKeys: ['school'] },
}

/** Sections that are a single string; the answer extends the string itself. */
const SCALAR_SECTIONS = {
    positioning:  'Positioning',
    portfolio:    'Portfolio',
    workingStyle: 'Working style',
    lookingFor:   'Looking for',
}

const SECTION_LABELS = {
    experience: 'Experience',
    freelance:  'Freelance & independent',
    projects:   'Projects',
    education:  'Education',
    ...SCALAR_SECTIONS,
}

const norm = s => String(s ?? '').trim().toLowerCase()

/** The display name of a list entry — what the model's `entry` is matched against. */
function entryName(entry, nameKeys) {
    for (const key of nameKeys) {
        const value = entry?.[key]
        if (value && String(value).trim()) return String(value).trim()
    }
    return ''
}

/**
 * Turns a question's target into something the UI can act on.
 *
 * Returns null when the target is absent, names a section this doesn't handle,
 * or points at an entry that isn't in the dump — a stale or mistaken target
 * must not silently land the answer in the wrong role, so it degrades to "no
 * target" and the answer is kept as context instead.
 *
 * @param {object} dump    the ResumeDump the answer would be placed in
 * @param {{ section?: string, entry?: string }} target
 * @returns {{ section: string, index: number|null, field: string|null,
 *             label: string, current: string } | null}
 */
export function resolveTarget(dump, target) {
    const section = target?.section
    if (!section || !dump) return null

    if (section in SCALAR_SECTIONS) {
        return {
            section,
            index: null,
            field: null,
            label: SECTION_LABELS[section],
            current: String(dump[section] ?? ''),
        }
    }

    const spec = LIST_SECTIONS[section]
    if (!spec) return null

    const entries = Array.isArray(dump[section]) ? dump[section] : []
    const wanted = norm(target.entry)
    if (!wanted) return null

    const index = entries.findIndex(e => norm(entryName(e, spec.nameKeys)) === wanted)
    if (index === -1) return null

    return {
        section,
        index,
        field: spec.field,
        label: `${SECTION_LABELS[section]} · ${entryName(entries[index], spec.nameKeys)}`,
        current: String(entries[index]?.[spec.field] ?? ''),
    }
}

/**
 * The existing text with the answer added.
 *
 * A one-line description stays one line; anything already spanning lines gets
 * a blank line so the addition reads as its own paragraph rather than running
 * into the last one.
 */
export function composeAnswer(current, answer) {
    const before = String(current ?? '').trim()
    const addition = String(answer ?? '').trim()
    if (!addition) return before
    if (!before) return addition
    return before + (before.includes('\n') ? '\n\n' : ' ') + addition
}

/**
 * A copy of the dump with `text` written into the resolved location.
 * The dump is never mutated — the review edits a draft.
 */
export function applyPlacement(dump, resolved, text) {
    if (!dump || !resolved) return dump
    const next = structuredClone(dump)

    if (resolved.index === null) {
        next[resolved.section] = text
        return next
    }

    const entries = Array.isArray(next[resolved.section]) ? [...next[resolved.section]] : []
    if (!entries[resolved.index]) return dump
    entries[resolved.index] = { ...entries[resolved.index], [resolved.field]: text }
    next[resolved.section] = entries
    return next
}

export { SECTION_LABELS }
