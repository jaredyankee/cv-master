import { useState } from 'react'
import FitBadge from './FitBadge'
import Progress from '../common/Progress'
import { BUILD_PHRASES } from '../common/phrases'
import { applicationLabel, formatDate, analysisState } from './applicationUtils'
import { WARN_ON_FIT } from '../../schemas/jobApplication'

const has = v => Array.isArray(v) ? v.length > 0 : Boolean(v && String(v).trim())
const dates = (start, end) => [start, end].filter(has).join(' – ')

const INTENT_LABEL = {
    qualification: 'Qualification',
    gap:           'Gap',
    culture_fit:   'Culture fit',
    warning:       'Warning',
}

function Section({ label, children, className = '' }) {
    return (
        <section className={`block ${className}`.trim()}>
            <p className="section-label">{label}</p>
            {children}
        </section>
    )
}

/** Long text with a "show more" clamp — the model is generous with prose. */
function Clamped({ text, limit = 420, long: longClamp = false, moreLabel = 'Show more', lessLabel = 'Show less' }) {
    const [open, setOpen] = useState(false)
    const overflows = text.length > limit
    const cls = ['prose', overflows && !open && 'is-clamped', longClamp && 'clamp-long']
        .filter(Boolean).join(' ')
    return (
        <div>
            <pre className={cls}>{text}</pre>
            {overflows && (
                <button type="button" className="more-btn" onClick={() => setOpen(v => !v)}>
                    {open ? lessLabel : moreLabel}
                </button>
            )}
        </div>
    )
}

function BuiltResume({ ja }) {
    return (
        <div className="resume">
            {ja.contact && (
                <header className="resume-head">
                    <h3 className="resume-name">{ja.contact.name}</h3>
                    {has(ja.contact.title) && <p className="resume-title">{ja.contact.title}</p>}
                    <p className="resume-contact">
                        {[ja.contact.location, ja.contact.email, ja.contact.phone].filter(has).map((b, i) => (
                            <span key={i}>{b}</span>
                        ))}
                    </p>
                </header>
            )}

            {has(ja.summary) && <p className="resume-summary">{ja.summary}</p>}

            {has(ja.experience) && (
                <div className="resume-section">
                    <p className="section-label">Experience</p>
                    {ja.experience.map((e, i) => (
                        <article key={i} className="entry">
                            <div className="entry-head">
                                <div>
                                    <div className="entry-title">{e.title}</div>
                                    <div className="entry-sub">{e.company}</div>
                                </div>
                                <div className="entry-dates">{dates(e.startDate, e.endDate)}</div>
                            </div>
                            {has(e.highlights) && (
                                <ul className="bullets">
                                    {e.highlights.map((h, j) => <li key={j}>{h}</li>)}
                                </ul>
                            )}
                        </article>
                    ))}
                </div>
            )}

            {has(ja.education) && (
                <div className="resume-section">
                    <p className="section-label">Education</p>
                    {ja.education.map((e, i) => (
                        <article key={i} className="entry">
                            <div className="entry-head">
                                <div className="entry-title">{e.school}</div>
                                <div className="entry-dates">{dates(e.startDate, e.endDate)}</div>
                            </div>
                            {has(e.highlights) && (
                                <ul className="bullets">
                                    {e.highlights.map((h, j) => <li key={j}>{h}</li>)}
                                </ul>
                            )}
                        </article>
                    ))}
                </div>
            )}

            {has(ja.skills) && (
                <div className="resume-section">
                    <p className="section-label">Skills</p>
                    {ja.skills.map((s, i) => (
                        <div key={i} className="skill-row">
                            <span className="skill-category">{s.category}</span>
                            <span className="skill-items">{(s.items ?? []).join(' · ')}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function CoverLetter({ cl }) {
    return (
        <>
            {has(cl.mission) && cl.mission !== 'N/A' && (
                <div className="note">
                    <span className="note-label">Mission</span>
                    <p className="prose">{cl.mission}</p>
                </div>
            )}
            {has(cl.culture) && (
                <div className="note">
                    <span className="note-label">Culture</span>
                    <p className="prose">{cl.culture}</p>
                </div>
            )}
            {(cl.intents ?? []).map((intent, i) => (
                <article key={i} className={`intent intent-${intent.category}`}>
                    <header className="intent-head">
                        <span className="intent-category">{INTENT_LABEL[intent.category] ?? intent.category}</span>
                        {typeof intent.confidence === 'number' && (
                            <span className="intent-confidence" title="How confident the model is that this belongs in the letter">
                                <span className="confidence-bar">
                                    <span style={{ width: `${Math.max(0, Math.min(100, intent.confidence))}%` }} />
                                </span>
                                {intent.confidence}
                            </span>
                        )}
                    </header>
                    <p className="prose">{intent.rationale}</p>
                    {has(intent.blurb) && <p className="intent-blurb">{intent.blurb}</p>}
                </article>
            ))}
        </>
    )
}

/**
 * One application, on its own screen: what you entered, and the model's
 * analysis once it lands. Laid out in two columns on wide viewports —
 * the built resume beside the letter outline and your own inputs.
 *
 * Props:
 *   application: Application
 *   onBack()
 */
export default function ApplicationDetail({ application, onBack }) {
    const { jobDescription = '', notes = '', questions = [], response = null, createdAt } = application
    const state = analysisState(application)

    const { fit_criteria, job_application: ja, cover_letter: cl, answers = [], ai_filter } = response ?? {}
    const aiNotes = response?.notes

    return (
        <div className="detail">
            <button type="button" className="back-btn" onClick={onBack}>
                <span aria-hidden="true">←</span> All applications
            </button>

            <header className="detail-head">
                <h1 className="detail-title">{applicationLabel(application)}</h1>
                <div className="detail-meta">
                    <span className="meta-date">Added {formatDate(createdAt)}</span>
                    {fit_criteria?.level && <FitBadge level={fit_criteria.level} />}
                </div>
            </header>

            {state === 'pending' && (
                <Progress phrases={BUILD_PHRASES} startedAt={new Date(createdAt).getTime()} />
            )}

            {state === 'failed' && (
                <div className="alert alert-error">
                    <strong>The analysis didn&rsquo;t complete.</strong> {application.error}
                </div>
            )}

            {fit_criteria && (
                <section className="fit">
                    <div className="fit-rationale">
                        <p className="section-label">Fit</p>
                        <Clamped text={fit_criteria.rationale} limit={340} moreLabel="Full rationale" lessLabel="Less" />
                        {WARN_ON_FIT.has(fit_criteria.level) && (
                            <p className="fit-warning">
                                This one may not be worth the tokens.
                            </p>
                        )}
                    </div>
                </section>
            )}

            {ai_filter?.detected && (
                <div className="alert alert-flag">
                    <strong>Hidden instruction in the posting.</strong> {ai_filter.detail}
                </div>
            )}

            <div className="detail-grid">
                <div className="detail-col">
                    {ja && (
                        <Section label="Built resume" className="block-framed">
                            <BuiltResume ja={ja} />
                        </Section>
                    )}

                    <Section label="Job description">
                        <Clamped text={jobDescription} long moreLabel="Show full description" />
                    </Section>
                </div>

                <div className="detail-col">
                    {cl && <Section label="Cover letter outline"><CoverLetter cl={cl} /></Section>}

                    {has(answers) && (
                        <Section label="Your questions, answered">
                            {answers.map((a, i) => (
                                <div key={i} className="note">
                                    <span className="note-label">{a.question}</span>
                                    <p className="prose">{a.answer}</p>
                                </div>
                            ))}
                        </Section>
                    )}

                    {has(aiNotes) && (
                        <Section label="Notes from the model">
                            <p className="prose">{aiNotes}</p>
                        </Section>
                    )}

                    {has(notes) && (
                        <Section label="Your notes">
                            <pre className="prose">{notes}</pre>
                        </Section>
                    )}

                    {has(questions) && (
                        <Section label={`Questions you added (${questions.length})`}>
                            <ol className="bullets">
                                {questions.map((q, i) => <li key={i}>{q}</li>)}
                            </ol>
                        </Section>
                    )}
                </div>
            </div>
        </div>
    )
}
