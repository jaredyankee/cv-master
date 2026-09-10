import FitBadge from './FitBadge'
import Progress from '../common/Progress'
import { applicationLabel, formatDate, analysisState } from './applicationUtils'

/**
 * The applications list.
 *
 * Props:
 *   applications: Application[]
 *   onNew()
 *   onSelect(id)
 */
export default function ApplicationsPanel({ applications = [], onNew, onSelect }) {
    return (
        <div className="apps">
            <header className="panel-head">
                <h2 className="panel-title">
                    Applications
                    {applications.length > 0 && <span className="count">{applications.length}</span>}
                </h2>
                <button type="button" className="btn btn-primary" onClick={onNew}>
                    New application
                </button>
            </header>

            {applications.length === 0 ? (
                <div className="empty">
                    <p className="empty-title">No applications yet</p>
                    <p className="empty-hint">
                        Paste a job description. CV Master assesses the fit and builds a resume
                        from your dump.
                    </p>
                    <button type="button" className="btn btn-primary" onClick={onNew}>
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
