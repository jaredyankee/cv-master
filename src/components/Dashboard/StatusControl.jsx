import { useState } from 'react'
import { statusLabel, nextStatus, statusProgress } from '../../lib/status'
import './StatusControl.css'

/**
 * Where an application has got to, and the two ways to change it.
 *
 * Most of the time a status moves one step forward, so that is the button:
 * one click, and it says where it is going rather than making you find it in
 * a list. The dropdown is for everything else — going back after a rejection,
 * or skipping a stage that didn't happen.
 *
 * The control shows the current status even when it can't be changed (no
 * statuses loaded, or no handler), because "where is this one" is worth
 * answering on its own.
 *
 * Props:
 *   value:     string|null   the stored status
 *   statuses:  string[]      pipeline order, from the database enum
 *   onChange:  async (next) => void — omit for read-only
 */
export default function StatusControl({ value, statuses = [], onChange }) {
    const [saving, setSaving] = useState(false)
    const [error, setError]   = useState(null)

    const next     = nextStatus(statuses, value)
    const progress = statusProgress(statuses, value)
    const editable = Boolean(onChange) && statuses.length > 0

    async function move(to) {
        if (!to || to === value) return
        setSaving(true)
        setError(null)
        try {
            await onChange(to)
        } catch (err) {
            // The status on screen is still the stored one — the change simply
            // didn't happen — so saying so is the whole recovery.
            setError(err?.message ?? 'Could not save that')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="status-control">
            <div className="status-row">
                <span className="status-current" data-status={value ?? ''}>
                    {statusLabel(value) || 'No status'}
                    {progress && (
                        <span className="status-step" aria-hidden="true">
                            {progress.step}/{progress.of}
                        </span>
                    )}
                </span>

                {editable && (
                    <>
                        {next && (
                            <button
                                type="button"
                                className="btn btn-sm status-advance"
                                onClick={() => move(next)}
                                disabled={saving}
                            >
                                {saving ? 'Saving…' : `Advance to ${statusLabel(next)}`}
                            </button>
                        )}

                        <select
                            className="status-select"
                            aria-label="Set status"
                            value={statuses.includes(value) ? value : ''}
                            onChange={e => move(e.target.value)}
                            disabled={saving}
                        >
                            {/* Only present while the stored status isn't one of
                                the options, so the select always has something
                                truthful to show. */}
                            {!statuses.includes(value) && (
                                <option value="" disabled>
                                    {statusLabel(value) || 'Set status'}
                                </option>
                            )}
                            {statuses.map(s => (
                                <option key={s} value={s}>{statusLabel(s)}</option>
                            ))}
                        </select>
                    </>
                )}
            </div>

            {error && <p className="status-error" role="alert">{error}</p>}
        </div>
    )
}
