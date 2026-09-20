import { useState } from 'react'
import Progress from '../common/Progress'
import ReviseChecklist from './ReviseChecklist'
import { PROVIDERS, DEFAULT_PROVIDER, providerInfo } from '../../lib/providers'
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
 *   onSubmit(dumpText, apiKey, provider) — apiKey is '' when one is already
 *              stored for that provider, which tells the server to use it
 *   isLoading:   boolean
 *   mode:        'FIRST' | 'NEW' | 'REVISE'
 *   initialText: string — prefill, for REVISE
 *   provider:    the user's stored provider choice
 *   configuredProviders: string[] — providers this user already has a key for
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
  provider: initialProvider = DEFAULT_PROVIDER,
  configuredProviders = [],
  error = null,
  onBack,
  feedback = null,
  isDone,
  onToggleDone,
}) {
  const [dumpText, setDumpText] = useState(initialText)
  const [apiKey, setApiKey]     = useState('')
  const [provider, setProvider] = useState(initialProvider || DEFAULT_PROVIDER)
  const [showKey, setShowKey]   = useState(false)
  const [startedAt, setStartedAt] = useState(null)

  const copy = COPY[mode] ?? COPY.FIRST
  const info = providerInfo(provider)
  // Per provider: a key on file for *this* one makes the field an override.
  // Switching to a provider you have never used asks for its key.
  const hasStoredKey = configuredProviders.includes(provider)
  const keyReady = hasStoredKey || apiKey.trim().length > 0
  const canSubmit = dumpText.trim().length > 0 && keyReady && !isLoading

  function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setStartedAt(Date.now())
    onSubmit(dumpText, apiKey.trim(), provider)
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
            <label htmlFor="provider" className="field-label">
              Model provider
            </label>
            <div className="provider-row" role="radiogroup" aria-label="Model provider">
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={provider === p.id}
                  className={`provider-option${provider === p.id ? ' is-active' : ''}`}
                  onClick={() => setProvider(p.id)}
                >
                  {p.label}
                  {configuredProviders.includes(p.id) && (
                    <span className="provider-saved" title="You have a key on file for this provider">key saved</span>
                  )}
                </button>
              ))}
            </div>
            <span className="field-hint small">
              Your key goes to the provider you pick and nowhere else. Switching
              providers keeps any key you have already given for the others.
            </span>
          </div>

          <div className="field">
            <label htmlFor="apiKey" className="field-label">
              {info.label} API key
              {hasStoredKey && <span className="field-optional">Optional</span>}
            </label>
            <div className="api-key-row">
              <input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                className="api-key-input"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={hasStoredKey ? `Using your saved ${info.label} key` : info.placeholder}
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
              {hasStoredKey
                ? `Your saved ${info.label} key is used unless you enter a different one. Stored encrypted, never logged.`
                : <>Stored encrypted. Never logged. Get one from{' '}
                    <a href={info.keysUrl} target="_blank" rel="noreferrer">{info.keysLabel}</a>.</>}
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
