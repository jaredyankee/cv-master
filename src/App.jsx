import { appRequest } from "./api"
import { useState } from "react"
import DumpReview from "./components/Onboarding/DumpReview"
import OnboardingForm from "./components/Onboarding/OnboardingForm"
import Dashboard from "./components/Dashboard/Dashboard"
import "./App.css"

const makeId = () =>
    (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

function App () {
    const [view, setView]                             = useState('onboarding')
    const [onboardingResponse, setOnboardingResponse] = useState(null)
    const [resumeDump, setResumeDump]                 = useState(null)  // finalized dump
    const [answeredQuestions, setAnsweredQuestions]   = useState([])
    const [applications, setApplications]             = useState([])    // newest first
    const [isLoading, setIsLoading]                   = useState(false)


    async function handleDumpSubmit(dumpText, apiKey) {
        setIsLoading(true)
        try {
            // Kick off background AI processing (returns 202 immediately)
            await appRequest("/resume-dump-background", "POST", {
                'X-Api-Key': apiKey
            }, {
                user_id: import.meta.env.VITE_TEST_USER_ID,
                resume_dump: dumpText
            });

            // Poll until AI processing completes (3 s interval, 3 min max)
            const userId = import.meta.env.VITE_TEST_USER_ID;
            const MAX_POLLS = 60;
            for (let i = 0; i < MAX_POLLS; i++) {
                await new Promise(res => setTimeout(res, 3000));
                const res = await appRequest(
                    `/resume-dump?ping=true&user_id=${userId}`,
                    "GET"
                );
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

    // views
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

export default App;
