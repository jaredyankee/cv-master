import { useCallback, useState } from 'react'
import ResumeDumpPanel from './ResumeDumpPanel'
import ApplicationsPanel from './ApplicationsPanel'
import NewApplicationForm from './NewApplicationForm'
import LeadsPanel from './LeadsPanel'
import ApplicationDetail from './ApplicationDetail'
import RegenerateDialog from './RegenerateDialog'
import CachedDumpChip from './CachedDumpChip'
import ProfileDrawer from './ProfileDrawer'
import './Dashboard.css'

/**
 * Main interface after onboarding.
 *
 * The profile lives in a drawer that slides out from the top bar. It is edited
 * now and then; listings and applications are used every session, so those two
 * get the screen and the profile stays one click away. Mid-rebuild the order
 * flips: there is no profile to search for, so the listings column shows the
 * rebuild in progress instead, where it can't be missed.
 *
 * Two screens, not one:
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
 *   statuses               — string[] — the lifecycle stages, in order
 *   onSetStatus(id, s)     — optional; moves one application along the lifecycle
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
 *   leads                  — LeadsPanel's state; see there
 *   leadsForm / leadsError — the open preferences form, and the last search error
 *   onOpenLeadsForm(), onCloseLeadsForm(), onSaveLeadPreferences(p, key),
 *   onSearchLeads(), onDismissLead(id) — passed through to LeadsPanel
 */
export default function Dashboard({
    resumeDump,
    answeredQuestions = [],
    applications = [],
    onCreateApplication,
    onEditProfile,
    onSaveDump,
    onSaveResume,
    statuses = [],
    onSetStatus,
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
    leads = null,
    leadsForm = null,
    leadsError = null,
    onOpenLeadsForm,
    onCloseLeadsForm,
    onSaveLeadPreferences,
    onSearchLeads,
    onDismissLead,
}) {
    // { mode: 'list' | 'new' | 'detail', id, lead } — `lead` is set when a new
    // application starts from a listing, so the form can carry its link.
    const [view, setView] = useState({ mode: 'list', id: null, lead: null })
    // Which list panel a narrow viewport shows: 'apps' | 'leads'. Ignored by
    // CSS above the breakpoint.
    const [tab, setTab] = useState('apps')
    const [regenOpen, setRegenOpen] = useState(false)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const closeDrawer = useCallback(() => setDrawerOpen(false), [])

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

    const showList     = () => setView({ mode: 'list', id: null, lead: null })
    const showNew      = () => setView({ mode: 'new', id: null, lead: null })
    const showNewFrom  = (lead) => setView({ mode: 'new', id: null, lead })
    const showDetail   = (id) => setView({ mode: 'detail', id, lead: null })

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

    // "Jared's profile" when the dump has a name, so the button reads as yours.
    const firstName = String(resumeDump?.contact?.name ?? '').trim().split(/\s+/)[0]
    const profileLabel = firstName ? `${firstName}’s profile` : 'Your profile'
    const liveLeads = (leads?.leads ?? []).filter(l => !l.disqualifiedFor).length

    const topbar = (
        // Inert while the drawer is open: the backdrop covers it, and nothing
        // behind a modal panel should be reachable by Tab either.
        <header className="topbar" inert={drawerOpen}>
            <span className="topbar-brand">CV&nbsp;Master</span>
            {/* Hidden mid-rebuild: the profile is empty on purpose then, and
                the listings column already shows what is going on. */}
            {!isRegenerating && (
                <button
                    type="button"
                    className="profile-trigger"
                    onClick={() => setDrawerOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={drawerOpen}
                    // The label is hidden on the narrowest phones; this keeps
                    // the icon-only button named.
                    aria-label={profileLabel}
                >
                    <ProfileGlyph />
                    <span className="profile-trigger-label">{profileLabel}</span>
                </button>
            )}
            <span className="topbar-user">{user?.email ?? resumeDump?.contact?.name}</span>
            <nav className="topbar-nav">
                {onSignOut && (
                    <button type="button" className="link-btn" onClick={onSignOut}>Sign out</button>
                )}
            </nav>
        </header>
    )

    // Rendered on every screen, so the profile is one click away from an
    // application's detail page too, not only from the list.
    const drawer = !isRegenerating && (
        <ProfileDrawer
            open={drawerOpen}
            onClose={closeDrawer}
            title="Profile"
            actions={onEditProfile && (
                <button
                    type="button" className="link-btn"
                    onClick={() => { setDrawerOpen(false); onEditProfile() }}
                >
                    Review suggestions
                </button>
            )}
        >
            <ResumeDumpPanel
                dump={resumeDump}
                answeredQuestions={answeredQuestions}
                onSave={onSaveDump}
                dumpState={dumpState}
                header={dumpHeader}
                onResume={onResumeRegeneration}
            />
        </ProfileDrawer>
    )

    // ── focus screens: one job at a time, no dump panel ──────────
    if (view.mode === 'new' || selected) {
        return (
            <div className="shell">
                {topbar}
                <main className="focus" inert={drawerOpen}>
                    {view.mode === 'new'
                        ? <NewApplicationForm onSubmit={handleCreate} onCancel={showList} lead={view.lead} />
                        : <ApplicationDetail
                            application={selected}
                            onBack={showList}
                            onSaveResume={onSaveResume && (ja => onSaveResume(selected.id, ja))}
                            statuses={statuses}
                            onSetStatus={onSetStatus && (s => onSetStatus(selected.id, s))}
                          />}
                </main>
                {drawer}
            </div>
        )
    }

    // ── list screen: listings beside applications ────────────────
    // On a phone the two columns become tabs rather than a stack, so the one
    // you act on isn't a long scroll below the other. Both stay mounted and CSS
    // hides one, which keeps scroll position and any open form alive across a
    // switch.
    return (
        <div className="shell">
            {topbar}
            <div className="list-screen" data-tab={tab} inert={drawerOpen}>
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
                        type="button" role="tab" id="tab-leads"
                        aria-selected={tab === 'leads'} aria-controls="panel-leads"
                        className={`mobile-tab${tab === 'leads' ? ' is-active' : ''}`}
                        onClick={() => selectTab('leads')}
                    >
                        {isRegenerating ? 'Profile' : 'Listings'}
                        {!isRegenerating && liveLeads > 0 && <span className="count">{liveLeads}</span>}
                    </button>
                </nav>

                <div className="split">
                    <section className="split-leads" id="panel-leads" role="tabpanel" aria-labelledby="tab-leads">
                        {isRegenerating ? (
                            // The rebuild in progress, where it can't be missed:
                            // a search needs a profile, and there isn't one.
                            <ResumeDumpPanel
                                dump={resumeDump}
                                dumpState={dumpState}
                                header={dumpHeader}
                                onResume={onResumeRegeneration}
                            />
                        ) : (
                            <LeadsPanel
                                state={leads}
                                form={leadsForm}
                                error={leadsError}
                                onOpenForm={onOpenLeadsForm}
                                onCloseForm={onCloseLeadsForm}
                                onSavePreferences={onSaveLeadPreferences}
                                onSearch={onSearchLeads}
                                onDismiss={onDismissLead}
                                onStart={showNewFrom}
                            />
                        )}
                    </section>
                    <main className="split-apps" id="panel-apps" role="tabpanel" aria-labelledby="tab-apps">
                        <ApplicationsPanel
                            applications={applications}
                            onNew={showNew}
                            onSelect={showDetail}
                            statuses={statuses}
                            // A Job Application is built from the profile, and
                            // right now there isn't one.
                            disabledReason={isRegenerating
                                ? 'Finish rebuilding your profile to start a Job Application.'
                                : null}
                        />
                    </main>
                </div>
            </div>

            {drawer}

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

/**
 * A page with lines of text — "your profile document" — drawn inline so it
 * inherits the text colour in both themes rather than needing an asset per
 * theme.
 */
function ProfileGlyph() {
    return (
        <svg className="profile-glyph" width="18" height="20" viewBox="0 0 18 20" aria-hidden="true" focusable="false">
            <rect x="1" y="1" width="16" height="18" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 6h8M5 9.5h8M5 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    )
}
