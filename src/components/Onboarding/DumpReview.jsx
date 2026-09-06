// DumpReview.jsx
import { useState } from 'react'
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

export default function DumpReview () {
    const { resume_dump, revisions = [], questions = [] } = response;

    // editable text for each revision (pre-filled with AI suggestion)
    const [editedTexts, setEditedTexts] = useState(
        () => revisions.map(r => r.suggested_edit)
    )
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
        const replacement  = editedTexts[i]
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
            <button className="back-btn" onClick={onBack}>
                ← Back
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

                    {revisions.map((revision, i) => (
                    <div
                        key={i}
                        className={`revision-card${accepted.has(i) ? ' is-accepted' : ''}`}
                    >
                        {/* original text — highlighted, uneditable */}
                        <div className="revision-original">{revision.original}</div>

                        {/* AI note / reasoning */}
                        <div className="revision-note">{revision.note}</div>

                        {/* editable suggestion or accepted state */}
                        <div className="revision-body">
                        {accepted.has(i) ? (
                            <span className="accepted-badge">✓ Accepted</span>
                        ) : (
                            <>
                            <textarea
                                className="revision-textarea"
                                value={editedTexts[i]}
                                onChange={e => handleEdit(i, e.target.value)}
                                rows={3}
                            />
                            <div className="revision-actions">
                                <button
                                className="accept-btn"
                                onClick={() => handleAccept(i)}
                                >
                                Accept
                                </button>
                            </div>
                            </>
                        )}
                        </div>
                    </div>
                    ))}
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
            <button className="finalize-btn" onClick={handleFinalize}>
                Finalize Profile →
            </button>
            </div>

        </div>
    )
}