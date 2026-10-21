import { useState } from 'react'
import EditableSection from '../common/EditableSection'
import Progress from '../common/Progress'
import { TextField, TextAreaField } from '../common/fields'
import { LETTER_REVIEW_PHRASES } from '../common/phrases'
import { ANGLES, blankBlock, parseBankText } from '../../lib/letterBank'
import '../Onboarding/DumpReview.css'
import './LetterBank.css'

const has = v => Array.isArray(v) ? v.length > 0 : Boolean(v && String(v).trim())

const KIND_LABEL = {
    typo:      'Typo',
    run_on:    'Run-on',
    structure: 'Structure',
    clarity:   'Clarity',
}

/**
 * Angle chips: the fixed list plus whatever the user has added. Selected
 * custom tags stay visible as chips so they can be turned off again.
 */
function AngleChips({ value = [], onChange }) {
    const [custom, setCustom] = useState('')
    const selected = new Set(value)
    const options = [...ANGLES, ...value.filter(a => !ANGLES.includes(a))]
    const toggle = a => onChange(selected.has(a) ? value.filter(x => x !== a) : [...value, a])

    function addCustom() {
        const tag = custom.trim()
        if (!tag) return
        if (!selected.has(tag)) onChange([...value, tag])
        setCustom('')
    }

    return (
        <div className="field-row">
            <span className="field-name">Angles — the kinds of role this paragraph suits</span>
            <div className="chip-row angle-chips">
                {options.map(a => (
                    <button
                        key={a} type="button"
                        className={`chip angle-chip${selected.has(a) ? ' is-on' : ''}`}
                        aria-pressed={selected.has(a)}
                        onClick={() => toggle(a)}
                    >{a}</button>
                ))}
            </div>
            <div className="angle-custom">
                <input
                    className="input"
                    value={custom}
                    placeholder="Add your own"
                    aria-label="Add your own angle"
                    onChange={e => setCustom(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
                />
                <button type="button" className="btn btn-sm" onClick={addCustom} disabled={!custom.trim()}>Add</button>
            </div>
        </div>
    )
}

const move = (list, from, to) => {
    if (to < 0 || to >= list.length) return list
    const next = [...list]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    return next
}

/** The bank in edit mode: one card per paragraph, plus paste-to-import. */
function BankEditor({ draft, setDraft }) {
    const [pasting, setPasting] = useState(false)
    const [pasted, setPasted] = useState('')
    const update = (i, patch) => setDraft(draft.map((b, j) => j === i ? { ...b, ...patch } : b))
    const preview = pasting ? parseBankText(pasted) : []

    return (
        <div className="entry-editor">
            {draft.map((b, i) => (
                <fieldset className="entry-card" key={i}>
                    <legend className="entry-card-legend">Paragraph {i + 1}</legend>
                    <div className="row-controls">
                        <button type="button" className="icon-btn" aria-label="Move up" title="Move up"
                            disabled={i === 0} onClick={() => setDraft(move(draft, i, i - 1))}>↑</button>
                        <button type="button" className="icon-btn" aria-label="Move down" title="Move down"
                            disabled={i === draft.length - 1} onClick={() => setDraft(move(draft, i, i + 1))}>↓</button>
                        <button type="button" className="icon-btn is-remove" aria-label={`Remove paragraph ${i + 1}`}
                            title="Remove" onClick={() => setDraft(draft.filter((_, j) => j !== i))}>×</button>
                    </div>
                    <TextField
                        label="Name" value={b.label} placeholder="How I got started"
                        onChange={v => update(i, { label: v })}
                    />
                    <TextAreaField
                        label="Paragraph" rows={6} value={b.text}
                        placeholder="Write it the way you'd say it. Use [company] or [role] where the employer's name or the job title should go."
                        onChange={v => update(i, { text: v })}
                    />
                    <AngleChips value={b.angles ?? []} onChange={v => update(i, { angles: v })} />
                </fieldset>
            ))}

            <div className="bank-add">
                <button type="button" className="btn btn-sm" onClick={() => setDraft([...draft, blankBlock()])}>
                    Add paragraph
                </button>
                <button type="button" className="link-btn" onClick={() => setPasting(v => !v)}>
                    {pasting ? 'Cancel paste' : 'Paste several at once'}
                </button>
            </div>

            {pasting && (
                <div className="bank-paste">
                    <TextAreaField
                        label="Paste paragraphs"
                        rows={8}
                        value={pasted}
                        onChange={setPasted}
                        placeholder={'Separate paragraphs with a blank line. To name them, put a name in square brackets on its own line above each one:\n\n[how I started]\nYour paragraph…\n\n[why this work]\nYour paragraph…'}
                    />
                    <div className="bank-paste-actions">
                        <span className="placement-note">
                            {preview.length
                                ? `${preview.length} paragraph${preview.length === 1 ? '' : 's'} found`
                                : 'Nothing found yet'}
                        </span>
                        <button
                            type="button" className="btn btn-primary btn-sm"
                            disabled={!preview.length}
                            onClick={() => { setDraft([...draft, ...preview]); setPasted(''); setPasting(false) }}
                        >
                            Add {preview.length || ''} to the bank
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

function BankView({ blocks }) {
    return blocks.map((b, i) => (
        <div className="entry bank-entry" key={b.key || i}>
            <div className="entry-title">{b.label || `Paragraph ${i + 1}`}</div>
            {has(b.angles) && (
                <div className="chip-row">
                    {b.angles.map(a => <span key={a} className="chip">{a}</span>)}
                </div>
            )}
            {has(b.text)
                ? <p className="entry-body">{b.text}</p>
                : <p className="entry-body bank-unwritten">Not written yet. Builds skip it until it has text.</p>}
        </div>
    ))
}

/**
 * One proofreading note, like the dump review's revision cards: the original
 * highlighted, the note, and a box for the fix. Done once the quoted text is
 * no longer in the paragraph, however that happened, so nothing needs
 * remembering across reloads.
 */
function RevisionCard({ revision, block, onAccept }) {
    const [edit, setEdit] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(null)
    const done = !block || !block.text.includes(revision.original)

    async function accept() {
        setBusy(true)
        setError(null)
        try {
            await onAccept(edit.trim())
        } catch (err) {
            setError(err?.message || 'Could not save')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className={`revision-card${done ? ' is-accepted' : ''}`}>
            <div className="revision-original">{revision.original}</div>
            <div className="revision-note">
                <span className="bank-kind">{KIND_LABEL[revision.kind] ?? revision.kind}</span>
                {block?.label && <span className="bank-where"> in {block.label}</span>} — {revision.note}
            </div>
            <div className="revision-body">
                {done ? (
                    <span className="accepted-badge">✓ {block ? 'Fixed' : 'Paragraph removed'}</span>
                ) : (
                    <>
                        <textarea
                            className="revision-textarea input"
                            value={edit}
                            onChange={e => setEdit(e.target.value)}
                            placeholder={revision.suggested_edit}
                            aria-label="Your fix"
                            rows={2}
                        />
                        <div className="revision-actions">
                            {revision.suggested_edit && !edit ? (
                                <button type="button" className="revision-use-suggestion" onClick={() => setEdit(revision.suggested_edit)}>
                                    Start from the suggestion
                                </button>
                            ) : <span />}
                            <button type="button" className="btn btn-primary btn-sm" onClick={accept} disabled={!edit.trim() || busy}>
                                {busy ? 'Saving…' : 'Accept'}
                            </button>
                        </div>
                        {error && <p className="editable-error" role="alert">{error}</p>}
                    </>
                )}
            </div>
        </div>
    )
}

/**
 * A facet worth writing about. Answered in place, like a review question:
 * what you type becomes a new paragraph, word for word.
 */
function PromptCard({ prompt, onAdd }) {
    const [label, setLabel] = useState('')
    const [text, setText] = useState('')
    const [state, setState] = useState('idle') // 'idle' | 'saving' | 'added'
    const [error, setError] = useState(null)

    async function add() {
        setState('saving')
        setError(null)
        try {
            await onAdd({ label: label.trim() || prompt.angle || 'New paragraph', text: text.trim(), angles: prompt.angle ? [prompt.angle] : [] })
            setState('added')
        } catch (err) {
            setError(err?.message || 'Could not save')
            setState('idle')
        }
    }

    return (
        <div className={`question-card${state === 'added' ? ' is-placed' : ''}`}>
            <div className="question-text">{prompt.prompt}</div>
            {has(prompt.reason) && <div className="question-reference">{prompt.reason}</div>}
            {has(prompt.angle) && (
                <div className="question-destination">Angle: <strong>{prompt.angle}</strong></div>
            )}
            <div className="question-body">
                {state === 'added' ? (
                    <span className="accepted-badge">✓ Added to your paragraphs</span>
                ) : (
                    <>
                        <textarea
                            className="question-textarea input"
                            value={text}
                            onChange={e => setText(e.target.value)}
                            placeholder="Write it in your own words… (optional)"
                            rows={4}
                        />
                        {text.trim() && (
                            <div className="placement-actions">
                                <input
                                    className="input bank-prompt-label"
                                    value={label}
                                    onChange={e => setLabel(e.target.value)}
                                    placeholder="Name it (optional)"
                                    aria-label="Paragraph name"
                                />
                                <button type="button" className="btn btn-primary btn-sm" onClick={add} disabled={state === 'saving'}>
                                    {state === 'saving' ? 'Saving…' : 'Add paragraph'}
                                </button>
                            </div>
                        )}
                        {error && <p className="editable-error" role="alert">{error}</p>}
                    </>
                )}
            </div>
        </div>
    )
}

/**
 * The cover-letter paragraph bank: paragraphs the user wrote about themselves,
 * which letters are built from, plus the proofreading review.
 *
 * Props:
 *   bank:        { blocks, review } | null
 *   onSave:      async (blocks) => void — throws on failure
 *   onReview:    async () => void — starts a review; omit to hide the button
 *   review:      { running: boolean, startedAt: number|null, error: string|null }
 */
export default function LetterBankPanel({ bank, onSave, onReview, review: reviewState = null }) {
    const blocks = bank?.blocks ?? []
    const review = bank?.review ?? null
    const written = blocks.filter(b => has(b.text))
    const running = Boolean(reviewState?.running)

    const replaceIn = (key, original, replacement) =>
        onSave(blocks.map(b => (b.key === key ? { ...b, text: b.text.replace(original, replacement) } : b)))

    const revisions = review?.revisions ?? []
    const prompts = review?.prompts ?? []
    const error = reviewState?.error || review?.error

    return (
        <div className="dump letter-bank">
            <div className="panel-head"><h2 className="panel-title">Cover letter paragraphs</h2></div>
            <p className="bank-intro">
                Write about yourself in your own voice, a paragraph at a time. Each letter is built
                from these: the right ones are picked and ordered for the job, and the only wording
                change allowed is verb tense, so paragraphs read smoothly together.
            </p>

            <EditableSection
                label={`Paragraphs${blocks.length ? ` (${blocks.length})` : ''}`}
                value={blocks}
                onSave={onSave}
                isEmpty={v => !has(v)}
                empty="No paragraphs yet. Start with how you got here, what you've built, and why you'd want the next role."
                view={v => <BankView blocks={v} />}
                edit={(d, set) => <BankEditor draft={d ?? []} setDraft={set} />}
            />

            {onReview && (
                <section className="block">
                    <div className="block-head">
                        <p className="section-label">Proofread &amp; ideas</p>
                        <button
                            type="button" className="btn btn-sm"
                            onClick={onReview}
                            disabled={running || written.length === 0}
                            title={written.length === 0 ? 'Write a paragraph first' : undefined}
                        >
                            {review ? 'Check again' : 'Check my paragraphs'}
                        </button>
                    </div>
                    <p className="bank-hint">
                        Flags typos, run-on sentences and hard-to-follow structure without touching
                        your voice, and suggests things you could write about next.
                    </p>

                    {running && <Progress phrases={LETTER_REVIEW_PHRASES} startedAt={reviewState.startedAt ?? undefined} />}

                    {!running && error && (
                        <div className="alert alert-error" role="alert"><strong>The check didn&rsquo;t finish.</strong> {error}</div>
                    )}

                    {!running && review && !review.error && revisions.length === 0 && (
                        <p className="bank-hint">No typos, run-ons or structural problems found.</p>
                    )}

                    {!running && revisions.map((r, i) => (
                        <RevisionCard
                            key={`${r.key}-${i}`}
                            revision={r}
                            block={blocks.find(b => b.key === r.key)}
                            onAccept={replacement => replaceIn(r.key, r.original, replacement)}
                        />
                    ))}

                    {!running && prompts.length > 0 && (
                        <>
                            <p className="section-label bank-subhead">Worth writing about</p>
                            {prompts.map((p, i) => (
                                <PromptCard key={i} prompt={p} onAdd={block => onSave([...blocks, block])} />
                            ))}
                        </>
                    )}
                </section>
            )}
        </div>
    )
}
