import { useEffect, useState } from 'react'
import './Progress.css'

/** mm:ss */
function elapsedLabel(ms) {
    const total = Math.max(0, Math.floor(ms / 1000))
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${String(s).padStart(2, '0')}`
}

function Dots() {
    return (
        <span className="progress-dots" aria-hidden="true">
            <i />
            <i />
            <i />
        </span>
    )
}

/**
 * Live progress for a long-running AI call: an indeterminate bar, a cycling
 * status phrase, animated dots, and a running clock. The clock is what proves
 * the page isn't frozen, so it ticks every second regardless of the phrase.
 *
 * Props:
 *   phrases:   string[] — stepped through in order, then held on the last
 *   startedAt: number   — Date.now() when the work began; defaults to mount
 *   variant:   'block' (default, full panel) | 'inline' (one line, for cards)
 *   interval:  ms per phrase — the default spreads seven phrases across the
 *              ~45 s these calls typically take
 */
export default function Progress({
    phrases = ['Working'],
    startedAt,
    variant = 'block',
    interval = 7000,
}) {
    const [elapsed, setElapsed] = useState(0)

    // The clock lives entirely in the effect: render stays pure, and passing a
    // real startedAt later (or a card remounting) re-bases it correctly.
    useEffect(() => {
        const begin = Number.isFinite(startedAt) ? startedAt : Date.now()
        const tick = () => setElapsed(Date.now() - begin)
        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [startedAt])

    const step = Math.min(phrases.length - 1, Math.floor(elapsed / interval))
    const phrase = phrases[step] ?? phrases[0]
    const clock = <span className="progress-clock">{elapsedLabel(elapsed)}</span>

    if (variant === 'inline') {
        return (
            <span className="progress-inline">
                <span className="progress-inline-text">{phrase}<Dots /></span>
                {clock}
            </span>
        )
    }

    return (
        <div className="progress" role="status" aria-live="polite">
            <div className="progress-bar" aria-hidden="true"><span /></div>
            <div className="progress-row">
                <span className="progress-phrase" key={phrase}>
                    {phrase}<Dots />
                </span>
                {clock}
            </div>
        </div>
    )
}
