import { sql } from "./db.js"
import { encrypt, decrypt } from "../lib/crypto.js"

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
 * Encrypts and stores a user's Anthropic API key.
 * Upserts — safe to call on every onboarding submit.
 *
 * @param {string} user_id
 * @param {string} plainApiKey
 */
export const saveApiKey = async (user_id, plainApiKey) => {
    const encrypted = encrypt(plainApiKey)
    await sql`
        INSERT INTO users (id, api_key_encrypted)
        VALUES (${user_id}, ${encrypted})
        ON CONFLICT (id) DO UPDATE SET
            api_key_encrypted = EXCLUDED.api_key_encrypted
    `
}

/**
 * Retrieves and decrypts a user's Anthropic API key.
 * Returns null if no key is stored.
 * Throws if the stored value has been tampered with.
 *
 * @param {string} user_id
 * @returns {Promise<string | null>}
 */
export const getApiKey = async (user_id) => {
    const [row] = await sql`
        SELECT api_key_encrypted FROM users WHERE id = ${user_id}
    `
    if (!row?.api_key_encrypted) return null
    return decrypt(row.api_key_encrypted)
}
