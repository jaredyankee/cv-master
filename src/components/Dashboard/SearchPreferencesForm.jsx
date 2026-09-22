import { useState } from 'react'
import {
    ARRANGEMENT_OPTIONS, listToText, textToList, parseSalaryInput, formatSalary,
} from '../../lib/searchPrefs'

/**
 * What a listing search looks for.
 *
 * Opens on whatever the server has — saved preferences, or a first guess read
 * out of the dump (titles from jobs held, arrangement and floor from
 * `lookingFor`). When it is a guess, it says so: the user should see what was
 * read off their profile before it drives a search, not discover it later
 * from the results.
 *
 * Props:
 *   initial:   preferences
 *   seeded:    true when `initial` is a guess rather than something saved
 *   hasKey:    a Perplexity key is already on file
 *   onSave(preferences, searchKey) — async; throws to keep the form open
 *   onCancel() — optional
 */
export default function SearchPreferencesForm({ initial, seeded = false, hasKey = false, onSave, onCancel }) {
    const [arrangement, setArrangement] = useState(initial?.arrangement ?? 'any')
    const [titles, setTitles]           = useState(listToText(initial?.titles))
    const [locations, setLocations]     = useState(listToText(initial?.locations))
    const [salary, setSalary]           = useState(formatSalary(initial?.minSalary))
    const [seniority, setSeniority]     = useState(initial?.seniority ?? '')
    const [exclude, setExclude]         = useState(listToText(initial?.excludeCompanies))
    const [searchKey, setSearchKey]     = useState('')
    const [showKey, setShowKey]         = useState(false)
    const [saving, setSaving]           = useState(false)
    const [error, setError]             = useState(null)

    const titleList = textToList(titles)
    // A salary the field can't read is flagged, not silently dropped — the
    // user typed something and believes it is a floor.
    const salaryUnreadable = salary.trim() !== '' && parseSalaryInput(salary) === null
    const keyReady = hasKey || searchKey.trim().length > 0
    const canSave = titleList.length > 0 && !salaryUnreadable && keyReady && !saving

    async function handleSubmit(e) {
        e.preventDefault()
        if (!canSave) return
        setSaving(true)
        setError(null)
        try {
            await onSave({
                arrangement,
                titles: titleList,
                locations: textToList(locations),
                minSalary: parseSalaryInput(salary),
                seniority: seniority.trim(),
                excludeCompanies: textToList(exclude),
            }, searchKey.trim())
        } catch (err) {
            setError(err?.message ?? 'Could not save')
            setSaving(false)
        }
    }

    return (
        <form className="search-prefs" onSubmit={handleSubmit} noValidate>
            {seeded && (
                <p className="search-prefs-seeded">
                    Read from your profile — your job titles, and what you said you're
                    looking for. Check it before it searches.
                </p>
            )}

            <div className="field">
                <label htmlFor="sp-titles" className="field-label">Job titles</label>
                <textarea
                    id="sp-titles" className="input search-prefs-list" rows={3}
                    value={titles} onChange={e => setTitles(e.target.value)}
                    placeholder={'Software Engineer\nIntegrations Engineer'}
                />
                <span className="field-hint small">One per line. Each title is its own search.</span>
            </div>

            <div className="field">
                <span className="field-label" id="sp-arrangement">Where</span>
                <div className="provider-row" role="radiogroup" aria-labelledby="sp-arrangement">
                    {ARRANGEMENT_OPTIONS.map(o => (
                        <button
                            key={o.value} type="button" role="radio"
                            aria-checked={arrangement === o.value}
                            className={`provider-option${arrangement === o.value ? ' is-active' : ''}`}
                            onClick={() => setArrangement(o.value)}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
                {arrangement === 'remote' && (
                    <span className="field-hint small">
                        Listings that say they're on-site are set aside. Ones that don't say are kept.
                    </span>
                )}
            </div>

            {arrangement !== 'remote' && (
                <div className="field">
                    <label htmlFor="sp-locations" className="field-label">Locations</label>
                    <textarea
                        id="sp-locations" className="input search-prefs-list" rows={2}
                        value={locations} onChange={e => setLocations(e.target.value)}
                        placeholder={'Providence, RI\nBoston, MA'}
                    />
                </div>
            )}

            <div className="search-prefs-row">
                <div className="field">
                    <label htmlFor="sp-salary" className="field-label">Minimum salary</label>
                    <input
                        id="sp-salary" className="input" inputMode="numeric"
                        value={salary} onChange={e => setSalary(e.target.value)}
                        onBlur={() => { const n = parseSalaryInput(salary); if (n) setSalary(formatSalary(n)) }}
                        placeholder="130,000" aria-invalid={salaryUnreadable || undefined}
                    />
                    <span className={`field-hint small${salaryUnreadable ? ' is-error' : ''}`}>
                        {salaryUnreadable
                            ? 'Enter a single number, like 130000 or 130k.'
                            : 'Only listings that publish a lower range are set aside.'}
                    </span>
                </div>
                <div className="field">
                    <label htmlFor="sp-seniority" className="field-label">Seniority</label>
                    <input
                        id="sp-seniority" className="input"
                        value={seniority} onChange={e => setSeniority(e.target.value)}
                        placeholder="Senior"
                    />
                </div>
            </div>

            <div className="field">
                <label htmlFor="sp-exclude" className="field-label">Skip these companies</label>
                <textarea
                    id="sp-exclude" className="input search-prefs-list" rows={2}
                    value={exclude} onChange={e => setExclude(e.target.value)}
                    placeholder="Your current employer"
                />
            </div>

            <div className="field">
                <label htmlFor="sp-key" className="field-label">
                    Perplexity API key
                    {hasKey && <span className="field-optional">Optional</span>}
                </label>
                <div className="api-key-row">
                    <input
                        id="sp-key" type={showKey ? 'text' : 'password'}
                        className="input api-key-input" autoComplete="off" spellCheck={false}
                        value={searchKey} onChange={e => setSearchKey(e.target.value)}
                        placeholder={hasKey ? 'Using your saved Perplexity key' : 'pplx-…'}
                    />
                    <button type="button" className="btn" onClick={() => setShowKey(v => !v)}
                        aria-label={showKey ? 'Hide API key' : 'Show API key'}>
                        {showKey ? 'Hide' : 'Show'}
                    </button>
                </div>
                <span className="field-hint small">
                    Stored encrypted, never logged. Searches are billed to this key.
                </span>
            </div>

            {error && <div className="alert alert-error" role="alert"><strong>Couldn't save.</strong> {error}</div>}

            <div className="search-prefs-actions">
                {onCancel && (
                    <button type="button" className="link-btn" onClick={onCancel} disabled={saving}>Cancel</button>
                )}
                <button type="submit" className="btn btn-primary" disabled={!canSave}>
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </div>
        </form>
    )
}
