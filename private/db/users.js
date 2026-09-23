import { sql } from "./db.js"
import { encrypt, decrypt } from "../lib/crypto.js"
import { normalizeProvider, DEFAULT_PROVIDER } from "../lib/providers/index.js"

/**
 * Makes sure a users row exists for this id so that rows in resume_dumps /
 * resume_dump_diffs can reference it. Never touches an existing api key.
 *
 * @param {string} user_id
 */
export const ensureUser = async (user_id) => {
    await sql`
        INSERT INTO users (id)
        VALUES (${user_id})
        ON CONFLICT (id) DO NOTHING
    `
}

/**
 * Which provider this user's requests go to.
 *
 * @param {string} user_id
 * @returns {Promise<string>} always one of PROVIDERS
 */
export const getProvider = async (user_id) => {
    const [row] = await sql`SELECT api_provider FROM users WHERE id = ${user_id}`
    return normalizeProvider(row?.api_provider)
}

/**
 * Encrypts and stores a key *for one provider*, and makes that provider the
 * active one. Keys for other providers are left in place, so switching back
 * and forth doesn't mean re-entering them.
 *
 * @param {string} user_id
 * @param {string} provider
 * @param {string} plainApiKey
 */
export const saveApiKey = async (user_id, provider, plainApiKey) => {
    const p = normalizeProvider(provider)
    const encrypted = encrypt(plainApiKey)
    await sql`
        INSERT INTO users (id, api_provider, api_keys)
        VALUES (${user_id}, ${p}, ${JSON.stringify({ [p]: encrypted })}::jsonb)
        ON CONFLICT (id) DO UPDATE SET
            api_provider = EXCLUDED.api_provider,
            -- Merge rather than replace: this user may have keys on file for
            -- providers they are not using right now.
            api_keys     = users.api_keys || EXCLUDED.api_keys
    `
}

/**
 * Records the active provider without touching any key. Used when a user picks
 * a provider they have already given a key for.
 */
export const setProvider = async (user_id, provider) => {
    const p = normalizeProvider(provider)
    await sql`
        INSERT INTO users (id, api_provider)
        VALUES (${user_id}, ${p})
        ON CONFLICT (id) DO UPDATE SET api_provider = EXCLUDED.api_provider
    `
}

/** The raw row behind the key helpers, read once so callers don't query twice. */
const keyRow = async (user_id) => {
    const [row] = await sql`
        SELECT api_provider, api_keys, api_key_encrypted
        FROM users WHERE id = ${user_id}
    `
    return row ?? null
}

/**
 * The ciphertext on file for a provider.
 *
 * Falls back to the pre-migration single-key column for the Anthropic case, so
 * a user whose row predates the backfill still works.
 */
const ciphertextFor = (row, provider) => {
    const stored = row?.api_keys?.[provider]
    if (stored) return stored
    if (provider === DEFAULT_PROVIDER && row?.api_key_encrypted) return row.api_key_encrypted
    return null
}

/**
 * Which providers this user has a key for, without decrypting anything.
 * The UI uses it to mark the key field optional for a provider already set up.
 *
 * @param {string} user_id
 * @returns {Promise<{ provider: string, configured: string[] }>}
 */
export const getKeyStatus = async (user_id) => {
    const row = await keyRow(user_id)
    const provider = normalizeProvider(row?.api_provider)
    // Model providers only. The search key shares this column but is not
    // something the picker can be set to, so listing it here would mark a
    // provider configured that the user never gave a key for.
    const configured = Object.entries(row?.api_keys ?? {})
        .filter(([k, v]) => Boolean(v) && k !== SEARCH_PROVIDER)
        .map(([k]) => k)

    if (row?.api_key_encrypted && !configured.includes(DEFAULT_PROVIDER)) {
        configured.push(DEFAULT_PROVIDER)
    }
    return { provider, configured }
}

/* ── Search key ──────────────────────────────────────────────────
 *
 * Perplexity searches for listings; it never produces structured output, so
 * it is not one of PROVIDERS and must never reach the picker — choosing it
 * for a resume build would be choosing something that cannot do the job.
 *
 * It shares the api_keys jsonb, which is keyed by name and needs no
 * migration, but it gets its own accessors rather than reusing saveApiKey.
 * That one normalizes its argument, so an unrecognised name silently becomes
 * 'anthropic' — saving a search key through it would overwrite the user's
 * Claude key and switch the provider their resumes are built with.
 */
export const SEARCH_PROVIDER = 'perplexity'

/** Stores the search key. Deliberately leaves api_provider alone. */
export const saveSearchKey = async (user_id, plainApiKey) => {
    const encrypted = encrypt(plainApiKey)
    await sql`
        INSERT INTO users (id, api_keys)
        VALUES (${user_id}, ${JSON.stringify({ [SEARCH_PROVIDER]: encrypted })}::jsonb)
        ON CONFLICT (id) DO UPDATE SET
            api_keys = users.api_keys || EXCLUDED.api_keys
    `
}

/** The decrypted search key, or null when the user hasn't given one. */
export const getSearchKey = async (user_id) => {
    const row = await keyRow(user_id)
    const ciphertext = row?.api_keys?.[SEARCH_PROVIDER]
    return ciphertext ? decrypt(ciphertext) : null
}

/** Whether a search key is on file, without decrypting it. */
export const hasSearchKey = async (user_id) => {
    const row = await keyRow(user_id)
    return Boolean(row?.api_keys?.[SEARCH_PROVIDER])
}

/**
 * Whether a key is on file for the user's active provider, without decrypting
 * it — it keeps the ciphertext out of this path entirely.
 *
 * @param {string} user_id
 * @returns {Promise<boolean>}
 */
export const hasApiKey = async (user_id) => {
    const row = await keyRow(user_id)
    return Boolean(ciphertextFor(row, normalizeProvider(row?.api_provider)))
}

/**
 * Retrieves and decrypts a user's key, along with the provider it belongs to,
 * so a caller can never pair one provider's key with another's endpoint.
 *
 * Returns { provider, apiKey: null } when nothing is on file.
 * Throws if the stored value has been tampered with.
 *
 * @param {string} user_id
 * @param {string} [preferredProvider]  overrides the stored active provider
 * @returns {Promise<{ provider: string, apiKey: string|null }>}
 */
export const getApiKey = async (user_id, preferredProvider) => {
    const row = await keyRow(user_id)
    const provider = normalizeProvider(preferredProvider ?? row?.api_provider)
    const ciphertext = ciphertextFor(row, provider)
    return { provider, apiKey: ciphertext ? decrypt(ciphertext) : null }
}
