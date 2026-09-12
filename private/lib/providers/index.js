/**
 * One structured-output call, three providers behind it.
 *
 * Every AI call in this app is the same shape: a system prompt, one user
 * message, and a JSON Schema the answer must match. Each provider has its own
 * name for that — Anthropic a forced tool call, OpenAI strict `json_schema`
 * response format, Gemini `responseJsonSchema` — so the call sites ask for
 * `structured(...)` and this module deals with the differences.
 *
 * Adding a provider is one file plus an entry in ADAPTERS.
 */

import { anthropicAdapter } from './anthropic.js'
import { openaiAdapter } from './openai.js'
import { geminiAdapter } from './gemini.js'

/** The providers a user can choose. Order is the order the picker shows. */
export const PROVIDERS = ['anthropic', 'openai', 'gemini']

export const PROVIDER_LABELS = {
    anthropic: 'Claude',
    openai:    'OpenAI',
    gemini:    'Gemini',
}

export const DEFAULT_PROVIDER = 'anthropic'

const ADAPTERS = {
    anthropic: anthropicAdapter,
    openai:    openaiAdapter,
    gemini:    geminiAdapter,
}

/** Whether a string names a provider we support. */
export const isProvider = name => PROVIDERS.includes(name)

/** The stored value coerced to a usable provider. */
export const normalizeProvider = name => (isProvider(name) ? name : DEFAULT_PROVIDER)

/**
 * Two jobs, two model sizes.
 *
 * `reasoning` assembles a resume and judges fit — judgment-heavy, worth the
 * frontier model. `extraction` turns free text into structured fields, which a
 * mid-tier model does well and much more cheaply. Users bring their own key, so
 * this is their money either way; spending it on the frontier model for a
 * parsing task would be careless.
 *
 * Model names move faster than releases of this app, so every one of these is
 * overridable by env without a code change — see README.
 */
const DEFAULT_MODELS = {
    anthropic: { reasoning: 'claude-opus-5',           extraction: 'claude-sonnet-4-6' },
    openai:    { reasoning: 'gpt-6-astra',             extraction: 'gpt-5.6-terra' },
    gemini:    { reasoning: 'gemini-3.1-pro-preview',  extraction: 'gemini-3.8-flash' },
}

const ENV_KEYS = {
    anthropic: { reasoning: 'ANTHROPIC_MODEL_REASONING', extraction: 'ANTHROPIC_MODEL_EXTRACTION' },
    openai:    { reasoning: 'OPENAI_MODEL_REASONING',    extraction: 'OPENAI_MODEL_EXTRACTION' },
    gemini:    { reasoning: 'GEMINI_MODEL_REASONING',    extraction: 'GEMINI_MODEL_EXTRACTION' },
}

/**
 * The model to use for a provider and job.
 * @param {string} provider
 * @param {'reasoning'|'extraction'} role
 */
export function modelFor(provider, role) {
    const p = normalizeProvider(provider)
    const override = process.env[ENV_KEYS[p][role]]?.trim()
    return override || DEFAULT_MODELS[p][role]
}

/** Where a user gets a key, shown next to the picker. */
export const KEY_HINTS = {
    anthropic: { prefix: 'sk-ant-', url: 'https://console.anthropic.com/settings/keys' },
    openai:    { prefix: 'sk-',     url: 'https://platform.openai.com/api-keys' },
    gemini:    { prefix: 'AIza',    url: 'https://aistudio.google.com/apikey' },
}

/**
 * Runs one structured call.
 *
 * @param {object} req
 * @param {string} req.provider
 * @param {string} req.apiKey
 * @param {'reasoning'|'extraction'} req.role
 * @param {string} req.system       system prompt
 * @param {string} req.user         the user message
 * @param {object} req.tool         { name, description, input_schema }
 * @param {number} req.maxTokens
 * @returns {Promise<{ ok: true, data: object, model: string, usage: object }
 *                 | { ok: false, error: string, status?: number }>}
 */
export async function structured(req) {
    const provider = normalizeProvider(req.provider)
    const adapter = ADAPTERS[provider]
    const model = req.model || modelFor(provider, req.role ?? 'extraction')

    if (!req.apiKey) {
        return { ok: false, error: `No ${PROVIDER_LABELS[provider]} API key on file` }
    }

    try {
        const data = await adapter.structured({ ...req, model })
        // Shape and usage only — never the content. It is the user's profile.
        console.log(`[${provider}/${model}] structured ok`)
        return { ok: true, data, model, provider }
    } catch (err) {
        // Every SDK reports an auth failure differently; the status is what the
        // caller actually needs to tell "wrong key" from "wrong model".
        const status = err?.status ?? err?.statusCode ?? err?.response?.status ?? null
        console.error(`[${provider}/${model}] structured failed${status ? ` (${status})` : ''}: ${err?.message ?? err}`)
        return { ok: false, error: err?.message ?? String(err), status, provider, model }
    }
}
