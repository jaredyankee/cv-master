import { useState } from 'react'
import Progress from '../common/Progress'
import { INGEST_PHRASES } from '../common/phrases'
import './OnboardingForm.css'

/**
 * Step 1 of onboarding — collects the raw resume dump + API key.
 * While the model works, the form is replaced by a live progress panel:
 * a static "Analyzing…" on a call this long reads as a hung page.
 *
 * Props:
 *   onSubmit(dumpText: string, apiKey: string)
 *   isLoading: boolean
 */
export default function OnboardingForm({ onSubmit, isLoading }) {
  const [dumpText, setDumpText] = useState('')
  const [apiKey, setApiKey]     = useState('')
  const [showKey, setShowKey]   = useState(false)
  const [startedAt, setStartedAt] = useState(null)

  const canSubmit = dumpText.trim().length > 0 && apiKey.trim().length > 0 && !isLoading

  function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setStartedAt(Date.now())
    onSubmit(dumpText, apiKey)
  }

  return (
    <div className="onboarding">
      <header className="onboarding-header">
        <h1 className="onboarding-title">CV Master</h1>
        <p className="onboarding-tagline">
          Build tailored resumes from your professional story.
        </p>
      </header>

      {isLoading ? (
        <div className="onboarding-waiting">
          <Progress phrases={INGEST_PHRASES} startedAt={startedAt} />
          <p className="waiting-note">
            Your text is being read and structured. This usually takes under a minute
            and the page updates on its own — no need to resubmit.
          </p>
        </div>
      ) : (
        <form className="onboarding-form" onSubmit={handleSubmit} noValidate>

          <div className="field">
            <label htmlFor="dump" className="field-label">
              Your professional story
            </label>
            <p className="field-hint">
              Write freely about your experience, skills, projects, and what
              you&rsquo;re looking for — or paste an existing resume. Structured or
              unstructured is fine.
            </p>
            <textarea
              id="dump"
              className="dump-textarea"
              value={dumpText}
              onChange={e => setDumpText(e.target.value)}
              placeholder="I've spent the last few years building..."
              rows={14}
            />
            <span className="char-count">
              {dumpText.length.toLocaleString()} characters
            </span>
          </div>

          <div className="field">
            <label htmlFor="apiKey" className="field-label">
              Anthropic API key
            </label>
            <div className="api-key-row">
              <input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                className="api-key-input"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="btn"
                onClick={() => setShowKey(v => !v)}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <span className="field-hint small">
              Stored encrypted. Never logged.
            </span>
          </div>

          <div className="form-footer">
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              Analyze my profile
            </button>
          </div>

        </form>
      )}
    </div>
  )
}
