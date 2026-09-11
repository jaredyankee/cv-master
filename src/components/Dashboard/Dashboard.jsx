import { useState } from 'react'
import ResumeDumpPanel from './ResumeDumpPanel'
import ApplicationsPanel from './ApplicationsPanel'
import NewApplicationForm from './NewApplicationForm'
import ApplicationDetail from './ApplicationDetail'
import RegenerateDialog from './RegenerateDialog'
import CachedDumpChip from './CachedDumpChip'
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
 *   onSaveDump(patch)      — optional; persists a partial dump edit
 *   onSaveResume(id, ja)   — optional; persists an edited built resume
 *   user                   — { name, email } from the auth session (optional)
 *   onSignOut()            — optional; renders a Sign out button when provided
 *   dumpState              — 'READY' | 'NEW' | 'REVISE'
 *   cached                 — { dump, at } | null — the previous profile
 *   hasSourceText          — whether the text behind this profile was kept
 *   error                  — string | null — a failed lifecycle action
 *   onRegenerate(mode)     — 'NEW' | 'REVISE'
 *   onRecoverCache()       — put the cached profile back
 *   onClearCache()         — delete the cached profile
 *   onResumeRegeneration() — return to the dump form mid-flow
 */
export default function Dashboard({
    resumeDump,
    answeredQuestions = [],
    applications = [],
    onCreateApplication,
    onEditProfile,
    onSaveDump,
    onSaveResume,
    user = null,
    onSignOut,
    dumpState = 'READY',
    cached = null,
    hasSourceText = false,
    error = null,
    onRegenerate,
    onRecoverCache,
    onClearCache,
    onResumeRegeneration,
}) {
    // { mode: 'list' | 'new' | 'detail', id }
    const [view, setView] = useState({ mode: 'list', id: null })
    // Which list panel a narrow viewport shows. Ignored by CSS above the breakpoint.
    const [tab, setTab] = useState('apps')
    const [regenOpen, setRegenOpen] = useState(false)

    const isRegenerating = dumpState !== 'READY'

    /** The regenerate control plus the cached-profile chip, under the panel title. */
    const dumpHeader = (
        <div className="dump-header">
            {error && (
                <div className="alert alert-error" role="alert">
                    <strong>Couldn't do that.</strong> {error}
                </div>
            )}
            {cached && (
                <CachedDumpChip
                    cached={cached}
                    onRecover={onRecoverCache}
                    onClear={onClearCache}
                />
            )}
            {onRegenerate && !isRegenerating && (
                <button
                    type="button"
                    className="btn btn-warning regen-btn"
                    onClick={() => setRegenOpen(true)}
                >
                    Rebuild profile
                </button>
            )}
        </div>
    )

    async function handleRegenerate(mode) {
        await onRegenerate?.(mode)
        setRegenOpen(false)
    }

    const selected = view.mode === 'detail'
        ? applications.find(a => a.id === view.id) ?? null
        : null

    const showList   = () => setView({ mode: 'list', id: null })
    const showNew    = () => setView({ mode: 'new', id: null })
    const showDetail = (id) => setView({ mode: 'detail', id })

    // Both panels share the page scroller, so switching tabs while scrolled
    // down would drop you into the middle of the other one.
    function selectTab(next) {
        setTab(next)
        window.scrollTo({ top: 0 })
    }

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
                        : <ApplicationDetail
                            application={selected}
                            onBack={showList}
                            onSaveResume={onSaveResume && (ja => onSaveResume(selected.id, ja))}
                          />}
                </main>
            </div>
        )
    }

    // ── list screen: dump beside applications ────────────────────
    // On a phone the two panels can't sit side by side, and stacking them puts
    // the whole dump above the applications — a lot of scrolling to reach the
    // part you act on. So narrow viewports get tabs instead. Both panels stay
    // mounted and CSS hides one, which keeps scroll position and any open
    // section editor alive when switching.
    return (
        <div className="shell">
            {topbar}
            <div className="list-screen" data-tab={tab}>
                <nav className="mobile-tabs" role="tablist" aria-label="Dashboard panels">
                    <button
                        type="button" role="tab" id="tab-apps"
                        aria-selected={tab === 'apps'} aria-controls="panel-apps"
                        className={`mobile-tab${tab === 'apps' ? ' is-active' : ''}`}
                        onClick={() => selectTab('apps')}
                    >
                        Applications
                        {applications.length > 0 && <span className="count">{applications.length}</span>}
                    </button>
                    <button
                        type="button" role="tab" id="tab-profile"
                        aria-selected={tab === 'profile'} aria-controls="panel-profile"
                        className={`mobile-tab${tab === 'profile' ? ' is-active' : ''}`}
                        onClick={() => selectTab('profile')}
                    >
                        Profile
                    </button>
                </nav>

                <div className="split">
                    <aside className="split-dump" id="panel-profile" role="tabpanel" aria-labelledby="tab-profile">
                        <ResumeDumpPanel
                            dump={resumeDump}
                            answeredQuestions={answeredQuestions}
                            onSave={onSaveDump}
                            dumpState={dumpState}
                            header={dumpHeader}
                            onResume={onResumeRegeneration}
                        />
                    </aside>
                    <main className="split-apps" id="panel-apps" role="tabpanel" aria-labelledby="tab-apps">
                        <ApplicationsPanel
                            applications={applications}
                            onNew={showNew}
                            onSelect={showDetail}
                            // A new application is built from the profile, and
                            // right now there isn't one.
                            disabledReason={isRegenerating
                                ? 'Finish rebuilding your profile to start a new application.'
                                : null}
                        />
                    </main>
                </div>
            </div>

            {regenOpen && (
                <RegenerateDialog
                    onConfirm={handleRegenerate}
                    onCancel={() => setRegenOpen(false)}
                    hasSourceText={hasSourceText}
                    applicationCount={applications.length}
                />
            )}
        </div>
    )
}
