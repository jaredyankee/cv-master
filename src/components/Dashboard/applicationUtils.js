/** First non-empty line of the JD, trimmed, as the application's display title. */
export function applicationLabel(app) {
    const line = (app.jobDescription ?? '')
        .split('\n')
        .map(l => l.trim())
        .find(Boolean)
    if (!line) return 'Untitled application'
    return line.length > 80 ? `${line.slice(0, 77)}…` : line
}

export function formatDate(iso) {
    if (!iso) return ''
    try {
        return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
        return ''
    }
}
