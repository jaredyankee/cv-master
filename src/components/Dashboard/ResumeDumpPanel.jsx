import EditableSection from '../common/EditableSection'
import { TextField, TextAreaField, StringListEditor, EntryListEditor } from '../common/fields'

/**
 * The resume dump, one section per schema category, each independently
 * editable. Empty sections still render their heading when editing is
 * available — otherwise there would be no way to add a first entry.
 *
 * Props:
 *   dump:              ResumeDump
 *   answeredQuestions: { question, answer }[]
 *   onSave:            async (patch) => void — a partial dump; omit to make
 *                      the panel read-only
 *   dumpState:         'READY' | 'NEW' | 'REVISE'
 *   header:            node rendered under the panel title — the regenerate
 *                      control and the cached-profile chip
 *   onResume():        continue an interrupted regeneration
 */

const has = v => Array.isArray(v) ? v.length > 0 : Boolean(v && String(v).trim())
const href = link => /^https?:\/\//i.test(link) ? link : `https://${link}`
const dates = (start, end) => [start, end].filter(has).join(' – ')

const blankRole    = () => ({ company: '', title: '', startDate: '', endDate: '', description: '', excludeFromResume: false })
const blankProject = () => ({ name: '', description: '', links: [], excludeFromResume: false })
const blankSchool  = () => ({ school: '', degree: '', field: '', startDate: '', endDate: '', notes: '' })
const blankSkill   = () => ({ category: '', items: [] })

/** Shared by every entry type that can be held back from a resume. */
const CONTEXT_ONLY_FIELD = {
    key: 'excludeFromResume',
    type: 'checkbox',
    label: 'Context only — keep off built resumes',
    hint: 'The model still reads it when judging fit and explaining your timeline, but never puts it on a resume. For NDA work, vague client jobs, or a role that only exists to explain a date range.',
}

const ROLE_FIELDS = [
    { key: 'company',     label: 'Company' },
    { key: 'title',       label: 'Title' },
    { key: 'startDate',   label: 'Start', mono: true, placeholder: '2023-05' },
    { key: 'endDate',     label: 'End',   mono: true, placeholder: 'Present' },
    { key: 'description', label: 'What you did', type: 'textarea', rows: 5 },
    CONTEXT_ONLY_FIELD,
]

const SCHOOL_FIELDS = [
    { key: 'school',    label: 'School' },
    { key: 'degree',    label: 'Degree', placeholder: 'BS' },
    { key: 'field',     label: 'Field',  placeholder: 'Computer Science' },
    { key: 'startDate', label: 'Start',  mono: true },
    { key: 'endDate',   label: 'End',    mono: true },
    { key: 'notes',     label: 'Notes',  type: 'textarea', rows: 2 },
]

const PROJECT_FIELDS = [
    { key: 'name',        label: 'Name' },
    { key: 'description', label: 'Description', type: 'textarea', rows: 3 },
    CONTEXT_ONLY_FIELD,
]

// ── read views ───────────────────────────────────────────────

function Links({ links }) {
    if (!has(links)) return null
    return (
        <div className="chip-row">
            {links.map((l, i) => (
                <a key={i} className="chip chip-link" href={href(l)} target="_blank" rel="noreferrer">{l}</a>
            ))}
        </div>
    )
}

/** Marks an entry the user has held back from built resumes. */
function ContextTag() {
    return (
        <span className="context-tag" title="Used for fit analysis, never placed on a built resume">
            Context only
        </span>
    )
}

function RoleView({ entries }) {
    return entries.map((e, i) => (
        <div className={`entry${e.excludeFromResume ? ' is-context-only' : ''}`} key={i}>
            <div className="entry-head">
                <div>
                    <div className="entry-title">
                        {e.title || e.company}
                        {e.excludeFromResume && <ContextTag />}
                    </div>
                    {has(e.title) && has(e.company) && <div className="entry-sub">{e.company}</div>}
                </div>
                <div className="entry-dates">{dates(e.startDate, e.endDate)}</div>
            </div>
            {has(e.description) && <p className="entry-body">{e.description}</p>}
        </div>
    ))
}

function SchoolView({ entries }) {
    return entries.map((e, i) => {
        const degree = [e.degree, e.field].filter(has).join(', ')
        return (
            <div className="entry" key={i}>
                <div className="entry-head">
                    <div>
                        <div className="entry-title">{e.school}</div>
                        {has(degree) && <div className="entry-sub">{degree}</div>}
                    </div>
                    <div className="entry-dates">{dates(e.startDate, e.endDate)}</div>
                </div>
                {has(e.notes) && <p className="entry-body">{e.notes}</p>}
            </div>
        )
    })
}

/**
 * Answers that belong to no section. A placed answer is already visible inside
 * the entry it extended, so showing it here again would double-count it.
 *
 * These are context in the same sense as an entry marked excludeFromResume:
 * the model reads them when judging fit, and they never reach a built resume.
 * The styling says so rather than leaving the user to guess.
 */
function ContextAnswers({ answers = [] }) {
    const loose = answers.filter(a => !a.placed && has(a.answer))
    if (loose.length === 0) return null

    return (
        <>
            {loose.map((qa, i) => (
                <div className="entry is-context-only" key={i}>
                    <div className="entry-sub">
                        {qa.question}
                        <ContextTag />
                    </div>
                    <p className="entry-body">{qa.answer}</p>
                </div>
            ))}
        </>
    )
}

function DumpSection({ label, children }) {
    return (
        <section className="dump-section">
            <p className="section-label">{label}</p>
            {children}
        </section>
    )
}

function ProjectView({ entries }) {
    return entries.map((p, i) => (
        <div className={`entry${p.excludeFromResume ? ' is-context-only' : ''}`} key={i}>
            <div className="entry-title">
                {p.name}
                {p.excludeFromResume && <ContextTag />}
            </div>
            {has(p.description) && <p className="entry-body">{p.description}</p>}
            <Links links={p.links} />
        </div>
    ))
}

// ── panel ────────────────────────────────────────────────────

export default function ResumeDumpPanel({
    dump,
    answeredQuestions = [],
    onSave,
    dumpState = 'READY',
    header = null,
    onResume,
}) {
    if (!dump) return null

    const {
        contact = {}, positioning, education = [], experience = [], freelance = [],
        projects = [], portfolio, skills = [], gaps = [], workingStyle, lookingFor,
    } = dump

    const contactBits = [contact.location, contact.email, contact.phone].filter(has)

    const panelHead = (
        <>
            <div className="panel-head"><h2 className="panel-title">Resume dump</h2></div>
            {header}
        </>
    )

    // Mid-regeneration the live profile has been emptied on purpose. Rendering
    // a dozen "No roles yet" sections would read as data loss, so the panel
    // says what is actually going on and offers the way back into the flow.
    if (dumpState !== 'READY') {
        return (
            <div className="dump">
                {panelHead}
                <div className="empty dump-regenerating">
                    <p className="empty-title">
                        {dumpState === 'REVISE' ? 'Revision in progress' : 'Starting over'}
                    </p>
                    <p className="empty-hint">
                        {dumpState === 'REVISE'
                            ? 'Your profile is cleared while you rework the text you wrote. Nothing is final until you submit it and finish the review.'
                            : 'Your profile is cleared while you write a new one. Nothing is final until you submit it and finish the review.'}
                    </p>
                    {onResume && (
                        <button type="button" className="btn btn-primary" onClick={onResume}>
                            {dumpState === 'REVISE' ? 'Continue revising' : 'Write your profile'}
                        </button>
                    )}
                </div>
            </div>
        )
    }

    // Read-only mode: no save handler, so render the plain views.
    if (!onSave) {
        return (
            <div className="dump">
                {panelHead}
                <ReadOnlyDump dump={dump} answeredQuestions={answeredQuestions} />
            </div>
        )
    }

    const save = patch => onSave(patch)

    return (
        <div className="dump">
            {panelHead}

            <EditableSection
                label="Contact"
                value={contact}
                onSave={v => save({ contact: v })}
                isEmpty={v => !has(v?.name) && !has(v?.email)}
                empty="No contact details yet."
                view={v => (
                    <div className="dump-contact">
                        {has(v.name) && <div className="dump-name">{v.name}</div>}
                        {contactBits.length > 0 && (
                            <div className="dump-contact-row">
                                {contactBits.map((b, i) => <span key={i}>{b}</span>)}
                            </div>
                        )}
                        <Links links={v.links} />
                    </div>
                )}
                edit={(d, set) => (
                    <>
                        <TextField label="Name"     value={d.name}     onChange={v => set({ ...d, name: v })} />
                        <TextField label="Email"    value={d.email}    onChange={v => set({ ...d, email: v })} type="email" />
                        <TextField label="Phone"    value={d.phone}    onChange={v => set({ ...d, phone: v })} mono />
                        <TextField label="Location" value={d.location} onChange={v => set({ ...d, location: v })} />
                        <StringListEditor
                            label="Links" value={d.links} itemLabel="link" addLabel="Add link"
                            placeholder="https://github.com/you"
                            onChange={v => set({ ...d, links: v })}
                        />
                    </>
                )}
            />

            <EditableSection
                label="Positioning"
                value={positioning ?? ''}
                onSave={v => save({ positioning: v })}
                isEmpty={v => !has(v)}
                empty="How would you describe yourself professionally?"
                view={v => <p className="dump-positioning">{v}</p>}
                edit={(d, set) => (
                    <TextAreaField
                        label="Preferred positioning" value={d} onChange={set} rows={3}
                        placeholder="Full-stack developer specializing in…"
                    />
                )}
            />

            <EditableSection
                label={`Experience${experience.length ? ` (${experience.length})` : ''}`}
                value={experience}
                onSave={v => save({ experience: v })}
                isEmpty={v => !has(v)}
                empty="No roles yet."
                view={v => <RoleView entries={v} />}
                edit={(d, set) => (
                    <EntryListEditor
                        value={d} onChange={set} fields={ROLE_FIELDS} blank={blankRole}
                        entryLabel="Role" addLabel="Add role"
                    />
                )}
            />

            <EditableSection
                label={`Freelance & independent${freelance.length ? ` (${freelance.length})` : ''}`}
                value={freelance}
                onSave={v => save({ freelance: v })}
                isEmpty={v => !has(v)}
                empty="No independent work yet."
                view={v => <RoleView entries={v} />}
                edit={(d, set) => (
                    <EntryListEditor
                        value={d} onChange={set} fields={ROLE_FIELDS} blank={blankRole}
                        entryLabel="Engagement" addLabel="Add engagement"
                    />
                )}
            />

            <EditableSection
                label={`Projects${projects.length ? ` (${projects.length})` : ''}`}
                value={projects}
                onSave={v => save({ projects: v })}
                isEmpty={v => !has(v)}
                empty="No projects yet."
                view={v => <ProjectView entries={v} />}
                edit={(d, set) => (
                    <EntryListEditor
                        value={d} onChange={set} fields={PROJECT_FIELDS} blank={blankProject}
                        list={{ key: 'links', label: 'Links', itemLabel: 'link', addLabel: 'Add link' }}
                        entryLabel="Project" addLabel="Add project"
                    />
                )}
            />

            <EditableSection
                label="Education"
                value={education}
                onSave={v => save({ education: v })}
                isEmpty={v => !has(v)}
                empty="No education yet."
                view={v => <SchoolView entries={v} />}
                edit={(d, set) => (
                    <EntryListEditor
                        value={d} onChange={set} fields={SCHOOL_FIELDS} blank={blankSchool}
                        entryLabel="School" addLabel="Add school"
                    />
                )}
            />

            <EditableSection
                label="Portfolio"
                value={portfolio ?? ''}
                onSave={v => save({ portfolio: v })}
                isEmpty={v => !has(v)}
                empty="No portfolio link yet."
                view={v => /^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v.trim())
                    ? <a className="dump-link" href={href(v.trim())} target="_blank" rel="noreferrer">{v}</a>
                    : <p className="dump-text">{v}</p>}
                edit={(d, set) => <TextField label="Portfolio" value={d} onChange={set} placeholder="yoursite.com" />}
            />

            <EditableSection
                label="Skills"
                value={skills}
                onSave={v => save({ skills: v })}
                isEmpty={v => !has(v)}
                empty="No skills yet."
                view={v => v.map((s, i) => (
                    <div key={i} className="skill-row">
                        <span className="skill-category">{s.category}</span>
                        <div className="chip-row">
                            {(s.items ?? []).map((item, j) => <span key={j} className="chip">{item}</span>)}
                        </div>
                    </div>
                ))}
                edit={(d, set) => (
                    <EntryListEditor
                        value={d} onChange={set} blank={blankSkill}
                        fields={[{ key: 'category', label: 'Category', placeholder: 'Languages' }]}
                        list={{ key: 'items', label: 'Skills', itemLabel: 'skill', addLabel: 'Add skill' }}
                        entryLabel="Group" addLabel="Add group"
                    />
                )}
            />

            <EditableSection
                label="Gaps"
                value={gaps}
                onSave={v => save({ gaps: v })}
                isEmpty={v => !has(v)}
                empty="Nothing noted. These are quals you know you're missing."
                view={v => <ul className="bullets">{v.map((g, i) => <li key={i}>{g}</li>)}</ul>}
                edit={(d, set) => (
                    <StringListEditor
                        value={d} onChange={set} itemLabel="gap" addLabel="Add gap"
                        placeholder="No formal Kubernetes experience"
                    />
                )}
            />

            <EditableSection
                label="Working style"
                value={workingStyle ?? ''}
                onSave={v => save({ workingStyle: v })}
                isEmpty={v => !has(v)}
                empty="Autonomous, collaborative, leading?"
                view={v => <p className="dump-text">{v}</p>}
                edit={(d, set) => <TextAreaField label="Working style" value={d} onChange={set} rows={3} />}
            />

            <EditableSection
                label="Looking for"
                value={lookingFor ?? ''}
                onSave={v => save({ lookingFor: v })}
                isEmpty={v => !has(v)}
                empty="Remote, title, pay, location — this drives fit scoring."
                view={v => <p className="dump-text">{v}</p>}
                edit={(d, set) => (
                    <TextAreaField
                        label="Looking for" value={d} onChange={set} rows={3}
                        placeholder="Remote-first, senior full-stack, $150k+"
                    />
                )}
            />

            {answeredQuestions.some(a => !a.placed && has(a.answer)) && (
                <section className="dump-section">
                    <p className="section-label">Answers kept as context</p>
                    <ContextAnswers answers={answeredQuestions} />
                </section>
            )}
        </div>
    )
}

/**
 * Plain render used when no save handler is supplied, and by the cached-profile
 * preview — a cached dump is exactly this: a profile you can read but not edit.
 */
export function ReadOnlyDump({ dump, answeredQuestions = [] }) {
    const {
        contact = {}, positioning, education = [], experience = [], freelance = [],
        projects = [], portfolio, skills = [], gaps = [], workingStyle, lookingFor,
    } = dump
    const bits = [contact.location, contact.email, contact.phone].filter(has)

    return (
        <>
            <div className="dump-contact">
                {has(contact.name) && <div className="dump-name">{contact.name}</div>}
                {bits.length > 0 && <div className="dump-contact-row">{bits.map((b, i) => <span key={i}>{b}</span>)}</div>}
                <Links links={contact.links} />
            </div>
            {has(positioning) && <DumpSection label="Positioning"><p className="dump-positioning">{positioning}</p></DumpSection>}
            {has(experience) && <DumpSection label={`Experience (${experience.length})`}><RoleView entries={experience} /></DumpSection>}
            {has(freelance) && <DumpSection label={`Freelance & independent (${freelance.length})`}><RoleView entries={freelance} /></DumpSection>}
            {has(projects) && <DumpSection label={`Projects (${projects.length})`}><ProjectView entries={projects} /></DumpSection>}
            {has(education) && <DumpSection label="Education"><SchoolView entries={education} /></DumpSection>}
            {has(portfolio) && <DumpSection label="Portfolio"><p className="dump-text">{portfolio}</p></DumpSection>}
            {has(skills) && (
                <DumpSection label="Skills">
                    {skills.map((s, i) => (
                        <div key={i} className="skill-row">
                            <span className="skill-category">{s.category}</span>
                            <div className="chip-row">{(s.items ?? []).map((it, j) => <span key={j} className="chip">{it}</span>)}</div>
                        </div>
                    ))}
                </DumpSection>
            )}
            {has(gaps) && <DumpSection label="Gaps"><ul className="bullets">{gaps.map((g, i) => <li key={i}>{g}</li>)}</ul></DumpSection>}
            {has(workingStyle) && <DumpSection label="Working style"><p className="dump-text">{workingStyle}</p></DumpSection>}
            {has(lookingFor) && <DumpSection label="Looking for"><p className="dump-text">{lookingFor}</p></DumpSection>}
            {answeredQuestions.some(a => !a.placed && has(a.answer)) && (
                <DumpSection label="Answers kept as context">
                    <ContextAnswers answers={answeredQuestions} />
                </DumpSection>
            )}
        </>
    )
}
