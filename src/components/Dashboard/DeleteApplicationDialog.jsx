import { useState } from 'react'
import Modal from '../common/Modal'
import { applicationLabel } from './applicationUtils'

/**
 * The "are you sure" for deleting one application.
 *
 * Names the application and what goes with it, because the row is more than a
 * line in a list: it holds the posting as pasted, the fit analysis, and a
 * built resume that may have been edited by hand. There is no undo.
 *
 * Props:
 *   application:  Application
 *   fromListing:  boolean — it was started from a listing, which will show as
 *                 not applied to again
 *   onConfirm()   async; throws with a message the dialog shows
 *   onCancel()
 */
export default function DeleteApplicationDialog({ application, fromListing = false, onConfirm, onCancel }) {
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(null)

    async function confirm() {
        setBusy(true)
        setError(null)
        try {
            await onConfirm?.()
        } catch (err) {
            // Stay open: closing on a failed delete would look like it worked.
            setError(err?.message || 'Could not delete the application')
            setBusy(false)
        }
    }

    return (
        <Modal
            title="Delete this application?"
            onClose={busy ? undefined : onCancel}
            footer={
                <>
                    <button type="button" className="btn" onClick={onCancel} disabled={busy}>
                        Keep it
                    </button>
                    <button type="button" className="btn btn-danger" onClick={confirm} disabled={busy}>
                        {busy ? 'Deleting…' : 'Delete'}
                    </button>
                </>
            }
        >
            <p className="delete-app-name">{applicationLabel(application)}</p>
            <p className="prose">
                The job description, the fit analysis, the built resume and the cover-letter
                outline are deleted with it. There is no way to get them back.
            </p>
            {fromListing && (
                <p className="prose delete-app-lead">
                    The listing you started it from stays, and shows as not applied to.
                </p>
            )}
            {error && <div className="alert alert-error delete-app-error" role="alert">{error}</div>}
        </Modal>
    )
}
