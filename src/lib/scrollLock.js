/**
 * Stops the page scrolling behind a drawer or dialog, shared by everything
 * that needs it.
 *
 * Each overlay used to save document.body's overflow on open and put it back
 * on close. That only works when they close in the reverse order they opened,
 * and they don't: the rebuild dialog opens from inside the profile drawer, and
 * choosing Revise closes the drawer first. The dialog then "restored" the
 * `hidden` it had saved from the drawer, and nothing was left to undo it, so
 * the dump form below couldn't scroll to its submit button.
 *
 * So it is counted instead. The first lock saves the page's own value, the
 * last release restores it, and the order in between doesn't matter.
 */

let holders = 0
let saved = ''

/**
 * @returns {() => void} release. Safe to call more than once; only the first
 *          call counts, so a cleanup that runs twice can't unlock someone else.
 */
export function lockScroll() {
    if (holders === 0) {
        saved = document.body.style.overflow
        document.body.style.overflow = 'hidden'
    }
    holders += 1

    let released = false
    return () => {
        if (released) return
        released = true
        holders -= 1
        if (holders === 0) document.body.style.overflow = saved
    }
}
