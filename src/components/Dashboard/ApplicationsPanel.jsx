import { useEffect, useMemo, useState } from 'react'
import FitBadge from './FitBadge'
import Progress from '../common/Progress'
import ApplicationsToolbar from './ApplicationsToolbar'
import { applicationLabel, formatDate, analysisState } from './applicationUtils'
import { statusLabel } from '../../lib/status'
import { applyView, isFiltered, sanitizeView, DEFAULT_VIEW, NO_FIT } from '../../lib/applicationView'

// Remembered per browser: which order you like to read the list in is a
// preference of this device, not a fact about your applications worth a
// database row. Read defensively — storage can be missing, blocked, or hold
// a view from an older release (see sanitizeView).
const VIEW_KEY = 'cvm.applications.view'

function loadView() {
    try {
        return sanitizeView(JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null'))
    } catch {
        return DEFAULT_VIEW
    }
}

// Below this many there is nothing to sort or narrow, and the controls would
// only be clutter above one or two cards.
const TOOLBAR_MIN = 3

/**
 * The applications list.
 *
 * Props:
 *   applications: Application[]
 *   onNew()
 *   onSelect(id)
 *   disabledReason: string | null — why a Job Application can't be started
 *                   right now. Existing ones stay open and readable.
 *   statuses:       string[] — used only to tell a live stage from a stale one
 *
 * Status is shown here but changed on the detail screen. Scanning the list for
 * "who haven't I heard back from" is the job this serves; editing in place
 * would put a dropdown on every row for something done once per application.
 */
export default function ApplicationsPanel({ applications = [], onNew, onSelect, disabledReason = null, statuses = [] }) {
    const blocked = Boolean(disabledReason)
    const [view, setView] = useState(loadView)

    useEffect(() => {
        try {
            // The search is deliberately not saved; see sanitizeView.
            const { sort, fits, status } = view
            localStorage.setItem(VIEW_KEY, JSON.stringify({ sort, fits, status }))
        } catch { /* private window, or storage blocked — the view still works */ }
    }, [view])

    // A stage remembered from an older release may no longer exist once the
    // list of stages arrives; drop it rather than filter everything out.
    const effectiveView = useMemo(() => ({ ...view, ...pickStatus(view, statuses) }), [view, statuses])

    const shown = useMemo(
        () => applyView(applications, effectiveView, statuses),
        [applications, effectiveView, statuses],
    )

    const counts = useMemo(() => {
        const c = {}
        for (const app of applications) {
            const f = app?.response?.fit_criteria?.level ?? NO_FIT
            c[f] = (c[f] ?? 0) + 1
        }
        return c
    }, [applications])

    const filtered = isFiltered(effectiveView)
    const showToolbar = applications.length >= TOOLBAR_MIN || filtered
    const clear = () => setView(v => ({ ...DEFAULT_VIEW, sort: v.sort }))

    return (
        <div className="apps">
            <header className="panel-head">
                <h2 className="panel-title">
                    Applications
                    {applications.length > 0 && <span className="count">{applications.length}</span>}
                </h2>
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onNew}
                    disabled={blocked}
                    title={disabledReason ?? undefined}
                >
                    Job Application
                </button>
            </header>

            {blocked && (
                <p className="apps-blocked">{disabledReason}</p>
            )}

            {showToolbar && (
                <ApplicationsToolbar
                    view={effectiveView}
                    onChange={setView}
                    statuses={statuses}
                    counts={counts}
                />
            )}

            {filtered && applications.length > 0 && (
                <p className="apps-result" role="status">
                    Showing {shown.length} of {applications.length}
                    <button type="button" className="link-btn" onClick={clear}>Clear filters</button>
                </p>
            )}

            {applications.length === 0 ? (
                <div className="empty">
                    <p className="empty-title">No applications yet</p>
                    <p className="empty-hint">
                        Paste a job description. CV Master assesses the fit and builds a resume
                        from your dump.
                    </p>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={onNew}
                        disabled={blocked}
                        title={disabledReason ?? undefined}
                    >
                        Add your first
                    </button>
                </div>
            ) : shown.length === 0 ? (
                <div className="empty">
                    <p className="empty-title">No applications match</p>
                    <p className="empty-hint">Nothing fits every filter you have on.</p>
                    <button type="button" className="btn" onClick={clear}>Clear filters</button>
                </div>
            ) : (
                <ul className="app-list">
                    {shown.map(app => {
                        const state = analysisState(app)
                        return (
                            <li key={app.id}>
                                <button type="button" className="app-card" onClick={() => onSelect(app.id)}>
                                    <span className="app-card-top">
                                        <span className="app-card-title">{applicationLabel(app)}</span>
                                        {app.status && (
                                            <span
                                                className="app-card-status"
                                                // A status the enum no longer lists still shows,
                                                // marked, rather than disappearing from the row.
                                                data-stale={statuses.length > 0 && !statuses.includes(app.status) ? 'true' : undefined}
                                            >
                                                {statusLabel(app.status)}
                                            </span>
                                        )}
                                        {app.response?.fit_criteria?.level && (
                                            <FitBadge level={app.response.fit_criteria.level} />
                                        )}
                                    </span>

                                    <span className="app-card-meta">
                                        {state === 'pending' ? (
                                            <Progress
                                                variant="inline"
                                                phrases={['Analyzing']}
                                                startedAt={new Date(app.createdAt).getTime()}
                                            />
                                        ) : (
                                            <>
                                                <span>{formatDate(app.createdAt)}</span>
                                                {state === 'failed' && <span className="meta-failed">Failed</span>}
                                                {app.questions?.length > 0 && (
                                                    <span>{app.questions.length} question{app.questions.length !== 1 ? 's' : ''}</span>
                                                )}
                                                {app.notes && <span>Notes</span>}
                                            </>
                                        )}
                                    </span>
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}

/** The view's stage, or '' once the stages are known and it isn't one of them. */
function pickStatus(view, statuses) {
    if (!view.status || statuses.length === 0 || statuses.includes(view.status)) return {}
    return { status: '' }
}
