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

    // On mount: if this user already has a dump, skip onboarding.
    // The user is identified by the bearer token appRequest attaches.
    useEffect(() => {
        let cancelled = false

        async function loadExistingDump() {
            try {
                const res = await appRequest("/resume-dump", "GET")
                const result = res.ok ? await res.json() : null
                if (cancelled) return

                if (result?.exists && result.data?.resume_dump) {
                    const { resume_dump, revisions = [], questions = [] } = result.data
                    setResumeDump(resume_dump)
                    // keep the review payload so "Edit profile" can reopen it
                    setOnboardingResponse({ resume_dump, revisions, questions })
                    setView('dashboard')
                } else {
                    setView('onboarding')
                }
            } catch (err) {
                console.error("Could not check for an existing resume dump", err)
                if (!cancelled) setView('onboarding')
            }
        }

        loadExistingDump()
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
                await new Promise(res => setTimeout(res, 3000));
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

    // @todo POST to a job-application function (resume dump + JD + notes + questions)
    // and store the JobApplicationResponse. Until then applications live in memory.
    function handleCreateApplication(input) {
        const application = {
            id:        makeId(),
            createdAt: new Date().toISOString(),
            ...input,          // { jobDescription, notes, questions }
            response:  null,   // JobApplicationResponse once analyzed
        }
        setApplications(prev => [application, ...prev])
        return application
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
