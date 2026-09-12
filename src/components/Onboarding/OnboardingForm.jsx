import { useState } from 'react'
import Progress from '../common/Progress'
import ReviseChecklist from './ReviseChecklist'
import { INGEST_PHRASES } from '../common/phrases'
import './OnboardingForm.css'

const COPY = {
  FIRST: {
    title: 'CV Master',
    tagline: 'Build tailored resumes from your professional story.',
    submit: 'Analyze my profile',
  },
  NEW: {
    title: 'Start over',
    tagline: 'Write your profile again. Your previous one is cached on the dashboard until you delete it, and your built resumes are untouched.',
    submit: 'Rebuild my profile',
  },
  REVISE: {
    title: 'Revise your profile',
    tagline: 'This is the text your current profile was built from. Edit it and resubmit — your previous profile is cached on the dashboard until you delete it.',
    submit: 'Rebuild my profile',
  },
}

/**
 * Step 1 of onboarding — collects the raw resume dump + API key.
 * While the model works, the form is replaced by a live progress panel:
 * a static "Analyzing…" on a call this long reads as a hung page.
 *
 * Also the rebuild form. A regeneration is the same submit with different
 * framing, and in REVISE mode the box opens on what the user wrote last time.
 *
 * Props:
 *   onSubmit(dumpText: string, apiKey: string) — apiKey is '' when one is
 *              already stored, which tells the server to use that one
 *   isLoading:   boolean
 *   mode:        'FIRST' | 'NEW' | 'REVISE'
 *   initialText: string — prefill, for REVISE
 *   hasApiKey:   boolean — a key is on file, so the field is optional
 *   error:       string | null
 *   onBack():    optional; shown when there is a dashboard to go back to
 *   feedback:    { revisions, questions } — the review's points, shown beside
 *                the box in REVISE mode. They are what the rewrite is *for*,
 *                so they belong here rather than on a screen left behind.
 *   isDone(kind, index) / onToggleDone(kind, index) — the checklist's ticks,
 *                held by the caller so they survive a trip to the dashboard
 */
export default function OnboardingForm({
  onSubmit,
  isLoading,
  mode = 'FIRST',
  initialText = '',
  hasApiKey = false,
  error = null,
  onBack,
  feedback = null,
  isDone,
  onToggleDone,
}) {
  const [dumpText, setDumpText] = useState(initialText)
  const [apiKey, setApiKey]     = useState('')
  const [showKey, setShowKey]   = useState(false)
  const [startedAt, setStartedAt] = useState(null)

  const copy = COPY[mode] ?? COPY.FIRST
  // With a key on file the field is an override, not a requirement.
  const keyReady = hasApiKey || apiKey.trim().length > 0
  const canSubmit = dumpText.trim().length > 0 && keyReady && !isLoading

  function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setStartedAt(Date.now())
    onSubmit(dumpText, apiKey.trim())
  }

  // Only REVISE gets the checklist. Starting over discards the text those
  // points were raised about, so carrying them over would be advice about
  // something that no longer exists.
  const showChecklist =
    mode === 'REVISE' && !isLoading &&
    ((feedback?.revisions?.length ?? 0) + (feedback?.questions?.length ?? 0)) > 0

  return (
    <div className={`onboarding${showChecklist ? ' has-aside' : ''}`}>
      <header className="onboarding-header">
        {onBack && !isLoading && (
          <button type="button" className="back-btn" onClick={onBack}>
            <span aria-hidden="true">←</span> Dashboard
          </button>
        )}
        <h1 className="onboarding-title">{copy.title}</h1>
        <p className="onboarding-tagline">{copy.tagline}</p>
      </header>

      {error && !isLoading && (
        <div className="alert alert-error" role="alert">
          <strong>That didn't work.</strong> {error}
        </div>
      )}

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
              {hasApiKey && <span className="field-optional">Optional</span>}
            </label>
            <div className="api-key-row">
              <input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                className="api-key-input"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={hasApiKey ? 'Using your saved key' : 'sk-ant-...'}
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
              {hasApiKey
                ? 'Your saved key is used unless you enter a different one. Stored encrypted, never logged.'
                : 'Stored encrypted. Never logged.'}
            </span>
          </div>

          <div className="form-footer">
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {copy.submit}
            </button>
          </div>

        </form>
      )}

      {showChecklist && (
        <ReviseChecklist
          feedback={feedback}
          isDone={isDone}
          onToggle={onToggleDone}
        />
      )}
    </div>
  )
}
