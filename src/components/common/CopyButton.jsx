import { useEffect, useState } from 'react'
import './CopyButton.css'

/**
 * Copies text to the clipboard and reports what happened inline, so the click
 * has visible feedback without a toast system.
 *
 * Props:
 *   text:        string | () => string — a getter avoids building large
 *                payloads on every render of the parent
 *   label:       idle text
 *   copiedLabel: text shown briefly after a successful copy
 *   disabled:    there is nothing worth copying yet
 *   title:       tooltip — worth setting when disabled, to say why
 */
export default function CopyButton({
    text,
    label = 'Copy',
    copiedLabel = 'Copied',
    disabled = false,
    title,
}) {
    const [state, setState] = useState('idle')   // 'idle' | 'copied' | 'error'

    useEffect(() => {
        if (state === 'idle') return
        const id = setTimeout(() => setState('idle'), 2000)
        return () => clearTimeout(id)
    }, [state])

    async function handleCopy() {
        const value = typeof text === 'function' ? text() : text
        if (!value) return setState('error')

        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(value)
            } else if (!legacyCopy(value)) {
                throw new Error('Clipboard unavailable')
            }
            setState('copied')
        } catch (err) {
            console.error('Copy failed', err)
            setState('error')
        }
    }

    return (
        <button
            type="button"
            className={`copy-btn is-${state}`}
            onClick={handleCopy}
            disabled={disabled}
            title={title}
            aria-live="polite"
        >
            {state === 'copied' ? copiedLabel : state === 'error' ? 'Copy failed' : label}
        </button>
    )
}

/**
 * execCommand fallback for insecure contexts, where navigator.clipboard is
 * undefined (a plain-http LAN address during development, for instance).
 */
function legacyCopy(value) {
    const el = document.createElement('textarea')
    el.value = value
    el.setAttribute('readonly', '')
    el.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0'
    document.body.appendChild(el)
    el.select()
    let ok
    try {
        ok = document.execCommand('copy')
    } catch {
        ok = false
    }
    document.body.removeChild(el)
    return ok
}
