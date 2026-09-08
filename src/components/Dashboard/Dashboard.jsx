import { useState } from 'react'
import ResumeDumpPanel from './ResumeDumpPanel'
import ApplicationsPanel from './ApplicationsPanel'
import NewApplicationForm from './NewApplicationForm'
import ApplicationDetail from './ApplicationDetail'
import './Dashboard.css'

/**
 * Main interface after onboarding.
 *   Left panel  — the finalized resume dump
 *   Right panel — job applications: list, "+" to create, click to view
 *
 * Props:
 *   resumeDump:            ResumeDump
 *   answeredQuestions:     { question, reference, answer }[]  (from DumpReview)
 *   applications:          Application[] — newest first
 *   onCreateApplication(input) → Application  — input: { jobDescription, notes, questions }
 *   onEditProfile()        — go back to the review step
 *   user                   — { name, email } from the auth session (optional)
 *   onSignOut()            — optional; renders a Sign out button when provided
 */
export default function Dashboard({
    resumeDump,
    answeredQuestions = [],
    applications = [],
    onCreateApplication,
    onEditProfile,
    user = null,
    onSignOut,
}) {
    // right-panel state: { mode: 'list' | 'new' | 'detail', id }
    const [panel, setPanel] = useState({ mode: 'list', id: null })

    const selected = panel.mode === 'detail'
        ? applications.find(a => a.id === panel.id) ?? null
        : null

    function showList()      { setPanel({ mode: 'list', id: null }) }
    function showNew()       { setPanel({ mode: 'new', id: null }) }
    function showDetail(id)  { setPanel({ mode: 'detail', id }) }

    function handleCreate(input) {
        const created = onCreateApplication?.(input)
        if (created?.id) showDetail(created.id)
        else showList()
    }

    let right
    if (panel.mode === 'new') {
        right = <NewApplicationForm onSubmit={handleCreate} onCancel={showList} />
    } else if (selected) {
        right = <ApplicationDetail application={selected} onBack={showList} />
    } else {
        right = (
            <ApplicationsPanel
                applications={applications}
                onNew={showNew}
                onSelect={showDetail}
            />
        )
    }

    return (
        <div className="dashboard">
            <header className="dashboard-topbar">
                <span className="dashboard-brand">CV Master</span>
                <span className="dashboard-user">{user?.email ?? resumeDump?.contact?.name}</span>
                <button type="button" className="link-btn" onClick={onEditProfile}>
                    Edit profile
                </button>
                {onSignOut && (
                    <button type="button" className="link-btn" onClick={onSignOut}>
                        Sign out
                    </button>
                )}
            </header>

            <div className="dashboard-body">
                <aside className="panel panel-dump">
                    <ResumeDumpPanel dump={resumeDump} answeredQuestions={answeredQuestions} />
                </aside>
                <main className="panel panel-apps">
                    {right}
                </main>
            </div>
        </div>
    )
}
