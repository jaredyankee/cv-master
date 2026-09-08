/**
 * Read-only view of the resume dump, one section per schema category.
 * Empty sections are skipped so a sparse dump still reads cleanly.
 */

const has = v => Array.isArray(v) ? v.length > 0 : Boolean(v && String(v).trim())

const href = link => /^https?:\/\//i.test(link) ? link : `https://${link}`

const dates = (start, end) => [start, end].filter(has).join(' – ')

function Section({ label, children }) {
    return (
        <section className="dump-section">
            <p className="section-label">{label}</p>
            {children}
        </section>
    )
}

function Links({ links }) {
    if (!has(links)) return null
    return (
        <div className="chip-row">
            {links.map((l, i) => (
                <a key={i} className="chip chip-link" href={href(l)} target="_blank" rel="noreferrer">
                    {l}
                </a>
            ))}
        </div>
    )
}

/** Experience + freelance entries share a shape. */
function WorkEntry({ entry }) {
    return (
        <div className="entry">
            <div className="entry-head">
                <div>
                    <div className="entry-title">{entry.title || entry.company}</div>
                    {has(entry.title) && has(entry.company) && (
                        <div className="entry-sub">{entry.company}</div>
                    )}
                </div>
                <div className="entry-dates">{dates(entry.startDate, entry.endDate)}</div>
            </div>
            {has(entry.description) && <p className="entry-body">{entry.description}</p>}
        </div>
    )
}

function EducationEntry({ entry }) {
    const degree = [entry.degree, entry.field].filter(has).join(', ')
    return (
        <div className="entry">
            <div className="entry-head">
                <div>
                    <div className="entry-title">{entry.school}</div>
                    {has(degree) && <div className="entry-sub">{degree}</div>}
                </div>
                <div className="entry-dates">{dates(entry.startDate, entry.endDate)}</div>
            </div>
            {has(entry.notes) && <p className="entry-body">{entry.notes}</p>}
        </div>
    )
}

function ProjectEntry({ entry }) {
    return (
        <div className="entry">
            <div className="entry-title">{entry.name}</div>
            {has(entry.description) && <p className="entry-body">{entry.description}</p>}
            <Links links={entry.links} />
        </div>
    )
}

export default function ResumeDumpPanel({ dump, answeredQuestions = [] }) {
    if (!dump) return null
    const {
        contact = {},
        positioning,
        education = [],
        experience = [],
        freelance = [],
        projects = [],
        portfolio,
        skills = [],
        gaps = [],
        workingStyle,
        lookingFor,
    } = dump

    const contactBits = [contact.location, contact.email, contact.phone].filter(has)

    return (
        <div className="dump">
            <div className="panel-header">
                <h2 className="panel-title">Resume dump</h2>
            </div>

            {/* contact */}
            <div className="dump-contact">
                {has(contact.name) && <div className="dump-name">{contact.name}</div>}
                {contactBits.length > 0 && (
                    <div className="dump-contact-row">
                        {contactBits.map((b, i) => <span key={i}>{b}</span>)}
                    </div>
                )}
                <Links links={contact.links} />
            </div>

            {has(positioning) && (
                <Section label="Positioning">
                    <p className="dump-positioning">{positioning}</p>
                </Section>
            )}

            {has(experience) && (
                <Section label={`Experience (${experience.length})`}>
                    {experience.map((e, i) => <WorkEntry key={i} entry={e} />)}
                </Section>
            )}

            {has(freelance) && (
                <Section label={`Freelance & independent (${freelance.length})`}>
                    {freelance.map((e, i) => <WorkEntry key={i} entry={e} />)}
                </Section>
            )}

            {has(projects) && (
                <Section label={`Projects (${projects.length})`}>
                    {projects.map((p, i) => <ProjectEntry key={i} entry={p} />)}
                </Section>
            )}

            {has(education) && (
                <Section label="Education">
                    {education.map((e, i) => <EducationEntry key={i} entry={e} />)}
                </Section>
            )}

            {has(portfolio) && (
                <Section label="Portfolio">
                    {/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(portfolio.trim())
                        ? <a className="dump-link" href={href(portfolio.trim())} target="_blank" rel="noreferrer">{portfolio}</a>
                        : <p className="dump-text">{portfolio}</p>}
                </Section>
            )}

            {has(skills) && (
                <Section label="Skills">
                    {skills.map((s, i) => (
                        <div key={i} className="skill-row">
                            <span className="skill-category">{s.category}</span>
                            <div className="chip-row">
                                {(s.items ?? []).map((item, j) => <span key={j} className="chip">{item}</span>)}
                            </div>
                        </div>
                    ))}
                </Section>
            )}

            {has(gaps) && (
                <Section label="Gaps">
                    <ul className="dump-list">
                        {gaps.map((g, i) => <li key={i}>{g}</li>)}
                    </ul>
                </Section>
            )}

            {has(workingStyle) && (
                <Section label="Working style">
                    <p className="dump-text">{workingStyle}</p>
                </Section>
            )}

            {has(lookingFor) && (
                <Section label="Looking for">
                    <p className="dump-text">{lookingFor}</p>
                </Section>
            )}

            {answeredQuestions.length > 0 && (
                <Section label="Your answers">
                    {answeredQuestions.map((qa, i) => (
                        <div key={i} className="entry">
                            <div className="entry-sub">{qa.question}</div>
                            <p className="entry-body">{qa.answer}</p>
                        </div>
                    ))}
                </Section>
            )}
        </div>
    )
}
