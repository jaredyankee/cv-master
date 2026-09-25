import { appRequest } from "./api"
import { pollUntil } from "./lib/poll"
import { runOutcome } from "./lib/searchRun"
import { authClient, AUTH_CONFIGURED } from "./auth"
import { useEffect, useState } from "react"
import AuthForm from "./components/Auth/AuthForm"
import DumpReview from "./components/Onboarding/DumpReview"
import OnboardingForm from "./components/Onboarding/OnboardingForm"
import Dashboard from "./components/Dashboard/Dashboard"
import "./App.css"

const makeId = () =>
    (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

// How long each background job is given before the UI gives up waiting.
// Unchanged from the flat-interval version; only the number of requests
// spent inside the window has gone down.
const DUMP_POLL_BUDGET_MS        = 3 * 60 * 1000
const APPLICATION_POLL_BUDGET_MS = 5 * 60 * 1000
const LEADS_POLL_BUDGET_MS       = 5 * 60 * 1000

/** The leads panel's state, or null if it couldn't be read. */
async function fetchLeadState() {
    try {
        const res = await appRequest("/job-search", "GET")
        if (!res.ok) return null
        const body = await res.json()
        return { ...body, loaded: true }
    } catch (err) {
        console.error("Could not load listings", err)
        return null
    }
}

/**
 * Polls until a search finishes, or until it's clear the server didn't start
 * one. See src/lib/searchRun.js for why "finished" can't simply be
 * `running === false`.
 *
 * `before` is run.startedAt as it was before asking. Pass undefined to accept
 * whichever run is current — resuming a watch after a reload mid-search.
 *
 * @returns {Promise<{ state, outcome: 'done'|'skipped' } | undefined>}
 *          undefined when the budget ran out with the run still going
 */
async function watchLeadSearch(before, onUpdate) {
    const askedAt = Date.now()
    return pollUntil(LEADS_POLL_BUDGET_MS, async () => {
        const state = await fetchLeadState()
        if (!state) return undefined
        onUpdate(state)
        const outcome = runOutcome(before, state.run, Date.now() - askedAt)
        return outcome === 'waiting' ? undefined : { state, outcome }
    })
}

/**
 * Everything a signed-in user sees. Mounted with key={user.id}, so signing out
 * or switching accounts unmounts it and all per-user state is dropped.
 */
function Workspace({ user, onSignOut }) {
    const [view, setView]                             = useState('loading') // 'loading' | 'onboarding' | 'review' | 'dashboard'
    const [onboardingResponse, setOnboardingResponse] = useState(null)
    const [resumeDump, setResumeDump]                 = useState(null)  // finalized dump
    const [applications, setApplications]             = useState([])    // newest first
    // The job_application_status labels, in pipeline order, as the database
    // defines them. Empty until the list loads, which is what makes the status
    // control read-only rather than offering stages that may not exist.
    const [statuses, setStatuses]                     = useState([])
    // Listings. Loaded after the dashboard is on screen, never before it: a
    // slow read here must not hold up the applications list.
    const [leads, setLeads]             = useState(null)   // { leads, preferences, run, hasKey, loaded }
    const [leadsForm, setLeadsForm]     = useState(null)   // { preferences, seeded } while the form is open
    const [leadsError, setLeadsError]   = useState(null)
    const [isLoading, setIsLoading]                   = useState(false)

    // Dump lifecycle. `hasDump` is the row's existence, which is the only
    // thing that means "this user has dumped before" — a regenerate empties
    // the dump's fields but never deletes the row, so a user mid-regenerate
    // still belongs on the dashboard rather than at the start of onboarding.
    const [hasDump, setHasDump]         = useState(false)
    const [dumpState, setDumpState]     = useState('READY') // 'NEW' | 'REVISE' | 'READY'
    const [cached, setCached]           = useState(null)    // { dump, at } — the previous profile
    const [sourceText, setSourceText]   = useState('')      // what the user typed last time
    const [provider, setProvider]       = useState('anthropic')
    const [configuredProviders, setConfiguredProviders] = useState([])
    const [dumpError, setDumpError]     = useState(null)

    // The review's points, carried into a REVISE so they sit beside the box
    // the user is rewriting. Deliberately not `onboardingResponse`: that one
    // decides whether "Edit profile" opens the review screen, and during a
    // rebuild there is no profile for it to review.
    const [reviseFeedback, setReviseFeedback] = useState(null)
    // Which of those points the user has ticked off, as "revision:0" keys.
    // Held here so stepping out to the dashboard and back doesn't reset them.
    const [addressed, setAddressed] = useState(() => new Set())

    const isDone = (kind, index) => addressed.has(`${kind}:${index}`)
    const toggleDone = (kind, index) => setAddressed(prev => {
        const next = new Set(prev)
        const key = `${kind}:${index}`
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
    })

    // On mount: load the dump (skip onboarding if it exists) and the user's
    // applications. The user is identified by the bearer token appRequest attaches.
    useEffect(() => {
        let cancelled = false

        async function loadWorkspace() {
            try {
                const res = await appRequest("/resume-dump", "GET")
                if (cancelled) return

                // Signed in, but this deployment's allowlist doesn't include
                // them. Say so — every other screen would just fail later and
                // look broken.
                if (res.status === 403) {
                    setView('denied')
                    return
                }

                const result = res.ok ? await res.json() : null
                if (cancelled) return

                if (!(result?.exists && result.data?.resume_dump)) {
                    setView('onboarding')
                    return
                }

                const {
                    resume_dump, revisions = [], questions = [],
                    dump_state = 'READY', source_text = '', cached_dump = null,
                    cached_at = null, provider: storedProvider = 'anthropic',
                    configured_providers = [],
                } = result.data

                setHasDump(true)
                setDumpState(dump_state)
                setSourceText(source_text ?? '')
                setCached(cached_dump ? { dump: cached_dump, at: cached_at } : null)
                setProvider(storedProvider)
                setConfiguredProviders(configured_providers)
                setResumeDump(resume_dump)
                // keep the review payload so "Edit profile" can reopen it
                setOnboardingResponse({ resume_dump, revisions, questions })
                // Reloading mid-revise should land back on the same worklist.
                // The diff survives a rebuild, so the points are still here.
                if (dump_state === 'REVISE') setReviseFeedback({ revisions, questions })

                try {
                    const appsRes = await appRequest("/job-application", "GET")
                    const apps = appsRes.ok ? await appsRes.json() : null
                    if (!cancelled && Array.isArray(apps?.applications)) setApplications(apps.applications)
                    if (!cancelled && Array.isArray(apps?.statuses)) setStatuses(apps.statuses)
                } catch (err) {
                    console.error("Could not load applications", err)
                }

                if (!cancelled) setView('dashboard')

                // Listings load after the dashboard is up, so a slow read here
                // never delays it. A reload mid-search picks the watch back up.
                fetchLeadState().then(state => {
                    if (cancelled || !state) return
                    setLeads(state)
                    if (state.run?.running) {
                        watchLeadSearch(undefined, next => { if (!cancelled) setLeads(next) })
                    }
                })
            } catch (err) {
                console.error("Could not check for an existing resume dump", err)
                if (!cancelled) setView('onboarding')
            }
        }

        loadWorkspace()
        return () => { cancelled = true }
    }, [])


    async function handleDumpSubmit(dumpText, apiKey, chosenProvider, searchKey = '') {
        setIsLoading(true)
        setDumpError(null)
        try {
            // Kick off background AI processing (returns 202 immediately).
            // An empty key means "use the one already on file" — the function
            // falls back to the stored key, so don't send an empty header.
            await appRequest("/resume-dump-background", "POST",
                apiKey ? { 'X-Api-Key': apiKey } : null,
                {
                    resume_dump: dumpText,
                    provider: chosenProvider,
                    // In the body, not a header: X-Api-Key is already this
                    // request's model key. See resume-dump-background.
                    ...(searchKey ? { search_key: searchKey } : {}),
                }
            );

            // Poll until AI processing completes, backing off as it drags on
            // (3 min budget). See src/lib/poll.js for why it isn't a flat interval.
            const ready = await pollUntil(DUMP_POLL_BUDGET_MS, async () => {
                const res = await appRequest("/resume-dump?ping=true", "GET");
                if (!res.ok) return undefined;
                const result = await res.json();
                return result?.ready ? result : undefined;
            });

            if (ready) {
                setResumeDump(ready.data?.resume_dump);
                setOnboardingResponse(ready.data);
                // The ingestion put the row back in READY; mirror that
                // locally so the dashboard behind the review is correct.
                setHasDump(true);
                setDumpState('READY');
                setSourceText(dumpText);
                // The key that just worked is now on file for this provider.
                setProvider(chosenProvider);
                setConfiguredProviders(prev =>
                    prev.includes(chosenProvider) ? prev : [...prev, chosenProvider]);
                // The worklist belonged to the text that was just replaced.
                setReviseFeedback(null);
                setAddressed(new Set());
                setView('review');
                return;
            }
            throw new Error("Timed out waiting for the analysis. It may still finish; reload to check.");
        } catch (err) {
            console.error("Error on dump request", err)
            setDumpError(err.message ?? "Something went wrong building your profile.")
        } finally {
            setIsLoading(false)
        }
    }

    /**
     * Dump lifecycle actions. All three answer with the dump row's new state,
     * so the client never has to guess what the server did.
     */
    async function dumpAction(body) {
        const res = await appRequest("/resume-dump", "POST", null, body)
        if (!res.ok) {
            let message = `Request failed (${res.status})`
            try { message = (await res.json()).message ?? message } catch { /* no body */ }
            throw new Error(message)
        }
        const { data } = await res.json()
        setResumeDump(data?.resume_dump ?? null)
        setDumpState(data?.dump_state ?? 'READY')
        setSourceText(data?.source_text ?? '')
        setCached(data?.cached_dump ? { dump: data.cached_dump, at: data.cached_at } : null)
        return data
    }

    /**
     * Start over or revise. Either way the current profile moves to the cache
     * slot and the user goes to the dump form; the dashboard stays reachable
     * and will offer to bring them back.
     */
    async function handleRegenerate(mode) {
        setDumpError(null)
        try {
            // Capture the review's points before clearing the payload: a
            // revise is a rewrite driven by exactly those points, so they go
            // to the form as a worklist. Starting over discards the text they
            // were raised about, so they'd be advice about nothing.
            const feedback = mode === 'REVISE' && onboardingResponse
                ? { revisions: onboardingResponse.revisions ?? [], questions: onboardingResponse.questions ?? [] }
                : null

            await dumpAction({ action: 'regenerate', mode })

            // The review payload described the profile that was just cached.
            setOnboardingResponse(null)
            setReviseFeedback(feedback)
            setAddressed(new Set())
            setView('onboarding')
        } catch (err) {
            console.error("Could not start the regeneration", err)
            setDumpError(err.message)
        }
    }

    /** Put the cached profile back and return to a normal dashboard. */
    async function handleRecoverCache() {
        setDumpError(null)
        try {
            const data = await dumpAction({ action: 'recover' })
            if (data?.resume_dump) {
                setOnboardingResponse({ resume_dump: data.resume_dump, revisions: [], questions: [] })
            }
            // Recovering abandons the rebuild, and with it its worklist.
            setReviseFeedback(null)
            setAddressed(new Set())
            setView('dashboard')
        } catch (err) {
            console.error("Could not recover the cached profile", err)
            setDumpError(err.message)
        }
    }

    /** Drop the cached profile. The live dump is untouched. */
    async function handleClearCache() {
        setDumpError(null)
        try {
            await dumpAction({ action: 'clear-cache' })
        } catch (err) {
            console.error("Could not clear the cached profile", err)
            setDumpError(err.message)
        }
    }

    /**
     * PUTs the whole dump (the server takes the complete object) built from
     * the current state plus a partial patch from one section editor.
     * Throws on failure so EditableSection can keep the draft on screen.
     */
    async function handleSaveDump(patch, { finalized } = {}) {
        const next = { ...resumeDump, ...patch }
        const res = await appRequest("/resume-dump", "PUT", null, {
            resume_dump: next,
            ...(finalized ? { finalized: true } : {}),
        })
        if (!res.ok) {
            let message = `Save failed (${res.status})`
            try { message = (await res.json()).message ?? message } catch { /* no body */ }
            throw new Error(message)
        }
        const body = await res.json()
        // Trust the server's copy: it normalized and trimmed what we sent.
        setResumeDump(body?.data?.resume_dump ?? next)
    }

    /** Persists an edited built resume for one application. */
    async function handleSaveResume(id, jobApplication) {
        const res = await appRequest(`/job-application?id=${encodeURIComponent(id)}`, "PUT", null, {
            job_application: jobApplication,
        })
        if (!res.ok) {
            let message = `Save failed (${res.status})`
            try { message = (await res.json()).message ?? message } catch { /* no body */ }
            throw new Error(message)
        }
        const body = await res.json()
        if (body?.data) patchApplication(id, body.data)
    }

    /**
     * Move one application along the lifecycle. Throws on failure so
     * StatusControl can say so and leave the stored status on screen —
     * an optimistic update here would show a stage that isn't saved.
     */
    async function handleSetStatus(id, status) {
        const res = await appRequest(`/job-application?id=${encodeURIComponent(id)}`, "PUT", null, { status })
        if (!res.ok) {
            let message = `Save failed (${res.status})`
            try { message = (await res.json()).message ?? message } catch { /* no body */ }
            throw new Error(message)
        }
        const body = await res.json()
        if (body?.data) patchApplication(id, body.data)
    }

    /**
     * Delete one application. Throws on failure so the dialog stays open and
     * says so — removing the card first would show a delete that didn't happen.
     *
     * A 404 counts as done: the row is already gone (another tab), or never
     * existed (an analysis that failed before writing it), and either way the
     * card has nothing left to point at.
     */
    async function handleDeleteApplication(id) {
        const res = await appRequest(`/job-application?id=${encodeURIComponent(id)}`, "DELETE")
        if (!res.ok && res.status !== 404) {
            let message = `Delete failed (${res.status})`
            try { message = (await res.json()).message ?? message } catch { /* no body */ }
            throw new Error(message)
        }
        setApplications(prev => prev.filter(a => a.id !== id))
        // The server unlinked any lead it came from (ON DELETE SET NULL);
        // mirror that here rather than spend a request re-reading the panel.
        setLeads(prev => (prev
            ? { ...prev, leads: prev.leads.map(l => (l.applicationId === id ? { ...l, applicationId: null } : l)) }
            : prev))
    }

    /** The AI panel's contents. Fetched on open; see AiStatusDialog. */
    async function loadAiStatus() {
        const res = await appRequest("/ai-status", "GET")
        if (!res.ok) {
            let message = `Could not load your AI settings (${res.status})`
            try { message = (await res.json()).message ?? message } catch { /* no body */ }
            throw new Error(message)
        }
        return res.json()
    }

    // handle reviewed dump
    async function handleReviewComplete(finalDump, answered = []) {
        // Answers ride on the dump rather than beside it, so they are saved,
        // cached and recovered with the profile they belong to. They used to
        // live in React state and vanish on the next reload.
        const answers = answered.filter(q => q.answer?.trim())
        try {
            await handleSaveDump({ ...finalDump, answers }, { finalized: true })
        } catch (err) {
            // The dashboard is still usable with what's in memory; the dump
            // just isn't persisted yet and the review will reappear on reload.
            console.error("Could not persist the finalized dump", err)
            setResumeDump({ ...finalDump, answers })
        }
        setView('dashboard')

        // The first listing search starts by itself once the profile is
        // finalized — in the background, after the dashboard is up, so an
        // application can be started while it runs. Not awaited.
        kickoffFirstSearch()
    }

    /* ── Listings ───────────────────────────────────────────── */

    async function kickoffFirstSearch() {
        const state = await fetchLeadState()
        if (!state) return
        setLeads(state)
        // The server skips an automatic run that has already happened, but
        // checking here too saves a background invocation and a 45-second
        // wait to discover it. No key means nothing to run; the panel asks.
        if (state.hasKey && !state.run?.hasRun && !state.run?.running) {
            startLeadSearch(state.run?.startedAt ?? null, { auto: true })
        }
    }

    /**
     * Starts a search and watches it without blocking anything.
     *
     * `before` is passed in rather than read from state: kickoffFirstSearch
     * calls this in the same tick as it sets that state, so reading `leads`
     * here would see the value from before the fetch.
     */
    async function startLeadSearch(before, { auto = false } = {}) {
        setLeadsError(null)
        // Show it running now rather than after the first poll — three seconds
        // of a button that did nothing reads as a click that didn't register.
        // startedAt is cleared because until the server reports our run it
        // still holds the previous one's, and the progress timer would count
        // from then. The watch compares against `before`, not this.
        setLeads(prev => (prev ? { ...prev, run: { ...prev.run, running: true, startedAt: null } } : prev))

        try {
            const res = await appRequest("/job-search-background", "POST", null, { auto })
            if (!res.ok) throw new Error(`Search request failed (${res.status})`)
        } catch (err) {
            setLeadsError(err.message)
            setLeads(prev => (prev ? { ...prev, run: { ...prev.run, running: false } } : prev))
            return
        }

        // Until the server shows our run, it is still reporting the previous
        // one — finished — and taking that at face value would flip the button
        // back to enabled for the first few seconds of a search.
        const result = await watchLeadSearch(before, next => {
            const ours = Boolean(next.run?.startedAt) && next.run.startedAt !== before
            setLeads(ours ? next : { ...next, run: { ...next.run, running: true, startedAt: null } })
        })
        if (!result) {
            setLeadsError("The search is taking longer than usual. It will keep going — check back in a few minutes.")
            return
        }
        if (result.outcome === 'skipped') {
            // Put the displayed state back; the optimistic "running" was ours.
            setLeads({ ...result.state, run: { ...result.state.run, running: false } })
            if (!auto) setLeadsError("The search didn't start. Check your job titles and Perplexity key in Preferences.")
        }
    }

    async function handleSearchLeads() {
        // No titles means nothing to search for — the server would skip it
        // after a 45-second wait. Go straight to the form instead.
        if (!leads?.preferences?.titles?.length) return handleOpenLeadsForm()
        startLeadSearch(leads.run?.startedAt ?? null, { auto: false })
    }

    async function handleOpenLeadsForm() {
        setLeadsError(null)
        try {
            const res = await appRequest("/job-search?form=1", "GET")
            if (!res.ok) throw new Error(`Could not load preferences (${res.status})`)
            const body = await res.json()
            setLeadsForm({ preferences: body.preferences, seeded: Boolean(body.seeded) })
        } catch (err) {
            setLeadsError(err.message)
        }
    }

    /** Throws on failure so the form stays open with the user's input. */
    async function handleSaveLeadPreferences(preferences, searchKey) {
        const res = await appRequest("/job-search", "PUT", null, {
            preferences,
            ...(searchKey ? { searchKey } : {}),
        })
        if (!res.ok) {
            let message = `Save failed (${res.status})`
            try { message = (await res.json()).message ?? message } catch { /* no body */ }
            throw new Error(message)
        }
        const body = await res.json()
        setLeads(prev => ({
            leads: prev?.leads ?? [],
            ...prev,
            preferences: body.preferences,
            run: body.run,
            hasKey: body.hasKey,
            loaded: true,
        }))
        setLeadsForm(null)

        // The first search the user was promised. Finishing onboarding without
        // a key means it couldn't run then; saving one is when it can.
        if (body.hasKey && !body.run?.hasRun && !body.run?.running) {
            startLeadSearch(body.run?.startedAt ?? null, { auto: true })
        }
    }

    async function handleDismissLead(id) {
        try {
            const res = await appRequest(`/job-search?dismiss=${encodeURIComponent(id)}`, "PUT", null, {})
            if (!res.ok) throw new Error(`Could not dismiss (${res.status})`)
            setLeads(prev => (prev ? { ...prev, leads: prev.leads.filter(l => l.id !== id) } : prev))
        } catch (err) {
            setLeadsError(err.message)
        }
    }

    function patchApplication(id, patch) {
        setApplications(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
    }

    /**
     * Create a job application. The row id is generated here so the UI can show
     * the application immediately and poll for exactly that row while the
     * background function runs the model.
     */
    function handleCreateApplication(input) {
        const id = makeId()
        const application = {
            id,
            createdAt: new Date().toISOString(),
            ...input,          // { jobDescription, notes, questions }
            response:  null,   // filled in once the analysis row exists
            error:     null,
        }
        setApplications(prev => [application, ...prev])

        // fire and forget; state updates land through patchApplication
        runApplicationAnalysis(id, input)
        return application
    }

    async function runApplicationAnalysis(id, input) {
        try {
            const res = await appRequest("/job-application-background", "POST", null, { id, ...input, provider })
            // Background functions answer 202 before running; anything else is a
            // synchronous rejection (auth, validation, no API key).
            if (!res.ok) {
                let message = `Request failed (${res.status})`
                try { message = (await res.json()).message ?? message } catch { /* no body */ }
                throw new Error(message)
            }

            // Poll until the row exists, backing off as it drags on (5 min budget).
            const ready = await pollUntil(APPLICATION_POLL_BUDGET_MS, async () => {
                const poll = await appRequest(`/job-application?id=${encodeURIComponent(id)}`, "GET")
                if (!poll.ok) return undefined
                const result = await poll.json()
                return (result?.ready && result.data) ? result.data : undefined
            })

            if (ready) {
                patchApplication(id, { ...ready, error: null })
                // Started from a listing: the server linked the lead once the
                // row existed, so re-read the panel to mark it started.
                if (input.leadId) fetchLeadState().then(state => { if (state) setLeads(state) })
                return
            }
            throw new Error("Timed out waiting for the analysis. It may still finish; reload to check.")
        } catch (err) {
            console.error("Job application analysis failed", err)
            patchApplication(id, { error: err.message })
        }
    }

    if (view === 'loading') {
        return <div className="placeholder">Loading your profile…</div>
    }

    if (view === 'denied') {
        return (
            <div className="gate">
                <h1 className="gate-title">You're signed in, but not invited</h1>
                <p className="gate-body">
                    This deployment is limited to a few accounts while it's running on
                    the owner's infrastructure. Nothing is wrong with your account
                    {user?.email ? <> — <code>{user.email}</code> just isn't on the list</> : null}.
                </p>
                <p className="gate-body">
                    The source is on{' '}
                    <a href="https://github.com/jaredyankee/cv-master" target="_blank" rel="noreferrer">GitHub</a>
                    {' '}if you'd like to run your own.
                </p>
                <button type="button" className="btn" onClick={onSignOut}>Sign out</button>
            </div>
        )
    }

    if (view === 'review' && onboardingResponse) {
        return (
            <DumpReview
                response={onboardingResponse}
                onComplete={handleReviewComplete}
                onBack={() => setView('onboarding')}
                onRegenerate={hasDump ? handleRegenerate : null}
                error={dumpError}
            />
        )
    }

    if (view === 'dashboard' && hasDump && resumeDump) {
        return (
            <Dashboard
                resumeDump={resumeDump}
                answeredQuestions={resumeDump?.answers ?? []}
                applications={applications}
                onCreateApplication={handleCreateApplication}
                onEditProfile={() => setView(onboardingResponse ? 'review' : 'onboarding')}
                onSaveDump={handleSaveDump}
                onSaveResume={handleSaveResume}
                statuses={statuses}
                onSetStatus={handleSetStatus}
                onDeleteApplication={handleDeleteApplication}
                provider={provider}
                hasProviderKey={configuredProviders.includes(provider)}
                onLoadAiStatus={loadAiStatus}
                leads={leads}
                leadsForm={leadsForm}
                leadsError={leadsError}
                onOpenLeadsForm={handleOpenLeadsForm}
                onCloseLeadsForm={() => setLeadsForm(null)}
                onSaveLeadPreferences={handleSaveLeadPreferences}
                onSearchLeads={handleSearchLeads}
                onDismissLead={handleDismissLead}
                user={user}
                onSignOut={onSignOut}
                dumpState={dumpState}
                cached={cached}
                hasSourceText={Boolean(sourceText)}
                error={dumpError}
                onRegenerate={handleRegenerate}
                onRecoverCache={handleRecoverCache}
                onClearCache={handleClearCache}
                onResumeRegeneration={() => setView('onboarding')}
            />
        )
    }

    return (
        <OnboardingForm
            onSubmit={handleDumpSubmit}
            isLoading={isLoading}
            hasSearchKey={leads?.hasKey ?? false}
            mode={hasDump ? dumpState : 'FIRST'}
            initialText={dumpState === 'REVISE' ? sourceText : ''}
            provider={provider}
            configuredProviders={configuredProviders}
            error={dumpError}
            onBack={hasDump ? () => setView('dashboard') : null}
            onSignOut={onSignOut}
            feedback={reviseFeedback}
            isDone={isDone}
            onToggleDone={toggleDone}
        />
    )
}

function App () {
    const session = authClient.useSession()          // { data, isPending, error }
    const user    = session.data?.user ?? null

    async function handleSignOut() {
        try { await authClient.signOut() }
        catch (err) { console.error("Sign out failed", err) }
    }

    if (!AUTH_CONFIGURED) {
        return (
            <div className="placeholder">
                Sign-in isn't configured: set VITE_NEON_AUTH_URL to your Neon Auth base URL and rebuild.
            </div>
        )
    }

    if (session.isPending) {
        return <div className="placeholder">Loading…</div>
    }

    if (!user) {
        return <AuthForm />
    }

    return <Workspace key={user.id} user={user} onSignOut={handleSignOut} />
}

export default App;
