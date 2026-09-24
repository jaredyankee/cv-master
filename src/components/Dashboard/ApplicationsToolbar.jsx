import { FIT_LEVELS, FIT_LEVEL_META } from '../../schemas/jobApplication'
import { SORTS, NO_FIT } from '../../lib/applicationView'
import { statusLabel } from '../../lib/status'

// Best first, the way you'd scan for what to act on.
const FIT_CHOICES = [...FIT_LEVELS].reverse()

/**
 * Search, sort and filter controls for the applications list.
 *
 * Fit is a row of toggles rather than a menu: which levels you're looking at
 * is the question the list is usually being asked, and toggles show the
 * answer at a glance where a closed menu hides it. Each carries a count, so
 * a level with nothing in it reads as empty before you click it.
 *
 * Props:
 *   view:      { sort, fits, status, query }
 *   onChange(nextView)
 *   statuses:  string[] — the lifecycle, for the stage filter
 *   counts:    Record<fit level | NO_FIT, number> — across all applications
 */
export default function ApplicationsToolbar({ view, onChange, statuses = [], counts = {} }) {
    const set = patch => onChange({ ...view, ...patch })

    function toggleFit(level) {
        const on = view.fits.includes(level)
        set({ fits: on ? view.fits.filter(f => f !== level) : [...view.fits, level] })
    }

    return (
        <div className="apps-toolbar">
            <div className="apps-toolbar-row">
                <input
                    type="search"
                    className="input apps-search"
                    placeholder="Search company or title"
                    aria-label="Search applications"
                    value={view.query}
                    onChange={e => set({ query: e.target.value })}
                />
                <select
                    className="apps-select"
                    aria-label="Sort applications"
                    value={view.sort}
                    onChange={e => set({ sort: e.target.value })}
                >
                    {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                {statuses.length > 0 && (
                    <select
                        className="apps-select"
                        aria-label="Filter by stage"
                        value={view.status}
                        onChange={e => set({ status: e.target.value })}
                    >
                        <option value="">Any stage</option>
                        {statuses.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                    </select>
                )}
            </div>

            <div className="apps-fit-row" role="group" aria-label="Filter by fit">
                {FIT_CHOICES.map(level => (
                    <button
                        key={level}
                        type="button"
                        className="fit-toggle"
                        style={{ '--fit': FIT_LEVEL_META[level]?.cssVar }}
                        aria-pressed={view.fits.includes(level)}
                        onClick={() => toggleFit(level)}
                    >
                        {FIT_LEVEL_META[level]?.label ?? level}
                        <span className="fit-toggle-count">{counts[level] ?? 0}</span>
                    </button>
                ))}
                {(counts[NO_FIT] ?? 0) > 0 && (
                    <button
                        type="button"
                        className="fit-toggle is-none"
                        aria-pressed={view.fits.includes(NO_FIT)}
                        onClick={() => toggleFit(NO_FIT)}
                    >
                        Not assessed
                        <span className="fit-toggle-count">{counts[NO_FIT]}</span>
                    </button>
                )}
            </div>
        </div>
    )
}
