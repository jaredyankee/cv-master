import FitBadge from './FitBadge'
import Progress from '../common/Progress'
import { applicationLabel, formatDate, analysisState } from './applicationUtils'
import { statusLabel } from '../../lib/status'

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
            ) : (
                <ul className="app-list">
                    {applications.map(app => {
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
