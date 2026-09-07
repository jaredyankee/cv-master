/**
 * AES-256-GCM symmetric encryption for sensitive values (API keys, etc.)
 *
 * Why GCM:
 *   Authenticated encryption — it encrypts AND signs the ciphertext.
 *   If anything in the stored value is tampered with, decrypt() throws
 *   rather than silently returning garbage.
 *
 * Setup:
 *   Add ENCRYPTION_KEY to your .env and Netlify environment variables.
 *   Generate a key:
 *     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   It will print a 64-char hex string. That's your key. Treat it like a password.
 *
 * What's stored in the DB:
 *   iv:authTag:ciphertext  — all hex, colon-separated, single TEXT column.
 *   The IV is random per encryption so identical inputs produce different outputs.
 *   Never reuse an IV with the same key — this function handles that automatically.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM  = 'aes-256-gcm'
const IV_BYTES   = 12  // 96-bit IV — GCM spec recommendation
const KEY_BYTES  = 32  // 256-bit key

const HEX_LEN = KEY_BYTES * 2
const HEX_RE  = /^[0-9a-f]+$/i
const GEN_CMD = `node -e "console.log(require('crypto').randomBytes(${KEY_BYTES}).toString('hex'))"`

/**
 * Reads ENCRYPTION_KEY from the environment and returns it as a 32-byte Buffer.
 *
 * The error message says *which* check failed (missing / wrong length / not hex)
 * without ever printing the value, so a bad deploy is diagnosable from the logs.
 * Surrounding whitespace and wrapping quotes are tolerated — both are easy to
 * pick up when pasting into a dashboard or `netlify env:set`.
 */
function getKey() {
    const raw = process.env.ENCRYPTION_KEY

    if (raw === undefined || raw === '') {
        throw new Error(
            'ENCRYPTION_KEY is not set in this runtime. ' +
            'It must be defined where the function runs (e.g. Netlify → Site configuration → ' +
            'Environment variables, with the Functions scope) and the site redeployed. ' +
            `Generate one with: ${GEN_CMD}`
        )
    }

    const hex = raw.trim().replace(/^["']|["']$/g, '')

    if (hex.length !== HEX_LEN) {
        throw new Error(
            `ENCRYPTION_KEY must be exactly ${HEX_LEN} hex chars but the value in this runtime is ` +
            `${hex.length} chars long. Generate one with: ${GEN_CMD}`
        )
    }
    if (!HEX_RE.test(hex)) {
        throw new Error(
            `ENCRYPTION_KEY has the right length but contains non-hex characters. ` +
            `Generate one with: ${GEN_CMD}`
        )
    }

    return Buffer.from(hex, 'hex')
}

/**
 * Encrypts a plaintext string.
 * Returns a single string in the format: iv:authTag:ciphertext (all hex).
 * Safe to store directly in a TEXT column.
 *
 * @param {string} plaintext
 * @returns {string}
 */
export function encrypt(plaintext) {
    const key    = getKey()
    const iv     = randomBytes(IV_BYTES)          // fresh IV every time
    const cipher = createCipheriv(ALGORITHM, key, iv)

    const ciphertext = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
    ])

    const authTag = cipher.getAuthTag()           // 16-byte integrity tag

    return [iv, authTag, ciphertext]
        .map(b => b.toString('hex'))
        .join(':')
}

/**
 * Decrypts a value produced by encrypt().
 * Throws if the ciphertext has been tampered with or the key is wrong.
 *
 * @param {string} stored  — the iv:authTag:ciphertext string from the DB
 * @returns {string}       — the original plaintext
 */
export function decrypt(stored) {
    const parts = stored.split(':')
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted value format')
    }

    const [ivHex, tagHex, ctHex] = parts
    const key       = getKey()
    const iv        = Buffer.from(ivHex,  'hex')
    const authTag   = Buffer.from(tagHex, 'hex')
    const ciphertext = Buffer.from(ctHex, 'hex')

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)                  // GCM verifies this on final()

    return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()                          // throws if auth tag doesn't match
    ]).toString('utf8')
}
