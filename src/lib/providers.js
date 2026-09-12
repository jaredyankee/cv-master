/**
 * The providers a user can pick, for the front end.
 *
 * A deliberate mirror of `private/lib/providers/index.js` rather than an
 * import: `private/` is server-only and pulls in three SDKs, none of which
 * belong in the browser bundle. The server normalizes whatever arrives, so a
 * drift here is a wrong label, never a wrong request.
 */

export const PROVIDERS = [
    {
        id: 'anthropic',
        label: 'Claude',
        placeholder: 'sk-ant-...',
        keysUrl: 'https://console.anthropic.com/settings/keys',
        keysLabel: 'Anthropic Console',
    },
    {
        id: 'openai',
        label: 'OpenAI',
        placeholder: 'sk-...',
        keysUrl: 'https://platform.openai.com/api-keys',
        keysLabel: 'OpenAI dashboard',
    },
    {
        id: 'gemini',
        label: 'Gemini',
        placeholder: 'AIza...',
        keysUrl: 'https://aistudio.google.com/apikey',
        keysLabel: 'Google AI Studio',
    },
]

export const DEFAULT_PROVIDER = 'anthropic'

export const providerInfo = id =>
    PROVIDERS.find(p => p.id === id) ?? PROVIDERS[0]
