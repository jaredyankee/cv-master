/**
 * The application lifecycle, as the database defines it.
 *
 * The labels and their order come from the `job_application_status` enum and
 * arrive with the applications list — nothing here assumes what they are.
 * That matters: the enum is the source of truth, and a second copy in the
 * front end would be a guess that breaks quietly the first time someone adds
 * a stage.
 */

/**
 * A stored label as a person should read it.
 *
 * Handles the shapes an enum label comes in — `applied`, `phone_screen`,
 * `phone-screen` — and leaves an already-presentable label alone.
 *
 * @param {string|null|undefined} value
 */
export function statusLabel(value) {
    if (!value) return ''
    const words = String(value).replace(/[_-]+/g, ' ').trim()
    if (!words) return ''
    return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * The stage after this one, or null at the end of the pipeline.
 *
 * A status the list doesn't contain — nothing set yet, or a label retired by a
 * migration — advances to the first stage rather than nowhere, so the control
 * is never a dead end.
 *
 * @param {string[]} statuses  in pipeline order
 * @param {string|null|undefined} current
 * @returns {string|null}
 */
export function nextStatus(statuses, current) {
    const list = Array.isArray(statuses) ? statuses : []
    if (list.length === 0) return null

    const i = list.indexOf(current)
    if (i === -1) return list[0]
    return i + 1 < list.length ? list[i + 1] : null
}

/**
 * How far along the pipeline a status sits, as `{ step, of }` counting from 1,
 * or null when it isn't on the pipeline at all.
 *
 * @param {string[]} statuses
 * @param {string|null|undefined} current
 */
export function statusProgress(statuses, current) {
    const list = Array.isArray(statuses) ? statuses : []
    const i = list.indexOf(current)
    if (i === -1) return null
    return { step: i + 1, of: list.length }
}
