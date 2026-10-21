/**
 * The cover-letter paragraph bank, client side: the angle list, the paste
 * format, and turning a built letter back into plain text.
 */

/**
 * The angles offered as chips. Deliberately not tied to any one field, so the
 * list reads right to anyone; anything more specific is a custom tag, which
 * is what the "add your own" box is for.
 */
export const ANGLES = [
    'Startup',
    'Enterprise',
    'Leadership',
    'Hands-on',
    'Generalist',
    'Specialist',
    'Client-facing',
    'Mission-driven',
    'Career change',
    'Remote',
]

export const blankBlock = () => ({ key: '', label: '', text: '', angles: [] })

/** "integrations-core" → "Integrations core". */
export const labelFromKey = key => {
    const s = String(key ?? '').replace(/[-_]+/g, ' ').trim()
    return s ? s[0].toUpperCase() + s.slice(1) : ''
}

// A line holding only a bracketed key, optionally bold: "**[origin]**".
// A placeholder like [company] mid-sentence is never a whole line, so it
// can't be mistaken for one.
const HEADER = /^\s*(?:\*\*|__)?\s*\[([^\]\n]+)\]\s*(?:\*\*|__)?\s*$/

/**
 * Reads pasted text into paragraphs, without a model call.
 *
 * With "[key]" header lines, each header starts a paragraph. Without any,
 * every blank-line-separated chunk is a paragraph — so a plain pasted letter
 * works too, and the user names the pieces afterwards.
 *
 * @param {string} input
 * @returns {{ key: string, label: string, text: string, angles: string[] }[]}
 */
export function parseBankText(input) {
    const lines = String(input ?? '').replace(/\r\n?/g, '\n').split('\n')
    const hasHeaders = lines.some(l => HEADER.test(l))

    if (!hasHeaders) {
        return String(input ?? '')
            .split(/\n\s*\n/)
            .map(chunk => chunk.trim())
            .filter(Boolean)
            .map((text, i) => ({ key: '', label: `Paragraph ${i + 1}`, text, angles: [] }))
    }

    const blocks = []
    let current = null
    for (const line of lines) {
        const m = line.match(HEADER)
        if (m) {
            current = { key: m[1].trim(), label: labelFromKey(m[1]), text: '', angles: [] }
            blocks.push(current)
        } else if (current) {
            current.text += `${line}\n`
        }
    }
    return blocks
        .map(b => ({ ...b, text: b.text.split('\n').map(l => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim() }))
        .filter(b => b.text)
}

/** The marker a missing slot leaves in copied text, so it can't be sent by accident. */
export const missingMarker = prompt => `<-- Add something here: ${prompt} -->`

/** A built letter as plain text, paragraphs separated by blank lines. */
export function letterToText(letter) {
    return (letter?.paragraphs ?? [])
        .map(p => (p.kind === 'missing' ? missingMarker(p.prompt) : p.text))
        .filter(Boolean)
        .join('\n\n')
}
