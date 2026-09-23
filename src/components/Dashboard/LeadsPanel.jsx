import { useState } from 'react'
import Progress from '../common/Progress'
import SearchPreferencesForm from './SearchPreferencesForm'
import { describePreferences, formatSalary } from '../../lib/searchPrefs'
import './LeadsPanel.css'

const SOURCE_LABEL = {
    greenhouse: 'Greenhouse', lever: 'Lever', ashby: 'Ashby', workable: 'Workable',
    smartrecruiters: 'SmartRecruiters', workday: 'Workday', icims: 'iCIMS', taleo: 'Taleo',
    other: 'Careers page',
}
const ARRANGEMENT_LABEL = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' }

/**
 * Listings found for you, and the search behind them.
 *
 * Sits above the applications list and never holds it up: a search runs in a
 * background function, and while it does this panel shows progress and
 * everything else on the dashboard stays usable.
 *
 * A lead is a link, not a job description. Starting an application from one
 * opens the normal form with the link filled in — the user pastes the
 * posting, and the fit assessment runs on the real text rather than on a
 * search snippet.
 *
 * Listings the filter set aside stay visible, folded, with the reason. A
 * filter you can't see is one you can't catch being wrong.
 *
 * Props:
 *   state:     { leads, preferences, run, hasKey, loaded } | null
 *   form:      { preferences, seeded } | null — set while the form is open
 *   onOpenForm(), onCloseForm()
 *   onSavePreferences(preferences, searchKey) — async
 *   onSearch() — start a search now
 *   onDismiss(id)
 *   onStart(lead) — start an application from this lead
 *   error:     string | null
 */
export default function LeadsPanel({
    state, form, onOpenForm, onCloseForm, onSavePreferences, onSearch, onDismiss, onStart, error,
}) {
    const [showFiltered, setShowFiltered] = useState(false)

    if (!state?.loaded) return null

    const { leads = [], preferences, run = {}, hasKey } = state
    const live     = leads.filter(l => !l.disqualifiedFor)
    const filtered = leads.filter(l => l.disqualifiedFor)
    const summary  = describePreferences(preferences)

    return (
        <section className="leads" aria-labelledby="leads-title">
            <header className="panel-head">
                <h2 className="panel-title" id="leads-title">
                    Listings
                    {live.length > 0 && <span className="count">{live.length}</span>}
                </h2>
                <div className="leads-actions">
                    {!form && (
                        <button type="button" className="link-btn" onClick={onOpenForm}>
                            {hasKey ? 'Preferences' : 'Set up'}
                        </button>
                    )}
                    {hasKey && !form && (
                        <button
                            type="button" className="btn btn-sm"
                            onClick={onSearch} disabled={run.running}
                        >
                            {run.running ? 'Searching…' : run.hasRun ? 'Check for new listings' : 'Search now'}
                        </button>
                    )}
                </div>
            </header>

            {form ? (
                <SearchPreferencesForm
                    initial={form.preferences}
                    seeded={form.seeded}
                    hasKey={hasKey}
                    onSave={onSavePreferences}
                    onCancel={onCloseForm}
                />
            ) : (
                <>
                    {summary && <p className="leads-summary">{summary}</p>}

                    {run.running && (
                        <Progress
                            variant="inline"
                            phrases={['Searching job boards']}
                            // Omitted until the server reports our run: Progress
                            // then counts from mount, which is when the user asked.
                            startedAt={run.running && run.startedAt ? new Date(run.startedAt).getTime() : undefined}
                        />
                    )}

                    {error && (
                        <div className="alert alert-error" role="alert">
                            <strong>The search didn&rsquo;t complete.</strong> {error}
                        </div>
                    )}
                    {!error && run.error && !run.running && (
                        <div className="alert alert-error" role="alert">
                            <strong>The last search didn&rsquo;t complete.</strong> {run.error}
                        </div>
                    )}

                    {!hasKey && (
                        <p className="leads-empty">
                            Add a Perplexity key and CV Master will look for listings that match
                            your profile. It links to the posting — you paste the job description
                            when you decide to apply.
                        </p>
                    )}

                    {hasKey && !run.running && live.length === 0 && (
                        <p className="leads-empty">
                            {run.hasRun
                                ? 'Nothing new that fits. Check again later, or widen your preferences.'
                                : 'No search yet.'}
                        </p>
                    )}

                    {live.length > 0 && (
                        <ul className="lead-list">
                            {live.map(l => (
                                <LeadCard key={l.id} lead={l} onDismiss={onDismiss} onStart={onStart} />
                            ))}
                        </ul>
                    )}

                    {filtered.length > 0 && (
                        <div className="leads-filtered">
                            <button
                                type="button" className="link-btn"
                                aria-expanded={showFiltered}
                                onClick={() => setShowFiltered(v => !v)}
                            >
                                {showFiltered ? 'Hide' : 'Show'} {filtered.length} set aside
                            </button>
                            {showFiltered && (
                                <ul className="lead-list is-filtered">
                                    {filtered.map(l => (
                                        <LeadCard key={l.id} lead={l} onDismiss={onDismiss} onStart={onStart} />
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </>
            )}
        </section>
    )
}

// The server only ever stores https URLs (canonicalUrl rejects anything else),
// but an href is exactly where a tampered row would turn into script — a
// javascript: URL runs on click. Checked again here, and rendered as plain
// text if it fails.
const safeHref = url => (typeof url === 'string' && /^https:\/\//i.test(url) ? url : null)

function LeadCard({ lead, onDismiss, onStart }) {
    const href = safeHref(lead.url)
    const meta = [
        lead.company,
        SOURCE_LABEL[lead.source] ?? null,
        ARRANGEMENT_LABEL[lead.arrangement] ?? null,
        lead.salaryFloor ? `from ${formatSalary(lead.salaryFloor)}` : null,
        lead.postedAt,
    ].filter(Boolean)

    return (
        <li className="lead-card">
            <div className="lead-main">
                {/* The URL came from a search index, not from the user or a
                    model; noopener/noreferrer so the posting page can neither
                    reach back into this tab nor learn where it was opened from. */}
                {href ? (
                    <a className="lead-title" href={href} target="_blank" rel="noopener noreferrer">
                        {lead.title || href}
                    </a>
                ) : (
                    <span className="lead-title">{lead.title || 'Untitled listing'}</span>
                )}
                {meta.length > 0 && <p className="lead-meta">{meta.join(' · ')}</p>}
                {lead.snippet && <p className="lead-snippet">{lead.snippet}</p>}
                {lead.disqualifiedFor && <p className="lead-reason">{lead.disqualifiedFor}</p>}
            </div>
            <div className="lead-buttons">
                {lead.applicationId ? (
                    <span className="lead-started">Application started</span>
                ) : (
                    <button type="button" className="btn btn-sm" onClick={() => onStart(lead)}>
                        Start application
                    </button>
                )}
                <button type="button" className="link-btn" onClick={() => onDismiss(lead.id)}>
                    Dismiss
                </button>
            </div>
        </li>
    )
}
