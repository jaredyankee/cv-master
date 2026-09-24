/**
 * A search snippet as readable text.
 *
 * Search engines hand back a flattened piece of the page: Markdown heading
 * marks, table pipes, emphasis, link syntax, and on some boards the page's
 * own unrendered template placeholders ({{ location.name }}). None of it is
 * meant to be seen.
 *
 * Cleaned to plain text rather than rendered as Markdown. The card shows two
 * lines as a teaser for the posting behind the link — a heading or a table
 * has no place in a teaser even when it renders correctly — and plain text
 * gives a snippet from an arbitrary page no way to put markup into ours.
 *
 * @param {string} text
 * @returns {string}
 */
export function cleanSnippet(text) {
    if (typeof text !== 'string') return ''
    let s = text

    // A page's own unrendered template variables.
    s = s.replace(/\{\{[^}]*\}\}/g, ' ')
    s = s.replace(/\{%[^%]*%\}/g, ' ')

    // Images go entirely; links keep their words.
    s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')

    // Table rules (|---|:--:|) carry nothing; the cells between pipes do.
    s = s.replace(/\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?/g, ' ')
    s = s.replace(/\s*\|+\s*/g, ' · ')

    // Heading marks, wherever the flattening left them.
    s = s.replace(/(^|\s)#{1,6}\s+/g, '$1')

    // Emphasis and code marks. Single underscores are left: they appear in
    // real words (snake_case, URLs) far more often than as emphasis here.
    s = s.replace(/\*\*|__|`+/g, '')
    s = s.replace(/(^|\s)\*(\S[^*]*\S|\S)\*(?=\s|$|[.,;:!?])/g, '$1$2')

    // A list marker at the very start, or straight after a separator.
    s = s.replace(/(^|·\s)[-*•]\s+/g, '$1')

    // Search engines mark elisions with "...": one ellipsis character, and
    // never a pile of them.
    s = s.replace(/\.{3,}/g, '…')

    // Tidy the separators the steps above leave behind.
    s = s.replace(/\s+/g, ' ')
    s = s.replace(/(\s*[·…]\s*){2,}/g, m => (m.includes('…') ? ' … ' : ' · '))
    s = s.replace(/^[\s·…]+|[\s·]+$/g, '')

    return s.trim()
}
