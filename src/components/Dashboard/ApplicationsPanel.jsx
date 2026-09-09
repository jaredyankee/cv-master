import FitBadge from './FitBadge'
import { applicationLabel, formatDate, analysisState } from './applicationUtils'

const STATE_LABEL = { pending: 'Analyzing…', failed: 'Failed' }

/**
 * Right-panel list of applications with the "+" entry point.
 *
 * Props:
 *   applications: Application[]
 *   onNew()
 *   onSelect(id)
 */
export default function ApplicationsPanel({ applications = [], onNew, onSelect }) {
    return (
        <div className="apps">
            <div className="panel-header">
                <h2 className="panel-title">
                    Applications{applications.length > 0 && <span className="panel-count">{applications.length}</span>}
                </h2>
                <button type="button" className="new-app-btn" onClick={onNew}>
                    <span className="new-app-plus" aria-hidden="true">+</span> New application
                </button>
            </div>

            {applications.length === 0 ? (
                <div className="apps-empty">
                    <p className="apps-empty-title">No applications yet</p>
                    <p className="apps-empty-hint">
                        Paste a job description and CV Master will assess the fit and build a
                        resume from your dump.
                    </p>
                    <button type="button" className="new-app-btn" onClick={onNew}>
                        <span className="new-app-plus" aria-hidden="true">+</span> Add your first
                    </button>
                </div>
            ) : (
                <ul className="app-list">
                    {applications.map(app => (
                        <li key={app.id}>
                            <button type="button" className="app-card" onClick={() => onSelect(app.id)}>
                                <div className="app-card-top">
                                    <span className="app-card-title">{applicationLabel(app)}</span>
                                    {app.response?.fit_criteria?.level
                                        ? <FitBadge level={app.response.fit_criteria.level} />
                                        : <span className={`status-pill is-${analysisState(app)}`}>{STATE_LABEL[analysisState(app)]}</span>}
                                </div>
                                <div className="app-card-meta">
                                    <span>{formatDate(app.createdAt)}</span>
                                    {app.questions?.length > 0 && (
                                        <span>{app.questions.length} question{app.questions.length !== 1 ? 's' : ''}</span>
                                    )}
                                    {app.notes && <span>Has notes</span>}
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
