// DumpReview.jsx
import { useState } from 'react'
import CopyButton from '../common/CopyButton'
import { resolveTarget, composeAnswer, applyPlacement } from '../../lib/answerPlacement'
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
 *   onRegenerate(mode) — optional; 'NEW' | 'REVISE'. The escape hatch for an
 *               extraction that came out wrong: rebuild rather than hand-fix
 *               a profile that missed the point.
 *   error:      string | null
 */
export default function DumpReview ({ response, onComplete, onBack, onRegenerate, error = null }) {
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
    // The composed text for a question whose answer has a home: existing field
    // + the answer, editable before it is accepted. Null until they type.
    const [placements, setPlacements] = useState(() => questions.map(() => null))
    // indices of questions whose answer has been placed into the dump
    const [placed, setPlaced] = useState(new Set())

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
        // Re-compose the preview as they type, but only while they haven't
        // touched it — once they edit the composed text it is theirs to own.
        setPlacements(prev => {
            if (placed.has(i)) return prev
            const target = resolveTarget(currentDump, questions[i].target)
            if (!target) return prev
            const next = [...prev]
            next[i] = composeAnswer(target.current, value)
            return next
        })
    }

    function handleEditPlacement(i, value) {
        setPlacements(prev => {
            const next = [...prev]
            next[i] = value
            return next
        })
    }

    /** Writes the composed text into the section the question pointed at. */
    function handlePlace(i) {
        const target = resolveTarget(currentDump, questions[i].target)
        const textToWrite = (placements[i] ?? '').trim()
        if (!target || !textToWrite) return
        setCurrentDump(prev => applyPlacement(prev, resolveTarget(prev, questions[i].target), textToWrite))
        setPlaced(prev => new Set([...prev, i]))
    }

    function handleFinalize() {
        const answeredQuestions = questions.map((q, i) => ({
            question:  q.question,
            reference: q.reference ?? null,
            answer:    answers[i],
            // Where it went, for the record — and so the dashboard knows not to
            // show a placed answer again as a loose note.
            section:   resolveTarget(currentDump, q.target)?.label ?? '',
            placed:    placed.has(i),
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
                        <QuestionCard
                            key={i}
                            question={q}
                            answer={answers[i]}
                            onAnswer={v => handleAnswer(i, v)}
                            target={resolveTarget(currentDump, q.target)}
                            placement={placements[i]}
                            onEditPlacement={v => handleEditPlacement(i, v)}
                            onPlace={() => handlePlace(i)}
                            isPlaced={placed.has(i)}
                        />
                    ))}
                </section>
            )}

            {error && (
                <div className="alert alert-error" role="alert">
                    <strong>That didn't work.</strong> {error}
                </div>
            )}

            <div className="review-footer">
                {onRegenerate && (
                    <div className="review-redo">
                        <span className="review-redo-label">Not what you meant?</span>
                        <button
                            type="button"
                            className="link-btn"
                            onClick={() => onRegenerate('REVISE')}
                        >
                            Revise full dump
                        </button>
                        <button
                            type="button"
                            className="link-btn"
                            onClick={() => onRegenerate('NEW')}
                        >
                            Start over
                        </button>
                    </div>
                )}
                <button type="button" className="btn btn-primary" onClick={handleFinalize}>
                    Finalize profile
                </button>
            </div>

        </div>
    )
}
/**
 * One probe question, and what becomes of the answer.
 *
 * The point of the card is that answering is not a shout into the void: the
 * question states where its answer is headed before you type, and once you
 * type you see the section as it would read, editable, with an Accept that
 * puts it there. An answer with nowhere to go says so instead of pretending.
 */
function QuestionCard({
    question, answer, onAnswer,
    target, placement, onEditPlacement, onPlace, isPlaced,
}) {
    return (
        <div className={`question-card${isPlaced ? ' is-placed' : ''}`}>
            <div className="question-text">{question.question}</div>

            {question.reference && (
                <div className="question-reference">{question.reference}</div>
            )}

            <div className="question-destination">
                {target
                    ? <>Your answer extends <strong>{target.label}</strong></>
                    : <>Kept as context for job fit — this one doesn&rsquo;t belong to a section</>}
            </div>

            <div className="question-body">
                {/* Placed, the card is done: the text is in the section now, and
                    leaving the raw answer on screen above the badge reads as if
                    that were what landed — it isn't, they edited it first. Same
                    collapse an accepted revision does. */}
                {isPlaced ? (
                    <span className="accepted-badge">✓ Added to {target?.label}</span>
                ) : (
                    <textarea
                        className="question-textarea"
                        value={answer}
                        onChange={e => onAnswer(e.target.value)}
                        placeholder="Your answer… (optional)"
                        rows={3}
                    />
                )}

                {!isPlaced && target && answer.trim() && (
                    <div className="placement">
                        <p className="section-label">{target.label} will read</p>
                        <textarea
                            className="revision-textarea"
                            value={placement ?? ''}
                            onChange={e => onEditPlacement(e.target.value)}
                            aria-label={`${target.label} after your answer`}
                            rows={4}
                        />
                        <div className="placement-actions">
                            <span className="placement-note">
                                Every word here is yours — edit it before adding.
                            </span>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={onPlace}
                                disabled={!(placement ?? '').trim()}
                            >
                                Add to {target.label.split(' · ')[0]}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
