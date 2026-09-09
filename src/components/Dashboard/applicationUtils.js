/**
 * Display title for an application: "Job title at Company" when the model
 * extracted them, otherwise the first non-empty line of the posting.
 */
export function applicationLabel(app) {
    const title   = app.jobTitle?.trim()
    const company = app.companyName?.trim()
    if (title && company) return `${title} at ${company}`
    if (title || company) return title || company

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

/** Client-side processing state for an application that has no analysis yet. */
export function analysisState(app) {
    if (app.response) return 'ready'
    if (app.error)    return 'failed'
    return 'pending'
}
