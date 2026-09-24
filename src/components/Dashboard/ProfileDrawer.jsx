import { useEffect, useRef } from 'react'
import './ProfileDrawer.css'

/**
 * The profile, as a panel that slides over the dashboard from the left.
 *
 * The profile is edited now and then; listings and applications are used every
 * session. Giving it permanent half-screen space made the part you use
 * constantly share a column, so it lives here, one click away, instead.
 *
 * Always mounted. Closing hides it rather than unmounting it, so a section
 * editor left open — half an edit to a role description — is still there on
 * reopening, not silently discarded because the drawer was dismissed. While
 * closed it is `inert`: nothing in it can be tabbed to, clicked, or read out.
 *
 * Props:
 *   open, onClose()
 *   title:    string — the accessible name, and the heading
 *   actions:  node — beside the heading (e.g. "Review suggestions")
 *   children: the profile
 */
export default function ProfileDrawer({ open, onClose, title, actions = null, children }) {
    const panelRef = useRef(null)
    const returnTo = useRef(null)

    // The latest onClose, read at the moment Escape is pressed. Depending on
    // onClose directly would re-run the effect below on every render the
    // caller makes with a fresh function — and each re-run moves focus back to
    // the panel. The dashboard re-renders every few seconds while a listings
    // search is polling, which would pull the cursor out of whatever field
    // the user is typing in.
    const onCloseRef = useRef(onClose)
    useEffect(() => { onCloseRef.current = onClose })

    useEffect(() => {
        if (!open) return undefined

        // Put focus back where it came from on close — the trigger, normally —
        // so a keyboard user isn't dropped at the top of the page.
        returnTo.current = document.activeElement
        panelRef.current?.focus()

        function onKey(e) {
            if (e.key !== 'Escape') return
            // A dialog opened from inside the drawer (rebuild, the cached-profile
            // preview) handles its own Escape. Closing the drawer underneath it
            // as well would take the user two levels out on one key.
            const dialogs = document.querySelectorAll('[aria-modal="true"]')
            if (dialogs.length > 1) return
            onCloseRef.current?.()
        }
        document.addEventListener('keydown', onKey)

        // The page behind must not scroll under the drawer.
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = previous
            if (returnTo.current && typeof returnTo.current.focus === 'function') {
                returnTo.current.focus()
            }
        }
    }, [open])

    return (
        <div className={`drawer-root${open ? ' is-open' : ''}`}>
            <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
            <aside
                ref={panelRef}
                className="drawer"
                role="dialog"
                aria-modal={open ? 'true' : undefined}
                aria-label={title}
                aria-hidden={open ? undefined : 'true'}
                inert={!open}
                tabIndex={-1}
            >
                <header className="drawer-head">
                    <h2 className="drawer-title">{title}</h2>
                    <div className="drawer-actions">
                        {actions}
                        <button type="button" className="drawer-close" onClick={onClose} aria-label="Close profile">
                            ×
                        </button>
                    </div>
                </header>
                <div className="drawer-body">{children}</div>
            </aside>
        </div>
    )
}
