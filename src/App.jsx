import { appRequest } from "./api"
import { useState } from "react"
import DumpReview from "./components/Onboarding/DumpReview"
import OnboardingForm from "./components/Onboarding/OnboardingForm"
function App () {
    const [view, setView]                     = useState('onboarding')
    const [onboardingResponse, setResponse]   = useState(null)
    const [resumeDump, setResumeDump]         = useState(null)  // finalized dump
    const [isLoading, setIsLoading]           = useState(false)
    

    async function handleDumpSubmit(dumpText, apiKey) {
        setIsLoading(true)
        try {
            // DEV: mock — remove and wire up API call
            const response = await appRequest("/resume-dump", "POST", {
                'X-Api-Key': apiKey
            }, {
                resume_demp: dumpText
            });
            setOnboardingResponse(response);
            setView('review')
        } catch (err) {
            console.error("Error on dump request")
        } finally {
            setIsLoading(false)
        }
    }

    // handle reviewed dump 
    function handleReviewComplete(finalDump, answeredQuestions) {
        setResumeDump(finalDump)
        setView('dashboard')
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

    if (view === 'dashboard') {
        // @todo: Dashboard component
        return <div className="placeholder">Dashboard coming soon.</div>
    }

    return (
        <OnboardingForm
            onSubmit={handleDumpSubmit}
            isLoading={isLoading}
        />
    )
}

export default App;