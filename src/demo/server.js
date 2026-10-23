/**
 * An in-memory stand-in for the Netlify functions, used by `npm run demo`.
 *
 * appRequest hands every call here instead of the network, so the whole UI
 * works on fictional data: no sign-in, no database, no model, nothing sent
 * anywhere. State lives for the page's lifetime; a reload starts fresh.
 * Background jobs "finish" after a short delay so the progress UI shows.
 */
import * as F from './fixtures'

const clone = v => structuredClone(v)
const JOB_DELAY_MS = 4000

const state = {
    dump:        clone(F.DUMP),
    blocks:      clone(F.LETTER_BLOCKS),
    review:      clone(F.LETTER_REVIEW),
    apps:        clone(F.APPLICATIONS),
    leads:       clone(F.LEADS),
    preferences: clone(F.PREFERENCES),
    // id → { readyAt, value } for background work still "running"
    pendingApps: new Map(),
    pendingLetters: new Map(),
    pendingReview: null,
    run: { startedAt: new Date(Date.now() - 86400000).toISOString(), finishedAt: new Date(Date.now() - 86000000).toISOString(), readyAt: 0 },
}

const reply = (status, body) =>
    new Response(body === undefined ? null : JSON.stringify(body), {
        status, headers: { 'Content-Type': 'application/json' },
    })

const slug = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'paragraph'

function normalizeBlocks(blocks) {
    const seen = new Set()
    return (blocks ?? []).filter(b => b?.text?.trim() || b?.label?.trim()).map(b => {
        let key = slug(b.key || b.label)
        for (let n = 2; seen.has(key); n++) key = `${slug(b.key || b.label)}-${n}`
        seen.add(key)
        return { key, label: b.label?.trim() ?? '', text: b.text?.trim() ?? '', angles: b.angles ?? [] }
    })
}

/** Settles any background work whose time has come. */
function settle() {
    const now = Date.now()
    for (const [id, job] of state.pendingApps) {
        if (job.readyAt > now) continue
        state.apps.unshift(job.value)
        state.pendingApps.delete(id)
    }
    for (const [id, job] of state.pendingLetters) {
        if (job.readyAt > now) continue
        const app = state.apps.find(a => a.id === id)
        if (app) app.coverLetter = job.value
        state.pendingLetters.delete(id)
    }
    if (!state.run.finishedAt && state.run.readyAt <= now) {
        state.run.finishedAt = new Date().toISOString()
    }
    if (state.pendingReview && state.pendingReview.readyAt <= now) {
        state.review = state.pendingReview.value
        state.pendingReview = null
    }
}

/** A new application: analysed as a solid Target, built from the demo dump. */
function analyse({ id, jobDescription, notes = '', questions = [] }) {
    const template = F.APPLICATIONS[1]
    const firstLine = String(jobDescription).split('\n').find(l => l.trim()) ?? ''
    return {
        ...clone(template),
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft',
        companyName: 'Demo Health Partners',
        jobTitle: firstLine.slice(0, 60) || 'Health Information Specialist',
        jobDescription, notes, questions,
        response: {
            ...clone(template.response),
            answers: questions.map(q => ({ question: q, answer: 'Your profile does not say; answer this one yourself.' })),
        },
        coverLetter: null,
    }
}

/** A letter from the current bank: every written paragraph, a gap before the close. */
function buildLetter(app, buildId) {
    const fill = s => s.replace(/\[company\]/g, app.companyName || 'the team').replace(/\[role\]/g, app.jobTitle || 'new hire')
    const written = state.blocks.filter(b => b.text.trim())
    const close = written.find(b => b.key === 'close')
    const body = written.filter(b => b !== close)
    const para = b => ({ kind: 'block', key: b.key, label: b.label, source: fill(b.text), text: fill(b.text), edits: [] })
    return {
        id: buildId,
        builtAt: new Date().toISOString(),
        angle: 'Specialist',
        angleRationale: 'The posting centres on day-to-day records work, where your paragraphs are strongest.',
        paragraphs: [
            ...body.map(para),
            { kind: 'missing', prompt: `Say what draws you to ${app.companyName || 'this employer'} in particular.` },
            ...(close ? [para(close)] : []),
        ],
        prompts: clone(F.LETTER_REVIEW.prompts),
    }
}

const dumpLoad = () => ({
    exists: true,
    data: {
        resume_dump: clone(state.dump),
        revisions: clone(F.REVISIONS),
        questions: clone(F.QUESTIONS),
        finalized: true,
        dump_state: 'READY',
        source_text: '',
        cached_dump: null,
        cached_at: null,
        provider: 'anthropic',
        configured_providers: ['anthropic'],
        has_api_key: true,
        letter_blocks: clone(state.blocks),
        letter_review: clone(state.review),
    },
})

const searchState = () => ({
    ok: true,
    leads: clone(state.leads),
    preferences: clone(state.preferences),
    run: {
        running: !state.run.finishedAt,
        startedAt: state.run.startedAt,
        finishedAt: state.run.finishedAt,
        error: null, found: state.leads.length, hasRun: true,
    },
    configured: true,
    hasKey: true,
})

const aiStatus = () => ({
    ok: true,
    provider: 'anthropic',
    providers: [
        { id: 'anthropic', label: 'Claude', active: true,  key: { set: true, last4: 'demo' }, models: { reasoning: 'claude-opus-5', extraction: 'claude-sonnet-4-6' } },
        { id: 'openai',    label: 'OpenAI', active: false, key: { set: false }, models: { reasoning: 'gpt-6-astra', extraction: 'gpt-5.6-terra' } },
        { id: 'gemini',    label: 'Gemini', active: false, key: { set: false }, models: { reasoning: 'gemini-3.1-pro-preview', extraction: 'gemini-3.8-flash' } },
    ],
    search: { id: 'perplexity', label: 'Perplexity', key: { set: true, last4: 'demo' } },
})

/**
 * Same contract as fetch() for our endpoints: returns a Response.
 *
 * @param {string} endpoint  e.g. "/job-application?id=…"
 * @param {string} method
 * @param {any} payload
 */
export async function demoRequest(endpoint, method, payload) {
    settle()
    const url = new URL(endpoint, 'http://demo.local')
    const path = url.pathname
    const q = Object.fromEntries(url.searchParams)

    switch (`${method} ${path}`) {
        case 'GET /resume-dump':
            return reply(200, q.ping ? { ready: false } : dumpLoad())
        case 'PUT /resume-dump':
            state.dump = { ...state.dump, ...clone(payload?.resume_dump ?? {}) }
            return reply(200, { ok: true, data: { resume_dump: clone(state.dump) } })
        case 'POST /resume-dump':
        case 'POST /resume-dump-background':
            return reply(400, { message: 'Rebuilding the profile is turned off in the demo.' })

        case 'GET /job-application': {
            if (!q.id) return reply(200, { applications: clone(state.apps), statuses: F.STATUSES })
            const app = state.apps.find(a => a.id === q.id)
            return reply(200, app ? { ready: true, data: clone(app) } : { ready: false })
        }
        case 'POST /job-application-background':
            state.pendingApps.set(payload.id, { readyAt: Date.now() + JOB_DELAY_MS, value: analyse(payload) })
            return reply(202)
        case 'PUT /job-application': {
            const app = state.apps.find(a => a.id === q.id)
            if (!app) return reply(404, { message: 'Application not found' })
            if (payload.status !== undefined) app.status = payload.status
            if (payload.job_application) app.response.job_application = clone(payload.job_application)
            if (payload.cover_letter) app.coverLetter = clone(payload.cover_letter)
            app.updatedAt = new Date().toISOString()
            return reply(200, { ok: true, data: clone(app) })
        }
        case 'DELETE /job-application':
            state.apps = state.apps.filter(a => a.id !== q.id)
            state.leads = state.leads.map(l => (l.applicationId === q.id ? { ...l, applicationId: null } : l))
            return reply(200, { ok: true, id: q.id })

        case 'GET /cover-letter':
            return reply(200, { ok: true, data: { blocks: clone(state.blocks), review: clone(state.review) } })
        case 'PUT /cover-letter':
            state.blocks = normalizeBlocks(payload?.blocks)
            return reply(200, { ok: true, data: { blocks: clone(state.blocks), review: clone(state.review) } })
        case 'POST /cover-letter-background': {
            const readyAt = Date.now() + JOB_DELAY_MS
            if (payload.action === 'review') {
                // The same notes again, minus any already fixed.
                const revisions = F.LETTER_REVIEW.revisions.filter(r =>
                    state.blocks.find(b => b.key === r.key)?.text.includes(r.original))
                state.pendingReview = { readyAt, value: { ...clone(F.LETTER_REVIEW), id: payload.reviewId, createdAt: new Date().toISOString(), revisions } }
            } else {
                const app = state.apps.find(a => a.id === payload.applicationId)
                if (app) state.pendingLetters.set(app.id, { readyAt, value: buildLetter(app, payload.buildId) })
            }
            return reply(202)
        }

        case 'GET /job-search':
            return reply(200, q.form ? { ok: true, preferences: clone(state.preferences), seeded: false } : searchState())
        case 'PUT /job-search':
            if (q.dismiss) {
                state.leads = state.leads.filter(l => l.id !== q.dismiss)
                return reply(200, { ok: true })
            }
            state.preferences = clone(payload?.preferences ?? state.preferences)
            return reply(200, searchState())
        case 'POST /job-search-background':
            // Runs, finds nothing new: the listings are already the demo's.
            state.run = { startedAt: new Date().toISOString(), finishedAt: null, readyAt: Date.now() + JOB_DELAY_MS }
            return reply(202)

        case 'GET /ai-status':
            return reply(200, aiStatus())
    }
    return reply(404, { message: `Demo has no ${method} ${path}` })
}
