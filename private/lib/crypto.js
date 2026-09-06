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

function getKey() {
    const hex = process.env.ENCRYPTION_KEY
    if (!hex || hex.length !== KEY_BYTES * 2) {
        throw new Error(
            `ENCRYPTION_KEY must be a ${KEY_BYTES * 2}-char hex string. ` +
            `Generate one with: node -e "console.log(require('crypto').randomBytes(${KEY_BYTES}).toString('hex'))"`
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
