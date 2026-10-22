import { SYSTEM_PROMPTS } from "../registry/prompts.js"
import { structured } from "../lib/providers/index.js"
import { LETTER_REVIEW_TOOL, COVER_LETTER_TOOL, LETTER_REVISION_KINDS } from "../registry/schema.js"
import { getLetterBank, updateLetterBlocks, updateLetterReview, updateCoverLetter } from "../db/cover-letter.js"
import { getJobApplication } from "../db/job-applications.js"
import { shapeApplication } from "./job-application.js"
import { normalizeBlocks, fillPlaceholders, withinTenseBudget } from "../lib/letter.js"
import * as n from "../lib/normalize.js"

const str = v => (typeof v === "string" ? v.trim() : "")
const arr = v => (Array.isArray(v) ? v : [])

const MAX_PARAGRAPHS = 12
const MAX_PROMPTS    = 8

const failure = (result) => {
    const hint = result.status === 401 ? " — check the API key for this provider"
        : result.status === 429 ? " — rate limited, try again shortly"
        : ""
    return `${result.provider ?? "model"} request failed: ${result.error}${hint}`
}

const shapeBank = (row) => ({
    blocks: row?.letter_blocks ?? [],
    review: row?.letter_review ?? null,
})

/**
 * The bank as the model reads it. Only what it needs, and only paragraphs
 * with text: a titled but unwritten one is a note to self, not material.
 */
const writtenBlocks = (blocks) => arr(blocks).filter(b => str(b?.text))
const bankForPrompt = (blocks) =>
    JSON.stringify(blocks.map(b => ({ key: b.key, label: b.label, angles: b.angles, text: b.text })), null, 2)

const normalizePrompts = (prompts) =>
    arr(prompts).map(p => ({
        prompt: str(p?.prompt),
        angle:  str(p?.angle),
        reason: str(p?.reason),
    })).filter(p => p.prompt).slice(0, MAX_PROMPTS)

// ── bank ─────────────────────────────────────────────────────

/** GET /cover-letter: the bank and its latest review. */
export const getLetterBankState = async (userId) => {
    if (!userId) return { ok: false, error: "User id is missing" }
    const row = await getLetterBank(userId)
    if (!row) return { ok: false, error: "No resume dump on file for this user" }
    return { ok: true, data: shapeBank(row) }
}

/** PUT /cover-letter: the whole bank, normalized. */
export const saveLetterBank = async (userId, blocks) => {
    if (!userId) return { ok: false, error: "User id is missing" }
    if (!Array.isArray(blocks)) return { ok: false, error: "blocks must be an array" }
    const row = await updateLetterBlocks(userId, normalizeBlocks(blocks))
    if (!row) return { ok: false, error: "No resume dump on file for this user" }
    return { ok: true, data: shapeBank(row) }
}

// ── review ───────────────────────────────────────────────────

/**
 * Keeps only revisions that point at a real paragraph and quote it exactly.
 * The client applies an accepted revision by find-and-replace, so a quote
 * that isn't in the text would be an Accept button that does nothing.
 */
export function normalizeReview(input, blocks) {
    const byKey = new Map(blocks.map(b => [b.key, b]))
    return {
        revisions: arr(input?.revisions).map(r => ({
            key:            str(r?.key),
            kind:           LETTER_REVISION_KINDS.includes(r?.kind) ? r.kind : "clarity",
            original:       typeof r?.original === "string" ? r.original : "",
            note:           str(r?.note),
            suggested_edit: str(r?.suggested_edit),
        })).filter(r => r.original.trim() && byKey.get(r.key)?.text.includes(r.original)),
        prompts: normalizePrompts(input?.prompts),
    }
}

/**
 * Background: proofread the bank. Writes the result, or the error, into the
 * review slot under the client's `reviewId`, so the poll always ends.
 */
export const reviewLetterBank = async (apiKey, { userId, reviewId }, provider) => {
    if (!userId)   return { ok: false, error: "User id is missing" }
    if (!reviewId) return { ok: false, error: "Review id is missing" }

    const row = await getLetterBank(userId)
    if (!row) return { ok: false, error: "No resume dump on file for this user" }
    const blocks = writtenBlocks(row.letter_blocks)
    const record = (fields) => updateLetterReview(userId, { id: reviewId, createdAt: new Date().toISOString(), ...fields })

    if (!blocks.length) {
        await record({ error: "Add a paragraph before asking for a review.", revisions: [], prompts: [] })
        return { ok: false, error: "Empty bank" }
    }

    const sections = [`BANK:\n${bankForPrompt(blocks)}`]
    if (str(row.looking_for)) sections.push(`LOOKING FOR:\n${str(row.looking_for)}`)

    // Proofreading, not judgment: the extraction-size model is plenty.
    const result = await structured({
        provider,
        apiKey,
        role: "extraction",
        system: SYSTEM_PROMPTS.REVIEW_LETTER_BLOCKS,
        user: sections.join("\n\n"),
        tool: LETTER_REVIEW_TOOL,
        maxTokens: 6000,
    })

    if (!result.ok) {
        const error = failure(result)
        await record({ error, revisions: [], prompts: [] })
        return { ok: false, error }
    }

    await record(normalizeReview(result.data, blocks))
    return { ok: true }
}

// ── build ────────────────────────────────────────────────────

/**
 * Turns the model's selection into the stored letter. Every block paragraph
 * is checked against the bank: an unknown key is dropped, a repeat is
 * dropped, and text that drifted past a tense change is replaced by the
 * user's own. `source` is kept beside `text` so the UI can show exactly which
 * words changed, even after the bank is edited later.
 */
export function normalizeLetter(input, blocks, { company, role } = {}) {
    const byKey = new Map(blocks.map(b => [b.key, b]))
    const used = new Set()
    const fill = s => fillPlaceholders(s, { company, role })

    const paragraphs = []
    for (const p of arr(input?.paragraphs)) {
        if (paragraphs.length >= MAX_PARAGRAPHS) break
        if (p?.kind === "missing") {
            const prompt = str(p.prompt)
            if (prompt) paragraphs.push({ kind: "missing", prompt })
            continue
        }
        const block = byKey.get(str(p?.key))
        if (!block || used.has(block.key)) continue
        used.add(block.key)

        const source = fill(block.text)
        const built  = fill(str(p.text) || block.text)
        const kept   = withinTenseBudget(source, built)
        paragraphs.push({
            kind:  "block",
            key:   block.key,
            label: block.label,
            text:  kept ? built : source,
            source,
            edits: kept ? n.strList(p.edits, 20) : [],
            ...(kept ? {} : { reverted: true }),
        })
    }

    return {
        angle:          str(input?.angle),
        angleRationale: str(input?.angle_rationale),
        paragraphs,
        prompts:        normalizePrompts(input?.prompts),
    }
}

/**
 * Background: build the letter for one application. On failure the previous
 * letter, if any, is kept and the error is recorded beside it under the
 * client's `buildId`, so the poll ends and nothing the user had is lost.
 */
export const buildCoverLetter = async (apiKey, { userId, applicationId, buildId }, provider) => {
    if (!userId)        return { ok: false, error: "User id is missing" }
    if (!applicationId) return { ok: false, error: "Application id is missing" }
    if (!buildId)       return { ok: false, error: "Build id is missing" }

    const [app, bank] = await Promise.all([
        getJobApplication(userId, applicationId),
        getLetterBank(userId),
    ])
    if (!app) return { ok: false, error: "Application not found" }

    const previous = app.cl_letter ?? null
    const fail = async (error) => {
        await updateCoverLetter(userId, applicationId, { ...(previous ?? { paragraphs: [], prompts: [] }), id: buildId, error })
        return { ok: false, error }
    }

    const blocks = writtenBlocks(bank?.letter_blocks)
    if (!blocks.length) return fail("Your paragraph bank is empty. Add a paragraph to your profile first.")

    const sections = [
        `JOB DESCRIPTION:\n${str(app.job_description)}`,
        `FIT: ${app.fit_level}\n${str(app.fit_rationale)}`,
    ]
    if (str(app.notes)) sections.push(`NOTES FROM THE CANDIDATE:\n${str(app.notes)}`)

    // The bank rides in the system prompt, like the dump does for the
    // resume: it is the same text for every letter this user builds.
    const result = await structured({
        provider,
        apiKey,
        role: "reasoning",
        system: [SYSTEM_PROMPTS.BUILD_COVER_LETTER, `BANK:\n${bankForPrompt(blocks)}`].join("\n\n"),
        user: sections.join("\n\n"),
        tool: COVER_LETTER_TOOL,
        maxTokens: 8000,
        thinking: { type: "adaptive" },
    })
    if (!result.ok) return fail(failure(result))

    const letter = normalizeLetter(result.data, blocks, { company: str(app.company_name), role: str(app.job_title) })
    if (!letter.paragraphs.length) return fail("The model didn't select any paragraphs. Try again, or add paragraphs that suit this role.")

    const row = await updateCoverLetter(userId, applicationId, {
        id: buildId,
        builtAt: new Date().toISOString(),
        ...letter,
    })
    return row ? { ok: true, application: shapeApplication(row) } : { ok: false, error: "Application not found" }
}

// ── edit ─────────────────────────────────────────────────────

/**
 * Coerces a user-edited letter. A filled-in missing slot arrives as
 * kind=written: the user's own words, with no source to compare against.
 */
export const normalizeEditedLetter = (letter) => {
    const l = letter ?? {}
    return {
        id:             n.str(l.id),
        builtAt:        n.str(l.builtAt),
        angle:          n.str(l.angle),
        angleRationale: n.text(l.angleRationale),
        paragraphs: n.objList(l.paragraphs, p => {
            if (p.kind === "missing") return { kind: "missing", prompt: n.text(p.prompt) }
            if (p.kind === "written") return { kind: "written", text: n.text(p.text) }
            return {
                kind:   "block",
                key:    n.str(p.key),
                label:  n.str(p.label),
                text:   n.text(p.text),
                source: n.text(p.source),
                edits:  n.strList(p.edits, 20),
                ...(p.reverted ? { reverted: true } : {}),
            }
        }, p => (p.kind === "missing" ? p.prompt : p.text)).slice(0, MAX_PARAGRAPHS),
        prompts: n.objList(l.prompts, p => ({
            prompt: n.text(p.prompt),
            angle:  n.str(p.angle),
            reason: n.text(p.reason),
        }), p => p.prompt).slice(0, MAX_PROMPTS),
    }
}

/** PUT /job-application?id=… body { cover_letter }. */
export const saveCoverLetter = async (userId, id, letter) => {
    if (!userId) return { ok: false, error: "User id is missing" }
    if (!id)     return { ok: false, error: "Application id is missing" }
    if (!letter || typeof letter !== "object") return { ok: false, error: "cover_letter is missing" }

    const row = await updateCoverLetter(userId, id, normalizeEditedLetter(letter))
    if (!row) return { ok: false, error: "Application not found" }
    return { ok: true, application: shapeApplication(row) }
}
