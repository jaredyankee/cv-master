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
 *   onDelete(app)  — opens the confirm; omit to offer no delete
 *   disabledReason: string | null — why a Job Application can't be started
 *                   right now. Existing ones stay open and readable.
 *   statuses:       string[] — used only to tell a live stage from a stale one
 *   layout:         'list' (cards) | 'table' — the full-screen section's table
 *
 * Status is shown here but changed on the detail screen. Scanning the list for
 * "who haven't I heard back from" is the job this serves; editing in place
 * would put a dropdown on every row for something done once per application.
 */
export default function ApplicationsPanel({ applications = [], onNew, onSelect, onDelete, disabledReason = null, statuses = [], layout = 'list' }) {
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
                layout === 'table'
                    ? <ApplicationsTable
                        apps={shown}
                        statuses={statuses}
                        sort={effectiveView.sort}
                        onSort={sort => setView(v => ({ ...v, sort }))}
                        onSelect={onSelect}
                        onDelete={onDelete}
                      />
                    : <ApplicationCards apps={shown} statuses={statuses} onSelect={onSelect} onDelete={onDelete} />
            )}
        </div>
    )
}

/** The list as cards: the overview's narrow column, and every phone. */
function ApplicationCards({ apps, statuses, onSelect, onDelete }) {
    return (
        <ul className="app-list">
            {apps.map(app => {
                const state = analysisState(app)
                // Nothing to delete until the analysis writes the row.
                const deletable = Boolean(onDelete) && state !== 'pending'
                return (
                    <li key={app.id} className="app-item">
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
                        {/* A sibling of the card, not inside it: a button
                            can't hold another button. */}
                        {deletable && (
                            <button
                                type="button"
                                className="app-card-delete"
                                onClick={() => onDelete(app)}
                                aria-label={`Delete ${applicationLabel(app)}`}
                                title="Delete"
                            >
                                <TrashGlyph />
                            </button>
                        )}
                    </li>
                )
            })}
        </ul>
    )
}

// Which sort each column header applies, and which way it runs, for
// aria-sort. "Added" is the one column that goes both ways, so it toggles.
const COLUMN_SORTS = {
    company: { sort: 'company', dir: 'ascending' },
    stage:   { sort: 'status',  dir: 'descending' },
    fit:     { sort: 'fit',     dir: 'descending' },
}

/** A column header that applies its sort when clicked. */
function SortHeader({ column, sort, onSort, children }) {
    const spec = COLUMN_SORTS[column]
    const active = sort === spec.sort
    return (
        <th scope="col" aria-sort={active ? spec.dir : 'none'}>
            <button type="button" className={`app-th-btn${active ? ' is-active' : ''}`} onClick={() => onSort(spec.sort)}>
                {children}
                <span className="app-th-arrow" aria-hidden="true">{active ? (spec.dir === 'ascending' ? '↑' : '↓') : ''}</span>
            </button>
        </th>
    )
}

/**
 * The list as a table, for the full-screen Applications section. With the
 * whole width to fill, one row per application reads faster than cards:
 * role, company, stage and fit line up in columns you can scan down.
 *
 * The headers sort, using the same sorts as the toolbar's menu, so the two
 * never disagree about what order the list is in.
 */
function ApplicationsTable({ apps, statuses, sort, onSort, onSelect, onDelete }) {
    const addedDir = sort === 'newest' ? 'descending' : sort === 'oldest' ? 'ascending' : 'none'

    return (
        <table className="app-table">
            <thead>
                <tr>
                    <th scope="col">Role</th>
                    <SortHeader column="company" sort={sort} onSort={onSort}>Company</SortHeader>
                    <SortHeader column="stage" sort={sort} onSort={onSort}>Stage</SortHeader>
                    <SortHeader column="fit" sort={sort} onSort={onSort}>Fit</SortHeader>
                    <th scope="col" aria-sort={addedDir}>
                        <button
                            type="button"
                            className={`app-th-btn${addedDir !== 'none' ? ' is-active' : ''}`}
                            onClick={() => onSort(sort === 'newest' ? 'oldest' : 'newest')}
                        >
                            Added
                            <span className="app-th-arrow" aria-hidden="true">
                                {addedDir === 'descending' ? '↓' : addedDir === 'ascending' ? '↑' : ''}
                            </span>
                        </button>
                    </th>
                    {onDelete && <th scope="col"><span className="visually-hidden">Delete</span></th>}
                </tr>
            </thead>
            <tbody>
                {apps.map(app => {
                    const state = analysisState(app)
                    const level = app.response?.fit_criteria?.level
                    const stale = statuses.length > 0 && app.status && !statuses.includes(app.status)
                    return (
                        // The whole row opens the application for a mouse; the
                        // button in the first cell is the keyboard's way in.
                        <tr key={app.id} className="app-row" onClick={() => onSelect(app.id)}>
                            <td className="app-cell-role">
                                <button
                                    type="button"
                                    className="app-row-open"
                                    onClick={e => { e.stopPropagation(); onSelect(app.id) }}
                                >
                                    {app.jobTitle?.trim() || applicationLabel(app)}
                                </button>
                            </td>
                            <td className="app-cell-company">{app.companyName?.trim() || <span className="app-cell-none">—</span>}</td>
                            <td>
                                {app.status && (
                                    <span className="app-card-status" data-stale={stale ? 'true' : undefined}>
                                        {statusLabel(app.status)}
                                    </span>
                                )}
                            </td>
                            <td>
                                {state === 'pending' ? (
                                    <Progress variant="inline" phrases={['Analyzing']} startedAt={new Date(app.createdAt).getTime()} />
                                ) : state === 'failed' ? (
                                    <span className="meta-failed">Failed</span>
                                ) : level ? (
                                    <FitBadge level={level} />
                                ) : null}
                            </td>
                            <td className="app-cell-date">{formatDate(app.createdAt)}</td>
                            {onDelete && (
                                <td className="app-cell-delete">
                                    {state !== 'pending' && (
                                        <button
                                            type="button"
                                            className="app-card-delete"
                                            onClick={e => { e.stopPropagation(); onDelete(app) }}
                                            aria-label={`Delete ${applicationLabel(app)}`}
                                            title="Delete"
                                        >
                                            <TrashGlyph />
                                        </button>
                                    )}
                                </td>
                            )}
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
}

/** The view's stage, or '' once the stages are known and it isn't one of them. */
function pickStatus(view, statuses) {
    if (!view.status || statuses.length === 0 || statuses.includes(view.status)) return {}
    return { status: '' }
}

/** Drawn inline so it takes the text colour in both themes. */
function TrashGlyph() {
    return (
        <svg width="15" height="16" viewBox="0 0 15 16" aria-hidden="true" focusable="false">
            <path
                d="M1.5 3.5h12M5.5 3.5V2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1.5M3 3.5l.7 10.1a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9L12 3.5M6 6.5v5M9 6.5v5"
                fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
            />
        </svg>
    )
}
