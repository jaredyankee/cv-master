import { GoogleGenAI } from '@google/genai'
import { toGeminiSchema } from './schema-adapt.js'

/**
 * Structured output by `responseJsonSchema` — real JSON Schema, not Gemini's
 * older OpenAPI-flavoured `responseSchema`, so our tool schemas go across
 * nearly unchanged. `responseMimeType` is required alongside it, and
 * `responseSchema` must be omitted when it is set.
 *
 * There is no tool call here: the whole reply is the JSON.
 */
export const geminiAdapter = {
    async structured({ apiKey, model, system, user, tool, maxTokens = 8192 }) {
        const client = new GoogleGenAI({ apiKey })

        const response = await client.models.generateContent({
            model,
            contents: user,
            config: {
                systemInstruction: system,
                maxOutputTokens: maxTokens,
                responseMimeType: 'application/json',
                responseJsonSchema: toGeminiSchema(tool.input_schema),
            },
        })

        return parseGemini(response)
    },
}

/**
 * Pulls the JSON out of a generateContent response. Exported for testing.
 *
 * `text` is a getter on the current SDK and was a method on older ones; both
 * are handled because the difference is invisible until it throws in prod.
 */
export function parseGemini(response) {
    const text = typeof response?.text === 'function' ? response.text() : response?.text
    if (!text) {
        const reason = response?.candidates?.[0]?.finishReason ?? 'unknown'
        throw new Error(`empty response (finishReason=${reason})`)
    }
    try {
        return JSON.parse(text)
    } catch {
        throw new Error('response was not valid JSON')
    }
}
