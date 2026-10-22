import { useState } from 'react'
import EditableSection from '../common/EditableSection'
import Progress from '../common/Progress'
import CopyButton from '../common/CopyButton'
import Modal from '../common/Modal'
import { TextAreaField } from '../common/fields'
import { LETTER_PHRASES } from '../common/phrases'
import { diffWords } from '../../lib/letterDiff'
import { letterToText, missingMarker } from '../../lib/letterBank'
import { WARN_ON_FIT } from '../../schemas/jobApplication'
import './LetterBank.css'

const has = v => Array.isArray(v) ? v.length > 0 : Boolean(v && String(v).trim())

/** One paragraph, with every word that differs from the user's original marked. */
function BuiltParagraph({ p }) {
    if (p.kind === 'missing') {
        return <p className="letter-missing">{missingMarker(p.prompt)}</p>
    }
    const segments = p.kind === 'block' && p.source ? diffWords(p.source, p.text) : [{ text: p.text, changed: false }]
    return (
        <div className="letter-para">
            <p className="letter-text">
                {segments.map((s, i) => s.changed
                    ? <mark key={i} className="letter-changed" title="Changed from your paragraph">{s.text}</mark>
                    : <span key={i}>{s.text}</span>)}
            </p>
            <div className="letter-meta">
                {p.kind === 'written'
                    ? <span>Written here</span>
                    : <span>From: {p.label || p.key}</span>}
                {has(p.edits) && <span>Tense: {p.edits.join(', ')}</span>}
                {p.reverted && <span>The model changed more than tense, so your original is used</span>}
            </div>
        </div>
    )
}

function LetterView({ letter }) {
    return (
        <>
            <div className="letter">
                {has(letter.angle) && (
                    <p className="letter-angle">
                        Angle: <strong>{letter.angle}</strong>{has(letter.angleRationale) && <> — {letter.angleRationale}</>}
                    </p>
                )}
                {letter.paragraphs.map((p, i) => <BuiltParagraph key={i} p={p} />)}
            </div>
            {has(letter.prompts) && (
                <div className="resume-section">
                    <p className="section-label">Worth writing for roles like this</p>
                    {letter.prompts.map((p, i) => (
                        <div key={i} className="note">
                            <span className="note-label">{p.prompt}</span>
                            <p className="prose">{p.reason}{has(p.angle) && ` (angle: ${p.angle})`}</p>
                        </div>
                    ))}
                    <p className="bank-hint">Add what you write to your profile&rsquo;s cover letter paragraphs, then rebuild.</p>
                </div>
            )}
        </>
    )
}

/**
 * Editing the letter is tailoring the deliverable. A missing slot that gets
 * text becomes a paragraph you wrote here, with no source to compare against.
 */
function LetterEditor({ draft, setDraft }) {
    const update = (i, patch) => setDraft({ ...draft, paragraphs: draft.paragraphs.map((p, j) => j === i ? { ...p, ...patch } : p) })
    const remove = i => setDraft({ ...draft, paragraphs: draft.paragraphs.filter((_, j) => j !== i) })

    return draft.paragraphs.map((p, i) => (
        <div key={i} className="entry-card">
            <div className="row-controls">
                <button type="button" className="icon-btn is-remove" aria-label={`Remove paragraph ${i + 1}`}
                    title="Remove" onClick={() => remove(i)}>×</button>
            </div>
            {p.kind === 'missing' ? (
                <TextAreaField
                    label="Add something here" rows={4}
                    value={p.text ?? ''} placeholder={p.prompt}
                    onChange={v => update(i, { text: v })}
                />
            ) : (
                <TextAreaField
                    label={p.kind === 'written' ? 'Written here' : (p.label || p.key)} rows={6}
                    value={p.text} onChange={v => update(i, { text: v })}
                />
            )}
        </div>
    ))
}

const finishDraft = (draft) => ({
    ...draft,
    paragraphs: draft.paragraphs.map(p => {
        if (p.kind !== 'missing') return p
        return has(p.text) ? { kind: 'written', text: p.text.trim() } : { kind: 'missing', prompt: p.prompt }
    }),
})

/**
 * The built cover letter for one application.
 *
 * Props:
 *   application  — Application; reads coverLetter, letterPending, letterError
 *   hasBank      — whether the user has any written paragraphs
 *   onBuild()    — starts a build; omit for read-only
 *   onSave(letter) — async; throws on failure
 */
export default function CoverLetterSection({ application, hasBank, onBuild, onSave }) {
    const [confirming, setConfirming] = useState(false)
    const letter = application.coverLetter
    const built = has(letter?.paragraphs)
    const pending = application.letterPending
    const error = application.letterError ?? letter?.error ?? null
    const level = application.response?.fit_criteria?.level

    function requestBuild() {
        // Rule 5: a long shot gets an "are you sure" before it spends tokens.
        if (WARN_ON_FIT.has(level)) setConfirming(true)
        else onBuild()
    }

    const buildButton = onBuild && (
        <button
            type="button" className="btn btn-sm"
            onClick={requestBuild}
            disabled={Boolean(pending) || !hasBank}
            title={hasBank ? undefined : 'Add cover letter paragraphs to your profile first'}
        >
            {built ? 'Rebuild' : 'Build cover letter'}
        </button>
    )

    const status = (
        <>
            {pending && <Progress phrases={LETTER_PHRASES} startedAt={pending.startedAt} />}
            {!pending && error && (
                <div className="alert alert-error" role="alert"><strong>The letter didn&rsquo;t build.</strong> {error}</div>
            )}
        </>
    )

    const confirm = confirming && (
        <Modal
            title="Build a letter for a long shot?"
            onClose={() => setConfirming(false)}
            footer={
                <>
                    <button type="button" className="btn" onClick={() => setConfirming(false)}>Not now</button>
                    <button type="button" className="btn btn-primary" onClick={() => { setConfirming(false); onBuild() }}>
                        Build it anyway
                    </button>
                </>
            }
        >
            <p className="prose">
                This role came back as <strong>{level}</strong>. Building a letter is another model
                call on your key. Worth it if you plan to apply regardless.
            </p>
        </Modal>
    )

    if (!built) {
        return (
            <section className="block">
                <div className="block-head">
                    <p className="section-label">Cover letter</p>
                    {buildButton}
                </div>
                {!pending && (
                    <p className="letter-empty">
                        {hasBank
                            ? 'Built from your cover letter paragraphs: the ones that suit this role, in order, in your words.'
                            : 'Add cover letter paragraphs to your profile, then build a letter from them here.'}
                    </p>
                )}
                {status}
                {confirm}
            </section>
        )
    }

    return (
        <>
            {status}
            <EditableSection
                label="Cover letter"
                value={letter}
                onSave={onSave ? (d => onSave(finishDraft(d))) : undefined}
                action={
                    <div className="letter-actions">
                        <CopyButton text={() => letterToText(letter)} label="Copy text" copiedLabel="Copied" />
                        {buildButton}
                    </div>
                }
                view={v => <LetterView letter={v} />}
                edit={(d, set) => <LetterEditor draft={d} setDraft={set} />}
            />
            {confirm}
        </>
    )
}
