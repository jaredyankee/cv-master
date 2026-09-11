import { useState } from 'react'
import Modal from '../common/Modal'

/**
 * The "are you sure" for rebuilding a profile, and the choice of how.
 *
 * Two ways in, matching the two ways people arrive at wanting this: the text
 * you wrote was wrong (Revise) or the profile that came out of it was wrong
 * (Start over). Both clear the live profile, so both need the same warning.
 *
 * Props:
 *   onConfirm(mode)  — 'NEW' | 'REVISE'
 *   onCancel()
 *   hasSourceText:   boolean — false for profiles created before the text was
 *                    stored, which makes Revise nothing to revise
 *   applicationCount: number — named in the warning so the guarantee that they
 *                    survive is concrete rather than a promise
 */
export default function RegenerateDialog({ onConfirm, onCancel, hasSourceText, applicationCount = 0 }) {
    const [busy, setBusy] = useState(null)   // the mode being started

    async function choose(mode) {
        setBusy(mode)
        try {
            await onConfirm?.(mode)
        } finally {
            setBusy(null)
        }
    }

    return (
        <Modal title="Rebuild your profile" onClose={busy ? undefined : onCancel}>
            <div className="alert alert-flag regen-warning">
                <strong>Your current profile will be cleared.</strong> It is kept as a
                cached copy on the dashboard, so you can look at it or put it back until
                you delete it.
            </div>

            <p className="regen-keeps">
                {applicationCount > 0
                    ? `Your ${applicationCount} built resume${applicationCount === 1 ? '' : 's'} and ${applicationCount === 1 ? 'its' : 'their'} fit analysis stay exactly as ${applicationCount === 1 ? 'it is' : 'they are'}.`
                    : 'Built resumes are never affected by this.'}
            </p>

            <div className="regen-options">
                <button
                    type="button"
                    className="regen-option"
                    onClick={() => choose('REVISE')}
                    disabled={!hasSourceText || Boolean(busy)}
                >
                    <span className="regen-option-title">
                        {busy === 'REVISE' ? 'Starting…' : 'Revise what you wrote'}
                    </span>
                    <span className="regen-option-body">
                        {hasSourceText
                            ? 'Opens the dump form with your original text, ready to edit and resubmit.'
                            : 'Not available — this profile was created before the original text was kept.'}
                    </span>
                </button>

                <button
                    type="button"
                    className="regen-option"
                    onClick={() => choose('NEW')}
                    disabled={Boolean(busy)}
                >
                    <span className="regen-option-title">
                        {busy === 'NEW' ? 'Starting…' : 'Start over'}
                    </span>
                    <span className="regen-option-body">
                        Opens an empty dump form. Write your profile again from scratch.
                    </span>
                </button>
            </div>
        </Modal>
    )
}
