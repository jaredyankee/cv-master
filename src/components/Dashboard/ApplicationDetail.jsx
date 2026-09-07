import { useState } from 'react'
import FitBadge from './FitBadge'
import { applicationLabel, formatDate } from './applicationUtils'
import { WARN_ON_FIT } from '../../schemas/jobApplication'

const has = v => Array.isArray(v) ? v.length > 0 : Boolean(v && String(v).trim())
const dates = (start, end) => [start, end].filter(has).join(' – ')

const INTENT_LABEL = {
    qualification: 'Qualification',
    gap:           'Gap',
    culture_fit:   'Culture fit',
    warning:       'Warning',
}

function Section({ label, children }) {
    return (
        <section className="detail-section">
            <p className="section-label">{label}</p>
            {children}
        </section>
    )
}

/** Long text with a "show more" clamp. */
function Clamped({ text, limit = 900 }) {
    const [open, setOpen] = useState(false)
    const long = text.length > limit
    return (
        <div>
            <pre className={`detail-pre${long && !open ? ' is-clamped' : ''}`}>{text}</pre>
            {long && (
                <button type="button" className="link-btn" onClick={() => setOpen(v => !v)}>
                    {open ? 'Show less' : 'Show full description'}
                </button>
            )}
        </div>
    )
}

/** The AI's output, once it exists. Shape: JobApplicationResponse. */
function Analysis({ response }) {
    const { fit_criteria, job_application: ja, cover_letter: cl, notes, answers = [], ai_filter } = response

    return (
        <>
            {fit_criteria && (
                <Section label="Fit">
                    <div className="fit-card">
                        <FitBadge level={fit_criteria.level} />
                        <p className="detail-text">{fit_criteria.rationale}</p>
                        {WARN_ON_FIT.has(fit_criteria.level) && (
                            <p className="fit-warning">
                                Generating a resume for this level may not be worth the tokens.
                            </p>
                        )}
                    </div>
                </Section>
            )}

            {ai_filter?.detected && (
                <div className="filter-alert">
                    <strong>Hidden instruction in the JD.</strong> {ai_filter.detail}
                </div>
            )}

            {ja && (
                <Section label="Built resume">
                    <div className="built-resume">
                        {ja.contact && (
                            <div className="built-contact">
                                <div className="dump-name">{ja.contact.name}</div>
                                {has(ja.contact.title) && <div className="entry-sub">{ja.contact.title}</div>}
                                <div className="dump-contact-row">
                                    {[ja.contact.location, ja.contact.email, ja.contact.phone].filter(has).map((b, i) => <span key={i}>{b}</span>)}
                                </div>
                            </div>
                        )}
                        {has(ja.summary) && <p className="detail-text">{ja.summary}</p>}

                        {has(ja.experience) && ja.experience.map((e, i) => (
                            <div key={i} className="entry">
                                <div className="entry-head">
                                    <div>
                                        <div className="entry-title">{e.title}</div>
                                        <div className="entry-sub">{e.company}</div>
                                    </div>
                                    <div className="entry-dates">{dates(e.startDate, e.endDate)}</div>
                                </div>
                                {has(e.highlights) && (
                                    <ul className="dump-list">
                                        {e.highlights.map((h, j) => <li key={j}>{h}</li>)}
                                    </ul>
                                )}
                            </div>
                        ))}

                        {has(ja.education) && ja.education.map((e, i) => (
                            <div key={i} className="entry">
                                <div className="entry-head">
                                    <div className="entry-title">{e.school}</div>
                                    <div className="entry-dates">{dates(e.startDate, e.endDate)}</div>
                                </div>
                                {has(e.highlights) && (
                                    <ul className="dump-list">
                                        {e.highlights.map((h, j) => <li key={j}>{h}</li>)}
                                    </ul>
                                )}
                            </div>
                        ))}

                        {has(ja.skills) && ja.skills.map((s, i) => (
                            <div key={i} className="skill-row">
                                <span className="skill-category">{s.category}</span>
                                <div className="chip-row">
                                    {(s.items ?? []).map((item, j) => <span key={j} className="chip">{item}</span>)}
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {cl && (
                <Section label="Cover letter outline">
                    {has(cl.mission) && cl.mission !== 'N/A' && (
                        <div className="entry">
                            <div className="entry-sub">Mission</div>
                            <p className="entry-body">{cl.mission}</p>
                        </div>
                    )}
                    {has(cl.culture) && (
                        <div className="entry">
                            <div className="entry-sub">Culture</div>
                            <p className="entry-body">{cl.culture}</p>
                        </div>
                    )}
                    {(cl.intents ?? []).map((intent, i) => (
                        <div key={i} className={`intent-card intent-${intent.category}`}>
                            <div className="intent-head">
                                <span className="intent-category">{INTENT_LABEL[intent.category] ?? intent.category}</span>
                                {typeof intent.confidence === 'number' && (
                                    <span className="intent-confidence" title="AI confidence this is worth addressing">
                                        <span className="confidence-bar"><span style={{ width: `${Math.max(0, Math.min(100, intent.confidence))}%` }} /></span>
                                        {intent.confidence}%
                                    </span>
                                )}
                            </div>
                            <p className="detail-text">{intent.rationale}</p>
                            {has(intent.blurb) && <p className="intent-blurb">{intent.blurb}</p>}
                        </div>
                    ))}
                </Section>
            )}

            {has(answers) && (
                <Section label="Your questions, answered">
                    {answers.map((a, i) => (
                        <div key={i} className="entry">
                            <div className="entry-sub">{a.question}</div>
                            <p className="entry-body">{a.answer}</p>
                        </div>
                    ))}
                </Section>
            )}

            {has(notes) && (
                <Section label="AI notes">
                    <p className="detail-text">{notes}</p>
                </Section>
            )}
        </>
    )
}

/**
 * A single application: what the user entered, and the AI's analysis once available.
 *
 * Props:
 *   application: Application — { id, createdAt, jobDescription, notes, questions, response }
 *   onBack()
 */
export default function ApplicationDetail({ application, onBack }) {
    const { jobDescription = '', notes = '', questions = [], response = null, createdAt } = application

    return (
        <div className="detail">
            <button type="button" className="detail-back" onClick={onBack}>← All applications</button>

            <div className="detail-header">
                <h2 className="detail-title">{applicationLabel(application)}</h2>
                <div className="detail-meta">
                    <span>Added {formatDate(createdAt)}</span>
                    {response?.fit_criteria?.level
                        ? <FitBadge level={response.fit_criteria.level} />
                        : <span className="status-pill">Not analyzed</span>}
                </div>
            </div>

            {response
                ? <Analysis response={response} />
                : (
                    <div className="pending-card">
                        The fit assessment, built resume, and cover letter outline will appear here
                        once the analysis endpoint is wired up.
                    </div>
                )}

            <Section label="Job description">
                <Clamped text={jobDescription} />
            </Section>

            {has(notes) && (
                <Section label="Your notes">
                    <pre className="detail-pre">{notes}</pre>
                </Section>
            )}

            {has(questions) && (
                <Section label={`Questions (${questions.length})`}>
                    <ol className="dump-list">
                        {questions.map((q, i) => <li key={i}>{q}</li>)}
                    </ol>
                </Section>
            )}
        </div>
    )
}
