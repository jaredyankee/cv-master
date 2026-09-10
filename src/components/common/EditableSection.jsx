import { useState } from 'react'
import './EditableSection.css'

/**
 * A section that swaps between a read view and a form.
 *
 * Editing works on a draft copy, so Cancel is a true discard and a failed
 * save leaves the user's work on screen to retry rather than dropping it.
 * Only the edited section is submitted at a time, which keeps each save
 * small and the blast radius of a mistake to one section.
 *
 * Props:
 *   label:    section heading
 *   value:    current value (any shape)
 *   onSave:   async (nextValue) => void — may throw to signal failure
 *   view:     (value) => node
 *   edit:     (draft, setDraft) => node
 *   empty:    node shown in place of `view` when `isEmpty(value)`
 *   isEmpty:  (value) => boolean
 *   framed:   wrap the read view in a card
 */
export default function EditableSection({
    label,
    value,
    onSave,
    view,
    edit,
    empty = null,
    isEmpty = () => false,
    framed = false,
    action = null,
}) {
    const [draft, setDraft]     = useState(null)   // non-null while editing
    const [saving, setSaving]   = useState(false)
    const [error, setError]     = useState(null)
    const editing = draft !== null

    function start() {
        setError(null)
        // structuredClone keeps nested arrays from being shared with the
        // live value, so Cancel really does discard.
        setDraft(structuredClone(value ?? null))
    }

    function cancel() {
        setDraft(null)
        setError(null)
    }

    async function save() {
        setSaving(true)
        setError(null)
        try {
            await onSave(draft)
            setDraft(null)
        } catch (err) {
            setError(err?.message || 'Could not save. Try again.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <section className="block editable">
            <div className="block-head">
                <p className="section-label">{label}</p>
                <div className="editable-actions">
                    {!editing && action}
                    {editing ? (
                        <>
                            <button type="button" className="link-btn" onClick={cancel} disabled={saving}>
                                Cancel
                            </button>
                            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </>
                    ) : (
                        <button type="button" className="link-btn" onClick={start}>Edit</button>
                    )}
                </div>
            </div>

            {error && <p className="editable-error" role="alert">{error}</p>}

            {editing
                ? <div className="editable-form">{edit(draft, setDraft)}</div>
                : isEmpty(value)
                    ? (empty && <p className="editable-empty">{empty}</p>)
                    : <div className={framed ? 'editable-view is-framed' : 'editable-view'}>{view(value)}</div>}
        </section>
    )
}
