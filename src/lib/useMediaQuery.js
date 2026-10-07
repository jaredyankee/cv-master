import { useSyncExternalStore } from 'react'

/**
 * Whether a media query matches, kept current as the window resizes.
 *
 * For layout choices CSS can't make: a table and a list of cards are
 * different markup, not different styles of the same markup.
 *
 * @param {string} query  e.g. '(max-width: 700px)'
 */
export function useMediaQuery(query) {
    return useSyncExternalStore(
        onChange => {
            const mql = window.matchMedia(query)
            mql.addEventListener('change', onChange)
            return () => mql.removeEventListener('change', onChange)
        },
        () => window.matchMedia(query).matches,
        () => false,
    )
}
