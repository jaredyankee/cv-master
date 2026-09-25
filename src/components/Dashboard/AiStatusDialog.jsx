import { useEffect, useRef, useState } from 'react'
import Modal from '../common/Modal'
import './AiStatus.css'

/**
 * Which AI your requests go to: the active provider, the model for each job,
 * and which keys this site holds for you.
 *
 * Read-only. Loaded when opened rather than with the dashboard, so the keys
 * are only decrypted (server side, for their last four characters) when
 * someone is looking.
 *
 * Props:
 *   onLoad()  async → the GET /ai-status body; throws with a message
 *   onClose()
 */
export default function AiStatusDialog({ onLoad, onClose }) {
    const [status, setStatus] = useState(null)
    const [error, setError] = useState(null)
    // Once per open: callers pass an inline function, and a fresh one each
    // parent render must not become a fresh request.
    const load = useRef(onLoad)

    useEffect(() => {
        let cancelled = false
        load.current()
            .then(s => { if (!cancelled) setStatus(s) })
            .catch(err => { if (!cancelled) setError(err?.message || 'Could not load your AI settings') })
        return () => { cancelled = true }
    }, [])

    const active = status?.providers?.find(p => p.active) ?? null
    const others = (status?.providers ?? []).filter(p => !p.active)

    return (
        <Modal
            title="AI provider"
            onClose={onClose}
            footer={<button type="button" className="btn" onClick={onClose}>Close</button>}
        >
            {!status && !error && <p className="ai-loading">Loading…</p>}
            {error && <div className="alert alert-error" role="alert">{error}</div>}

            {active && (
                <>
                    <section className="ai-active" aria-label={`${active.label}, active`}>
                        <div className="ai-head">
                            <span className="ai-name">{active.label}</span>
                            <span className="ai-pill">Active</span>
                        </div>
                        <KeyLine hint={active.key} />
                        <Models models={active.models} />
                    </section>

                    {!active.key.set && (
                        <div className="alert alert-flag ai-nokey">
                            <strong>No {active.label} key on file.</strong> Building a resume will fail
                            until you add one on the resume dump form.
                        </div>
                    )}

                    <p className="section-label ai-label">Other providers</p>
                    <ul className="ai-list">
                        {others.map(p => (
                            <li key={p.id} className="ai-item">
                                <div className="ai-head">
                                    <span className="ai-name">{p.label}</span>
                                </div>
                                <KeyLine hint={p.key} />
                                <Models models={p.models} quiet />
                            </li>
                        ))}
                    </ul>

                    <p className="section-label ai-label">Listings search</p>
                    <div className="ai-item">
                        <div className="ai-head">
                            <span className="ai-name">{status.search.label}</span>
                        </div>
                        <KeyLine hint={status.search.key} />
                    </div>

                    <p className="ai-foot">
                        The models are chosen by this deployment. Your provider and keys come from the
                        resume dump form, so they change the next time you build your profile.
                    </p>
                </>
            )}
        </Modal>
    )
}

/** "Key ending in AbCd", or why there isn't one to show. */
function KeyLine({ hint }) {
    if (!hint?.set) return <p className="ai-key is-none">No key on file</p>
    if (hint.unreadable) {
        return (
            <p className="ai-key is-bad">
                A key is on file but can&rsquo;t be read. Enter it again to replace it.
            </p>
        )
    }
    if (!hint.last4) return <p className="ai-key">Key on file</p>
    return <p className="ai-key">Key ending in <code className="ai-code">{hint.last4}</code></p>
}

function Models({ models, quiet = false }) {
    return (
        <dl className={`ai-models${quiet ? ' is-quiet' : ''}`}>
            <dt>Fit and resume building</dt>
            <dd><code className="ai-code">{models.reasoning}</code></dd>
            <dt>Reading your resume dump</dt>
            <dd><code className="ai-code">{models.extraction}</code></dd>
        </dl>
    )
}
