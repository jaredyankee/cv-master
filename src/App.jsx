import { appRequest } from "./api"
import { pollUntil } from "./lib/poll"
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

/**
 * Everything a signed-in user sees. Mounted with key={user.id}, so signing out
 * or switching accounts unmounts it and all per-user state is dropped.
 */
function Workspace({ user, onSignOut }) {
    const [view, setView]                             = useState('loading') // 'loading' | 'onboarding' | 'review' | 'dashboard'
    const [onboardingResponse, setOnboardingResponse] = useState(null)
    const [resumeDump, setResumeDump]                 = useState(null)  // finalized dump
    const [answeredQuestions, setAnsweredQuestions]   = useState([])
    const [applications, setApplications]             = useState([])    // newest first
    const [isLoading, setIsLoading]                   = useState(false)

    // Dump lifecycle. `hasDump` is the row's existence, which is the only
    // thing that means "this user has dumped before" — a regenerate empties
    // the dump's fields but never deletes the row, so a user mid-regenerate
    // still belongs on the dashboard rather than at the start of onboarding.
    const [hasDump, setHasDump]         = useState(false)
    const [dumpState, setDumpState]     = useState('READY') // 'NEW' | 'REVISE' | 'READY'
    const [cached, setCached]           = useState(null)    // { dump, at } — the previous profile
    const [sourceText, setSourceText]   = useState('')      // what the user typed last time
    const [hasApiKey, setHasApiKey]     = useState(false)
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
                    cached_at = null, has_api_key = false,
                } = result.data

                setHasDump(true)
                setDumpState(dump_state)
                setSourceText(source_text ?? '')
                setCached(cached_dump ? { dump: cached_dump, at: cached_at } : null)
                setHasApiKey(Boolean(has_api_key))
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
                } catch (err) {
                    console.error("Could not load applications", err)
                }

                if (!cancelled) setView('dashboard')
            } catch (err) {
                console.error("Could not check for an existing resume dump", err)
                if (!cancelled) setView('onboarding')
            }
        }

        loadWorkspace()
        return () => { cancelled = true }
    }, [])


    async function handleDumpSubmit(dumpText, apiKey) {
        setIsLoading(true)
        setDumpError(null)
        try {
            // Kick off background AI processing (returns 202 immediately).
            // An empty key means "use the one already on file" — the function
            // falls back to the stored key, so don't send an empty header.
            await appRequest("/resume-dump-background", "POST",
                apiKey ? { 'X-Api-Key': apiKey } : null,
                { resume_dump: dumpText }
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
                setHasApiKey(true);
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
            setAnsweredQuestions([])
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

    // handle reviewed dump
    async function handleReviewComplete(finalDump, answered = []) {
        const answers = answered.filter(q => q.answer?.trim())
        setAnsweredQuestions(answers)
        try {
            await handleSaveDump(finalDump, { finalized: true })
        } catch (err) {
            // The dashboard is still usable with what's in memory; the dump
            // just isn't persisted yet and the review will reappear on reload.
            console.error("Could not persist the finalized dump", err)
            setResumeDump(finalDump)
        }
        setView('dashboard')
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
            const res = await appRequest("/job-application-background", "POST", null, { id, ...input })
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
                answeredQuestions={answeredQuestions}
                applications={applications}
                onCreateApplication={handleCreateApplication}
                onEditProfile={() => setView(onboardingResponse ? 'review' : 'onboarding')}
                onSaveDump={handleSaveDump}
                onSaveResume={handleSaveResume}
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
            mode={hasDump ? dumpState : 'FIRST'}
            initialText={dumpState === 'REVISE' ? sourceText : ''}
            hasApiKey={hasApiKey}
            error={dumpError}
            onBack={hasDump ? () => setView('dashboard') : null}
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
