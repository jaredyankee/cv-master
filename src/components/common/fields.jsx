import './fields.css'

/**
 * Form primitives for the section editors.
 *
 * All of them are controlled and shape-agnostic: they take a value and an
 * onChange, and never mutate what they are given. List editors always produce
 * a new array so React sees the change.
 */

let uid = 0
const nextId = () => `f${++uid}`

// ── single fields ────────────────────────────────────────────

export function TextField({ label, value, onChange, placeholder, mono = false, type = 'text' }) {
    const id = `${label}-${nextId()}`
    return (
        <label className="field-row" htmlFor={id}>
            <span className="field-name">{label}</span>
            <input
                id={id}
                type={type}
                className={`input${mono ? ' is-mono' : ''}`}
                value={value ?? ''}
                placeholder={placeholder}
                onChange={e => onChange(e.target.value)}
            />
        </label>
    )
}

export function TextAreaField({ label, value, onChange, placeholder, rows = 4 }) {
    const id = `${label}-${nextId()}`
    return (
        <label className="field-row" htmlFor={id}>
            <span className="field-name">{label}</span>
            <textarea
                id={id}
                className="input"
                rows={rows}
                value={value ?? ''}
                placeholder={placeholder}
                onChange={e => onChange(e.target.value)}
            />
        </label>
    )
}

export function CheckboxField({ label, hint, value, onChange }) {
    const id = `${label}-${nextId()}`
    return (
        <div className="field-row">
            <label className="check-row" htmlFor={id}>
                <input
                    id={id}
                    type="checkbox"
                    className="check-box"
                    checked={Boolean(value)}
                    onChange={e => onChange(e.target.checked)}
                />
                <span className="check-label">{label}</span>
            </label>
            {hint && <p className="check-hint">{hint}</p>}
        </div>
    )
}

// ── reorder controls ─────────────────────────────────────────

/** Up/down rather than drag: keyboard-reachable and no dependency. */
function Reorder({ index, count, onMove, onRemove, removeLabel }) {
    return (
        <div className="row-controls">
            <button
                type="button" className="icon-btn" title="Move up"
                aria-label="Move up" disabled={index === 0}
                onClick={() => onMove(index, index - 1)}
            >↑</button>
            <button
                type="button" className="icon-btn" title="Move down"
                aria-label="Move down" disabled={index === count - 1}
                onClick={() => onMove(index, index + 1)}
            >↓</button>
            <button
                type="button" className="icon-btn is-remove" title={removeLabel}
                aria-label={removeLabel} onClick={() => onRemove(index)}
            >×</button>
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

// ── list of strings ──────────────────────────────────────────

export function StringListEditor({
    label,
    value = [],
    onChange,
    placeholder = '',
    addLabel = 'Add item',
    itemLabel = 'item',
}) {
    const items = Array.isArray(value) ? value : []

    return (
        <div className="field-row">
            {label && <span className="field-name">{label}</span>}
            <div className="list-editor">
                {items.map((item, i) => (
                    <div className="list-row" key={i}>
                        <input
                            className="input"
                            value={item ?? ''}
                            placeholder={placeholder}
                            aria-label={`${itemLabel} ${i + 1}`}
                            onChange={e => onChange(items.map((v, j) => j === i ? e.target.value : v))}
                        />
                        <Reorder
                            index={i}
                            count={items.length}
                            onMove={(from, to) => onChange(move(items, from, to))}
                            onRemove={idx => onChange(items.filter((_, j) => j !== idx))}
                            removeLabel={`Remove ${itemLabel} ${i + 1}`}
                        />
                    </div>
                ))}
                <button type="button" className="btn btn-sm" onClick={() => onChange([...items, ''])}>
                    {addLabel}
                </button>
            </div>
        </div>
    )
}

// ── list of objects ──────────────────────────────────────────

/**
 * Repeating entries (a job, a degree, a project).
 *
 * @param {object[]} fields  [{ key, label, type?: 'text'|'textarea', mono? }]
 * @param {object}   list    optional trailing string-array field:
 *                           { key, label, addLabel, itemLabel }
 * @param {function} blank   () => a new empty entry
 */
export function EntryListEditor({
    value = [],
    onChange,
    fields,
    list = null,
    blank,
    addLabel = 'Add entry',
    entryLabel = 'entry',
}) {
    const entries = Array.isArray(value) ? value : []
    const update = (i, patch) => onChange(entries.map((e, j) => j === i ? { ...e, ...patch } : e))

    return (
        <div className="entry-editor">
            {entries.map((entry, i) => (
                <fieldset className="entry-card" key={i}>
                    <legend className="entry-card-legend">
                        {entryLabel} {i + 1}
                    </legend>
                    <Reorder
                        index={i}
                        count={entries.length}
                        onMove={(from, to) => onChange(move(entries, from, to))}
                        onRemove={idx => onChange(entries.filter((_, j) => j !== idx))}
                        removeLabel={`Remove ${entryLabel} ${i + 1}`}
                    />

                    {fields.map(f => f.type === 'checkbox' ? (
                        <CheckboxField
                            key={f.key}
                            label={f.label}
                            hint={f.hint}
                            value={entry[f.key]}
                            onChange={v => update(i, { [f.key]: v })}
                        />
                    ) : f.type === 'textarea' ? (
                        <TextAreaField
                            key={f.key}
                            label={f.label}
                            value={entry[f.key]}
                            rows={f.rows ?? 4}
                            onChange={v => update(i, { [f.key]: v })}
                        />
                    ) : (
                        <TextField
                            key={f.key}
                            label={f.label}
                            value={entry[f.key]}
                            mono={f.mono}
                            placeholder={f.placeholder}
                            onChange={v => update(i, { [f.key]: v })}
                        />
                    ))}

                    {list && (
                        <StringListEditor
                            label={list.label}
                            value={entry[list.key] ?? []}
                            addLabel={list.addLabel}
                            itemLabel={list.itemLabel}
                            onChange={v => update(i, { [list.key]: v })}
                        />
                    )}
                </fieldset>
            ))}

            <button type="button" className="btn btn-sm" onClick={() => onChange([...entries, blank()])}>
                {addLabel}
            </button>
        </div>
    )
}
