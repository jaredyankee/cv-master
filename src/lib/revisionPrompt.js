/**
 * The "copy for peer review" payload behind each revision card.
 *
 * A revision is three things: what the user originally wrote, why the model
 * flagged it, and the replacement the user typed. Pasted into another
 * assistant those three are only useful together — the rewrite alone can't be
 * judged, and the note alone doesn't say what it is a note about. So the copy
 * carries all three under headings, wrapped in an instruction that asks for
 * critique rather than another rewrite.
 *
 * The model's own `suggested_edit` is deliberately left out. It is the
 * reviewer's job to judge the user's wording; handing it a ready-made
 * alternative invites it to echo that instead.
 */

/** How much of the original's length the rewrite must reach to count as written. */
export const MIN_LENGTH_RATIO = 0.6

/**
 * Characters the rewrite needs before it is treated as a real attempt.
 * Measured against the original, so a one-line flag needs a one-line answer
 * and a paragraph needs a paragraph.
 */
export function requiredLength(original) {
    return Math.ceil((original ?? '').trim().length * MIN_LENGTH_RATIO)
}

/**
 * True once the rewrite is long enough to be worth reviewing. Empty is never
 * enough, even when the original is itself empty.
 */
export function isLongEnough(rewrite, original) {
    const written = (rewrite ?? '').trim().length
    return written > 0 && written >= requiredLength(original)
}

const INSTRUCTIONS = [
    'Peer-review a revision to my professional profile.',
    '',
    'I wrote the original below. An automated review flagged it and gave the',
    'reason. I rewrote it myself, in my own words.',
    '',
    'Review my rewrite: does it actually address the note, is it clearer and',
    'more specific than the original, and did I drop anything worth keeping?',
    'Tell me what to change and why — do not rewrite it for me, and do not add',
    'claims I have not made.',
].join('\n')

/**
 * Builds the clipboard text for one revision.
 *
 * @param {{ original?: string, note?: string }} revision
 * @param {string} rewrite — what the user typed
 */
export function buildRevisionPrompt(revision, rewrite) {
    const { original = '', note = '' } = revision ?? {}

    return [
        INSTRUCTIONS,
        '',
        '--- ORIGINAL (my words) ---',
        original.trim(),
        '',
        '--- WHY IT WAS FLAGGED ---',
        note.trim() || '(no reason given)',
        '',
        '--- MY REWRITE (review this) ---',
        (rewrite ?? '').trim(),
        '',
    ].join('\n')
}
