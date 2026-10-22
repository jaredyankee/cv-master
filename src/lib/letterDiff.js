/**
 * Which words of a built paragraph differ from the user's original.
 *
 * The letter build may change verb tense and nothing else. Highlighting every
 * word that isn't in the source makes that checkable at a glance, rather than
 * something the user has to take on trust.
 */

const norm = t => t.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')

/**
 * @param {string} source  the paragraph as the user wrote it
 * @param {string} built   the paragraph as it appears in the letter
 * @returns {{ text: string, changed: boolean }[]} segments of `built`, in order
 */
export function diffWords(source, built) {
    const a = String(source ?? '').split(/\s+/).filter(Boolean).map(norm)
    const parts = String(built ?? '').split(/(\s+)/)
    const words = parts.map((p, i) => ({ p, i })).filter(({ p }) => p.trim())
    const b = words.map(({ p }) => norm(p))

    // LCS table, then walk it to find which built words are shared.
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
            dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
        }
    }
    const kept = new Set()
    for (let i = 0, j = 0; i < a.length && j < b.length;) {
        if (a[i] === b[j]) { kept.add(words[j].i); i++; j++ }
        else if (dp[i + 1][j] >= dp[i][j + 1]) i++
        else j++
    }

    // Merge runs so the markup stays small.
    const segments = []
    parts.forEach((p, i) => {
        if (!p) return
        const changed = Boolean(p.trim()) && !kept.has(i)
        const last = segments[segments.length - 1]
        // Whitespace joins whichever run it sits in.
        if (last && (last.changed === changed || !p.trim())) last.text += p
        else segments.push({ text: p, changed })
    })
    return segments
}
