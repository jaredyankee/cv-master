import { getKeyHints } from "../db/users.js"
import { PROVIDERS, PROVIDER_LABELS, modelFor } from "../lib/providers/index.js"

/**
 * What the user's AI calls will actually use: the active provider, the model
 * for each job, and which key is on file for each provider.
 *
 * The models come from modelFor, the same function the calls themselves use,
 * so an env override shows up here exactly as it takes effect — a list kept
 * in the browser would show the defaults and quietly go wrong the first time
 * the site owner overrode one.
 *
 * Every provider is listed, not only the active one: a key left on file for
 * a provider you switched away from is still a key you gave this site.
 *
 * @returns {Promise<{ ok: true, provider: string, providers: object[], search: object }>}
 */
export const getAiStatus = async (userId) => {
    if (!userId) return { ok: false, error: "User id is missing" }

    const { provider, keys, search } = await getKeyHints(userId)
    return {
        ok: true,
        provider,
        providers: PROVIDERS.map(id => ({
            id,
            label: PROVIDER_LABELS[id],
            active: id === provider,
            key: keys[id],
            models: {
                reasoning:  modelFor(id, "reasoning"),
                extraction: modelFor(id, "extraction"),
            },
        })),
        search: { id: "perplexity", label: "Perplexity", key: search },
    }
}
