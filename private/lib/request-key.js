import { getApiKey } from "../db/users.js"
import { normalizeProvider } from "./providers/index.js"

/**
 * BYOK for a background function. The x-api-key header first, then the key
 * stored for the provider the user asked for — never another provider's key
 * against this one's endpoint — then the site's own Anthropic key if set.
 *
 * @returns {Promise<{ apiKey: string, provider: string }>} apiKey "" when none
 */
export async function resolveApiKey(event, body, userId, label) {
    const requested = normalizeProvider(body?.provider ?? event.headers["x-api-provider"])
    let provider = requested
    let apiKey = (event.headers["x-api-key"] ?? "").trim()
    if (!apiKey) {
        try {
            const stored = await getApiKey(userId, requested)
            if (stored.apiKey) { apiKey = stored.apiKey; provider = stored.provider }
        } catch (err) {
            console.error(`${label}: could not read stored API key:`, err.message)
        }
    }
    if (!apiKey && provider === "anthropic") apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim()
    return { apiKey, provider }
}
