import { useEffect, useRef } from 'react'
import './Modal.css'

/**
 * A dialog rendered in place (no portal — nothing in this app stacks deeply
 * enough to need one). Escape and a backdrop click both close it, and focus
 * moves into the panel on open so keyboard users aren't left behind the
 * backdrop.
 *
 * Props:
 *   title:    string — the accessible name, rendered as the heading
 *   onClose() — Escape, the backdrop, and the × all call this
 *   footer:   node — action buttons, pinned below the scrolling body
 *   wide:     boolean — for content as long as a whole profile
 *   children: the body
 */
export default function Modal({ title, onClose, footer, wide = false, children }) {
    const panelRef = useRef(null)

    useEffect(() => {
        function onKey(e) {
            if (e.key === 'Escape') onClose?.()
        }
        document.addEventListener('keydown', onKey)
        // The page behind must not scroll under the dialog.
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        panelRef.current?.focus()
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = previous
        }
    }, [onClose])

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div
                ref={panelRef}
                className={`modal${wide ? ' is-wide' : ''}`}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                // The backdrop closes on click; clicks inside must not bubble to it.
                onClick={e => e.stopPropagation()}
            >
                <header className="modal-head">
                    <h2 className="modal-title">{title}</h2>
                    <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
                        ×
                    </button>
                </header>

                <div className="modal-body">{children}</div>

                {footer && <footer className="modal-footer">{footer}</footer>}
            </div>
        </div>
    )
}
