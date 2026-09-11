// DumpReview.jsx
import { useState } from 'react'
import CopyButton from '../common/CopyButton'
import { buildRevisionPrompt, isLongEnough, requiredLength } from '../../lib/revisionPrompt'
import './DumpReview.css'

/**
 * Recursively replaces the first occurrence of `original` with `replacement`
 * across all string values in a dump object. Used to apply accepted revisions.
 */
function applyRevision(obj, original, replacement) {
    if (typeof obj === 'string') {
        return obj.includes(original) ? obj.replace(original, replacement) : obj
    }
    if (Array.isArray(obj)) {
        return obj.map(item => applyRevision(item, original, replacement))
    }
    if (obj && typeof obj === 'object') {
        const result = {}
        for (const [k, v] of Object.entries(obj)) {
            result[k] = applyRevision(v, original, replacement)
        }
        return result
    }
    return obj
}

/**
 * Step 2 of onboarding — the user reviews AI revisions and answers questions.
 *
 * Props:
 *   response:   OnboardingResponse — { resume_dump, revisions, questions }
 *   onComplete(finalDump, answeredQuestions) — called on "Finalize Profile"
 *   onBack()    — return to the onboarding form
 */
export default function DumpReview ({ response, onComplete, onBack }) {
    const { resume_dump, revisions = [], questions = [] } = response;

    // The rewrite the user types for each revision. Starts empty — the model's
    // suggestion is the textarea's placeholder, so what lands in the dump is
    // something the user actually wrote.
    const [editedTexts, setEditedTexts] = useState(() => revisions.map(() => ''))
    // indices of revisions the user has accepted
    const [accepted, setAccepted] = useState(new Set())
    // live copy of the dump — updated as revisions are accepted
    const [currentDump, setCurrentDump] = useState(resume_dump)
    // user's answers to each question
    const [answers, setAnswers] = useState(() => questions.map(() => ''))

    function handleEdit(i, value) {
        setEditedTexts(prev => {
            const next = [...prev]
            next[i] = value
            return next
        })
    }

    function handleAccept(i) {
        const { original } = revisions[i]
        const replacement  = editedTexts[i].trim()
        // Accepting an empty box would delete the original line from the dump.
        if (!replacement) return
        setCurrentDump(prev => applyRevision(prev, original, replacement))
        setAccepted(prev => new Set([...prev, i]))
    }

    function handleAnswer(i, value) {
        setAnswers(prev => {
            const next = [...prev]
            next[i] = value
            return next
        })
    }

    function handleFinalize() {
        const answeredQuestions = questions.map((q, i) => ({
            question:  q.question,
            reference: q.reference ?? null,
            answer:    answers[i],
        }))
        onComplete(currentDump, answeredQuestions)
    }

    const totalItems = revisions.length + questions.length

    return (
        <div className="review">

            <div className="review-header">
            <button type="button" className="back-btn" onClick={onBack}>
                <span aria-hidden="true">←</span> Back
            </button>
            <h2 className="review-title">Review Your Profile</h2>
            <p className="review-subtitle">
                {totalItems > 0
                ? `${revisions.length} revision${revisions.length !== 1 ? 's' : ''} and ${questions.length} question${questions.length !== 1 ? 's' : ''} to address. All optional — skip anything that doesn't apply.`
                : 'Everything looks good. Ready to finalize.'}
            </p>
            </div>

            {revisions.length > 0 && (
                <section className="review-section">
                    <p className="section-label">Revisions ({revisions.length})</p>

                    {revisions.map((revision, i) => {
                    const written   = editedTexts[i].trim().length
                    const needed    = requiredLength(revision.original)
                    const reviewable = isLongEnough(editedTexts[i], revision.original)

                    return (
                    <div
                        key={i}
                        className={`revision-card${accepted.has(i) ? ' is-accepted' : ''}`}
                    >
                        {/* original text — highlighted, uneditable */}
                        <div className="revision-original">{revision.original}</div>

                        {/* AI note / reasoning */}
                        <div className="revision-note">{revision.note}</div>

                        {/* the user's rewrite, or the accepted state */}
                        <div className="revision-body">
                        {accepted.has(i) ? (
                            <span className="accepted-badge">✓ Accepted</span>
                        ) : (
                            <>
                            <textarea
                                className="revision-textarea"
                                value={editedTexts[i]}
                                onChange={e => handleEdit(i, e.target.value)}
                                placeholder={revision.suggested_edit}
                                aria-label="Your rewrite"
                                rows={3}
                            />
                            <div className="revision-actions">
                                <div className="revision-actions-left">
                                    <CopyButton
                                        label="Copy for review"
                                        copiedLabel="Copied"
                                        disabled={!reviewable}
                                        title={reviewable
                                            ? 'Copies the original, the note, and your rewrite as a review prompt'
                                            : 'Write your rewrite first'}
                                        text={() => buildRevisionPrompt(revision, editedTexts[i])}
                                    />
                                    {!reviewable && needed > 0 && (
                                        <span className="revision-progress">
                                            {written}/{needed}
                                        </span>
                                    )}
                                </div>
                                <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => handleAccept(i)}
                                disabled={written === 0}
                                >
                                Accept
                                </button>
                            </div>
                            {revision.suggested_edit && written === 0 && (
                                <button
                                    type="button"
                                    className="revision-use-suggestion"
                                    onClick={() => handleEdit(i, revision.suggested_edit)}
                                >
                                    Start from the suggestion
                                </button>
                            )}
                            </>
                        )}
                        </div>
                    </div>
                    )
                    })}
                </section>
            )}

            {questions.length > 0 && (
                <section className="review-section">
                    <p className="section-label">Questions ({questions.length})</p>

                    {questions.map((q, i) => (
                        <div key={i} className="question-card">
                            <div className="question-text">{q.question}</div>

                            {q.reference && (
                                <div className="question-reference">{q.reference}</div>
                            )}

                            <div className="question-body">
                            <textarea
                                className="question-textarea"
                                value={answers[i]}
                                onChange={e => handleAnswer(i, e.target.value)}
                                placeholder="Your answer… (optional)"
                                rows={3}
                            />
                            </div>
                        </div>
                    ))}
                </section>
            )}

            <div className="review-footer">
                <button type="button" className="btn btn-primary" onClick={handleFinalize}>
                    Finalize profile
                </button>
            </div>

        </div>
    )
}