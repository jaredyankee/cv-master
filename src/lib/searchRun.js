/**
 * Watching a background search finish.
 *
 * The background function answers 202 before it does anything, so for the
 * first moments after asking for a search the server still reports the
 * *previous* run — finished — and a watcher that only checked `running` would
 * conclude the new one was already over and stop. It has to know whether the
 * run it sees is the one it asked for.
 *
 * It can't tell by comparing clocks: `startedAt` is the database's time and
 * the browser's clock is whatever the user's machine says, which can be off by
 * minutes. So it compares against the run it saw *before* asking. A different
 * `startedAt` is a new run — ours — with no clock involved.
 */

/** How long to wait for a run to appear before concluding the server skipped it. */
export const START_GRACE_MS = 45_000

/**
 * @param {string|null} before   run.startedAt as it was before the request
 * @param {{ running?: boolean, startedAt?: string|null }} run  the latest poll
 * @param {number} elapsedMs     since the request, by the browser's own clock
 * @param {number} [graceMs]
 * @returns {'done'|'skipped'|'waiting'}
 *   done     — our run started and has finished
 *   skipped  — nothing started in time; the server declined (no key, no
 *              titles, already searched, one already running)
 *   waiting  — keep polling
 */
export function runOutcome(before, run, elapsedMs, graceMs = START_GRACE_MS) {
    const startedAt = run?.startedAt ?? null
    const ours = startedAt !== null && startedAt !== before

    if (ours) return run?.running ? 'waiting' : 'done'
    // Only elapsed time on the browser's clock is compared here — a duration,
    // not a timestamp, so skew between the machines doesn't matter.
    return elapsedMs >= graceMs ? 'skipped' : 'waiting'
}
