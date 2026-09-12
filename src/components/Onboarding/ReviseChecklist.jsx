import CopyButton from '../common/CopyButton'
import { buildQuestionPrompt, buildChecklistPrompt } from '../../lib/revisionPrompt'
import './ReviseChecklist.css'

/**
 * The review's feedback, sitting beside the rebuild form as a worklist.
 *
 * Revising means rewriting the text the profile was built from, and the only
 * reason to do that is the points the review raised — so they belong next to
 * the box, not on a screen you left behind. Ticking an item collapses it to a
 * single line, so the list shrinks as the work gets done rather than staying
 * the same wall of text it started as.
 *
 * Ticks live in App state, which means they survive stepping out to the
 * dashboard and back. They do not survive a reload; the list is a working aid
 * for one sitting, not a record.
 *
 * Props:
 *   feedback:   { revisions: [], questions: [] }
 *   isDone(kind, index) -> boolean
 *   onToggle(kind, index)
 */
export default function ReviseChecklist({ feedback, isDone, onToggle }) {
    const revisions = feedback?.revisions ?? []
    const questions = feedback?.questions ?? []
    const total = revisions.length + questions.length
    if (total === 0) return null

    const doneCount =
        revisions.filter((_, i) => isDone('revision', i)).length +
        questions.filter((_, i) => isDone('question', i)).length

    return (
        <aside className="checklist" aria-label="Points from the review">
            <div className="checklist-head">
                <h2 className="checklist-title">
                    From the review
                    <span className="count">{doneCount}/{total}</span>
                </h2>
                <CopyButton
                    label="Copy all"
                    copiedLabel="Copied"
                    disabled={doneCount === total}
                    title={doneCount === total
                        ? 'Everything is ticked off'
                        : 'Copies every point you have not ticked off yet'}
                    text={() => buildChecklistPrompt(feedback, isDone)}
                />
            </div>

            <p className="checklist-intro">
                What the review flagged last time. Tick each one off as you work it
                into the text — nothing here is submitted, it is just a list.
            </p>

            {revisions.length > 0 && (
                <section className="checklist-group">
                    <p className="section-label">Passages flagged ({revisions.length})</p>
                    {revisions.map((r, i) => (
                        <Item
                            key={i}
                            done={isDone('revision', i)}
                            onToggle={() => onToggle('revision', i)}
                            summary={r.original}
                        >
                            <p className="checklist-note">{r.note}</p>
                            {r.suggested_edit && (
                                <p className="checklist-suggestion">{r.suggested_edit}</p>
                            )}
                        </Item>
                    ))}
                </section>
            )}

            {questions.length > 0 && (
                <section className="checklist-group">
                    <p className="section-label">Questions ({questions.length})</p>
                    {questions.map((q, i) => (
                        <Item
                            key={i}
                            done={isDone('question', i)}
                            onToggle={() => onToggle('question', i)}
                            summary={q.question}
                            action={
                                <CopyButton
                                    label="Copy"
                                    copiedLabel="Copied"
                                    title="Copies the question, and the passage it was asked about"
                                    text={() => buildQuestionPrompt(q)}
                                />
                            }
                        >
                            {q.reference && (
                                <p className="checklist-reference">{q.reference}</p>
                            )}
                        </Item>
                    ))}
                </section>
            )}
        </aside>
    )
}

/**
 * One tickable point. Ticked, it collapses to its summary line — the detail is
 * only useful while the item is still outstanding.
 */
function Item({ done, onToggle, summary, action, children }) {
    return (
        <div className={`checklist-item${done ? ' is-done' : ''}`}>
            <label className="checklist-line">
                <input
                    type="checkbox"
                    className="checklist-check"
                    checked={done}
                    onChange={onToggle}
                />
                <span className="checklist-summary">{summary}</span>
            </label>
            {!done && (children || action) && (
                <div className="checklist-detail">
                    {children}
                    {action && <div className="checklist-actions">{action}</div>}
                </div>
            )}
        </div>
    )
}
