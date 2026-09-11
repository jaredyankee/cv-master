/**
 * Polling schedule for the two background jobs.
 *
 * The UI can't be pushed to, so it asks repeatedly until a row appears. Every
 * ask is a Netlify invocation and a Neon query, and a flat three-second
 * interval spends the same amount whether the answer arrives in ten seconds or
 * four minutes — which is the wrong shape, because most jobs finish early and
 * the long tail is where the invocations pile up.
 *
 * So: stay responsive for the first few polls, then back off. A job that
 * finishes quickly still feels instant; one that runs to the deadline costs a
 * fraction of what it used to.
 */

/** Milliseconds to wait before poll number `attempt` (0-based). */
export function pollDelay(attempt) {
    if (attempt < 4) return 3000      // first ~12s: the common case
    if (attempt < 10) return 6000     // next ~36s
    return 12000                      // the long tail
}

/**
 * The delays that fit inside a time budget, which is also the number of
 * requests the budget costs. Exported so the cost of a change is testable
 * rather than guessed at.
 *
 * @param {number} budgetMs
 * @returns {number[]}
 */
export function pollSchedule(budgetMs) {
    const delays = []
    let elapsed = 0
    for (let attempt = 0; ; attempt++) {
        const delay = pollDelay(attempt)
        if (elapsed + delay > budgetMs) return delays
        elapsed += delay
        delays.push(delay)
    }
}

/**
 * Calls `check` on the backing-off schedule until it returns something other
 * than undefined, or the budget runs out.
 *
 * `check` returning undefined means "not ready"; any other value (including
 * null) is the result and stops the loop.
 *
 * @template T
 * @param {number} budgetMs
 * @param {() => Promise<T|undefined>} check
 * @returns {Promise<T|undefined>} undefined if the budget ran out
 */
export async function pollUntil(budgetMs, check) {
    for (const delay of pollSchedule(budgetMs)) {
        await new Promise(resolve => setTimeout(resolve, delay))
        const result = await check()
        if (result !== undefined) return result
    }
    return undefined
}
