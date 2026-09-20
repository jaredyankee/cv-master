import OpenAI from 'openai'
import { toStrictSchema } from './schema-adapt.js'

/**
 * Structured output by strict `json_schema` response format. Strict mode is
 * enforced during sampling rather than checked afterwards, so the reply parses
 * or the request fails — there is no half-valid case to defend against.
 *
 * The price is a narrower schema dialect; toStrictSchema pays it.
 */
export const openaiAdapter = {
    async structured({ apiKey, model, system, user, tool, maxTokens = 8192 }) {
        const client = new OpenAI({ apiKey })

        const response = await client.chat.completions.create({
            model,
            max_completion_tokens: maxTokens,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
            ],
            response_format: {
                type: 'json_schema',
                json_schema: {
                    // Schema names are identifier-ish across providers; ours
                    // already are, but a stray character here is a 400 that
                    // reads as if the schema were wrong.
                    name: tool.name.replace(/[^a-zA-Z0-9_-]/g, '_'),
                    description: tool.description,
                    strict: true,
                    schema: toStrictSchema(tool.input_schema),
                },
            },
        })

        return parseOpenAI(response)
    },
}

/** Pulls the JSON out of a chat completion. Exported for testing. */
export function parseOpenAI(response) {
    const choice = response?.choices?.[0]

    // A refusal is a first-class outcome here, not an error string buried in
    // the content — surfacing it as-is beats "could not parse JSON".
    if (choice?.message?.refusal) {
        throw new Error(`refused: ${choice.message.refusal}`)
    }

    const text = choice?.message?.content
    if (!text) {
        throw new Error(`empty response (finish_reason=${choice?.finish_reason ?? 'unknown'})`)
    }

    try {
        return JSON.parse(text)
    } catch {
        throw new Error('response was not valid JSON despite strict mode')
    }
}
