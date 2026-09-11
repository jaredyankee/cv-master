import { useState } from 'react'
import Modal from '../common/Modal'
import { ReadOnlyDump } from './ResumeDumpPanel'

/** "12 Sep" style — enough to tell one cache from a newer one. */
function cachedWhen(at) {
    if (!at) return null
    const d = new Date(at)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * The previous profile, parked. Shown as a chip rather than as content: it is
 * not the profile any more, it is the one you can get back.
 *
 * Three things you can do with it, which is the whole of the standard cache
 * affordance — look at it, put it back, throw it away.
 *
 * Props:
 *   cached:    { dump, at }
 *   onRecover() — async; restores it as the live profile
 *   onClear()   — async; deletes it
 */
export default function CachedDumpChip({ cached, onRecover, onClear }) {
    const [preview, setPreview]   = useState(false)
    const [confirm, setConfirm]   = useState(false)
    const [busy, setBusy]         = useState(null)  // 'recover' | 'clear'

    if (!cached?.dump) return null

    const when = cachedWhen(cached.at)
    const name = cached.dump?.contact?.name

    async function run(kind, fn) {
        setBusy(kind)
        try {
            await fn?.()
            setPreview(false)
            setConfirm(false)
        } finally {
            setBusy(null)
        }
    }

    return (
        <>
            <div className="cache-chip">
                <span className="cache-chip-icon" aria-hidden="true">⎘</span>
                <span className="cache-chip-text">
                    <span className="cache-chip-title">Previous profile</span>
                    <span className="cache-chip-meta">
                        {[name, when && `cached ${when}`].filter(Boolean).join(' · ')}
                    </span>
                </span>
                <span className="cache-chip-actions">
                    <button
                        type="button"
                        className="cache-chip-btn"
                        onClick={() => setPreview(true)}
                    >
                        Preview
                    </button>
                    <button
                        type="button"
                        className="cache-chip-btn is-danger"
                        onClick={() => setConfirm(true)}
                        aria-label="Delete the cached profile"
                        title="Delete the cached profile"
                    >
                        🗑
                    </button>
                </span>
            </div>

            {preview && (
                <Modal
                    title="Previous profile"
                    wide
                    onClose={busy ? undefined : () => setPreview(false)}
                    footer={
                        <>
                            <button
                                type="button"
                                className="btn"
                                onClick={() => setPreview(false)}
                                disabled={Boolean(busy)}
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => run('recover', onRecover)}
                                disabled={Boolean(busy)}
                            >
                                {busy === 'recover' ? 'Recovering…' : 'Recover this profile'}
                            </button>
                        </>
                    }
                >
                    <p className="cache-preview-note">
                        Recovering replaces whatever profile you have now and empties the cache.
                    </p>
                    <div className="cache-preview">
                        <ReadOnlyDump dump={cached.dump} />
                    </div>
                </Modal>
            )}

            {confirm && (
                <Modal
                    title="Delete the cached profile?"
                    onClose={busy ? undefined : () => setConfirm(false)}
                    footer={
                        <>
                            <button
                                type="button"
                                className="btn"
                                onClick={() => setConfirm(false)}
                                disabled={Boolean(busy)}
                            >
                                Keep it
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={() => run('clear', onClear)}
                                disabled={Boolean(busy)}
                            >
                                {busy === 'clear' ? 'Deleting…' : 'Delete'}
                            </button>
                        </>
                    }
                >
                    <p className="prose">
                        This is the only copy. Once it is gone there is no way back to
                        the profile it holds.
                    </p>
                </Modal>
            )}
        </>
    )
}
