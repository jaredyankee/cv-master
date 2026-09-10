import { useState } from 'react'
import ResumeDumpPanel from './ResumeDumpPanel'
import ApplicationsPanel from './ApplicationsPanel'
import NewApplicationForm from './NewApplicationForm'
import ApplicationDetail from './ApplicationDetail'
import './Dashboard.css'

/**
 * Main interface after onboarding. Two screens, not one:
 *
 *   list   — the resume dump beside the applications list
 *   focus  — one application, or the new-application form, full width with a
 *            back button. Viewing an application is its own task; the dump
 *            would only compete with it for attention.
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
    // { mode: 'list' | 'new' | 'detail', id }
    const [view, setView] = useState({ mode: 'list', id: null })

    const selected = view.mode === 'detail'
        ? applications.find(a => a.id === view.id) ?? null
        : null

    const showList   = () => setView({ mode: 'list', id: null })
    const showNew    = () => setView({ mode: 'new', id: null })
    const showDetail = (id) => setView({ mode: 'detail', id })

    function handleCreate(input) {
        const created = onCreateApplication?.(input)
        if (created?.id) showDetail(created.id)
        else showList()
    }

    const topbar = (
        <header className="topbar">
            <span className="topbar-brand">CV&nbsp;Master</span>
            <span className="topbar-user">{user?.email ?? resumeDump?.contact?.name}</span>
            <nav className="topbar-nav">
                <button type="button" className="link-btn" onClick={onEditProfile}>Edit profile</button>
                {onSignOut && (
                    <button type="button" className="link-btn" onClick={onSignOut}>Sign out</button>
                )}
            </nav>
        </header>
    )

    // ── focus screens: one job at a time, no dump panel ──────────
    if (view.mode === 'new' || selected) {
        return (
            <div className="shell">
                {topbar}
                <main className="focus">
                    {view.mode === 'new'
                        ? <NewApplicationForm onSubmit={handleCreate} onCancel={showList} />
                        : <ApplicationDetail application={selected} onBack={showList} />}
                </main>
            </div>
        )
    }

    // ── list screen: dump beside applications ────────────────────
    return (
        <div className="shell">
            {topbar}
            <div className="split">
                <aside className="split-dump">
                    <ResumeDumpPanel dump={resumeDump} answeredQuestions={answeredQuestions} />
                </aside>
                <main className="split-apps">
                    <ApplicationsPanel
                        applications={applications}
                        onNew={showNew}
                        onSelect={showDetail}
                    />
                </main>
            </div>
        </div>
    )
}
