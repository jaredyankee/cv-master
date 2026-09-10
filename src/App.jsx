import { appRequest } from "./api"
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

const sleep = ms => new Promise(res => setTimeout(res, ms))

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

    // On mount: load the dump (skip onboarding if it exists) and the user's
    // applications. The user is identified by the bearer token appRequest attaches.
    useEffect(() => {
        let cancelled = false

        async function loadWorkspace() {
            try {
                const res = await appRequest("/resume-dump", "GET")
                const result = res.ok ? await res.json() : null
                if (cancelled) return

                if (!(result?.exists && result.data?.resume_dump)) {
                    setView('onboarding')
                    return
                }

                const { resume_dump, revisions = [], questions = [] } = result.data
                setResumeDump(resume_dump)
                // keep the review payload so "Edit profile" can reopen it
                setOnboardingResponse({ resume_dump, revisions, questions })

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
        try {
            // Kick off background AI processing (returns 202 immediately)
            await appRequest("/resume-dump-background", "POST", {
                'X-Api-Key': apiKey
            }, {
                resume_dump: dumpText
            });

            // Poll until AI processing completes (3 s interval, 3 min max)
            const MAX_POLLS = 60;
            for (let i = 0; i < MAX_POLLS; i++) {
                await sleep(3000);
                const res = await appRequest("/resume-dump?ping=true", "GET");
                const result = await res.json();
                if (result?.ready) {
                    setResumeDump(result.data?.resume_dump);
                    setOnboardingResponse(result.data);
                    setView('review');
                    return;
                }
            }
            throw new Error("Timed out waiting for AI response");
        } catch (err) {
            console.error("Error on dump request", err)
        } finally {
            setIsLoading(false)
        }
    }

    // handle reviewed dump
    function handleReviewComplete(finalDump, answered = []) {
        setResumeDump(finalDump)
        setAnsweredQuestions(answered.filter(q => q.answer?.trim()))
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

            // Poll until the row exists (3 s interval, 5 min max)
            const MAX_POLLS = 100
            for (let i = 0; i < MAX_POLLS; i++) {
                await sleep(3000)
                const poll = await appRequest(`/job-application?id=${encodeURIComponent(id)}`, "GET")
                if (!poll.ok) continue
                const result = await poll.json()
                if (result?.ready && result.data) {
                    patchApplication(id, { ...result.data, error: null })
                    return
                }
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

    if (view === 'review' && onboardingResponse) {
        return (
            <DumpReview
                response={onboardingResponse}
                onComplete={handleReviewComplete}
                onBack={() => setView('onboarding')}
            />
        )
    }

    if (view === 'dashboard' && resumeDump) {
        return (
            <Dashboard
                resumeDump={resumeDump}
                answeredQuestions={answeredQuestions}
                applications={applications}
                onCreateApplication={handleCreateApplication}
                onEditProfile={() => setView(onboardingResponse ? 'review' : 'onboarding')}
                user={user}
                onSignOut={onSignOut}
            />
        )
    }

    return (
        <OnboardingForm
            onSubmit={handleDumpSubmit}
            isLoading={isLoading}
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
