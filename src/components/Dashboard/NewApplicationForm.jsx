import { useState } from 'react'

let nextRowId = 1
const blankRow = () => ({ id: nextRowId++, text: '', done: false })

/**
 * Create a job application.
 *
 * Fields:
 *   job description  — required
 *   notes            — optional
 *   questions        — one blank row to start. Checking a row's box marks it
 *                      complete (still editable) and reveals a new blank row.
 *
 * Props:
 *   onSubmit({ jobDescription, notes, questions: string[] })
 *   onCancel()
 */
export default function NewApplicationForm({ onSubmit, onCancel }) {
    const [jobDescription, setJobDescription] = useState('')
    const [notes, setNotes]                   = useState('')
    const [rows, setRows]                     = useState(() => [blankRow()])

    const canSubmit = jobDescription.trim().length > 0

    function updateRow(id, patch) {
        setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
    }

    function toggleDone(id) {
        setRows(prev => {
            const next = prev.map(r => r.id === id ? { ...r, done: !r.done } : r)
            const row  = next.find(r => r.id === id)
            const last = next[next.length - 1]
            // completing a row reveals a fresh blank one below (if none exists yet)
            if (row.done && (last.done || last.text.trim())) next.push(blankRow())
            return next
        })
    }

    function removeRow(id) {
        setRows(prev => {
            const next = prev.filter(r => r.id !== id)
            return next.length ? next : [blankRow()]
        })
    }

    function handleSubmit(e) {
        e.preventDefault()
        if (!canSubmit) return
        onSubmit({
            jobDescription: jobDescription.trim(),
            notes:          notes.trim(),
            questions:      rows.map(r => r.text.trim()).filter(Boolean),
        })
    }

    return (
        <form className="app-form" onSubmit={handleSubmit} noValidate>
            <button type="button" className="back-btn" onClick={onCancel}>
                <span aria-hidden="true">←</span> All applications
            </button>

            <div className="panel-head">
                <h2 className="panel-title">New application</h2>
            </div>

            <div className="app-field">
                <label htmlFor="jd" className="app-label">Job description</label>
                <textarea
                    id="jd"
                    className="app-textarea"
                    value={jobDescription}
                    onChange={e => setJobDescription(e.target.value)}
                    placeholder="Paste the full job posting…"
                    rows={12}
                />
                <span className="app-count">{jobDescription.length.toLocaleString()} characters</span>
            </div>

            <div className="app-field">
                <label htmlFor="notes" className="app-label">
                    Notes <span className="app-optional">optional</span>
                </label>
                <p className="app-hint">
                    Anything the AI should know about this role — a referral, salary you saw
                    elsewhere, why you're interested.
                </p>
                <textarea
                    id="notes"
                    className="app-textarea"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={4}
                />
            </div>

            <div className="app-field">
                <span className="app-label">
                    Additional questions <span className="app-optional">optional</span>
                </span>
                <p className="app-hint">
                    Questions the application asks that you'd like answered from your dump.
                    Tick a question when it's complete to add another.
                </p>

                <div className="question-rows">
                    {rows.map((row, i) => (
                        <div key={row.id} className={`question-row${row.done ? ' is-done' : ''}`}>
                            <input
                                type="checkbox"
                                className="question-check"
                                checked={row.done}
                                disabled={!row.text.trim()}
                                onChange={() => toggleDone(row.id)}
                                aria-label={`Mark question ${i + 1} complete`}
                            />
                            <input
                                type="text"
                                className="question-input"
                                value={row.text}
                                onChange={e => updateRow(row.id, { text: e.target.value })}
                                placeholder={i === 0 && rows.length === 1 ? 'e.g. Why do you want to work here?' : 'Another question…'}
                            />
                            {rows.length > 1 && (
                                <button
                                    type="button"
                                    className="question-remove"
                                    onClick={() => removeRow(row.id)}
                                    aria-label={`Remove question ${i + 1}`}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="app-form-footer">
                <button type="button" className="btn" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
                    Assess fit
                </button>
            </div>
        </form>
    )
}
