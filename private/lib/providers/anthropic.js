import Anthropic from '@anthropic-ai/sdk'
import { toAnthropicSchema } from './schema-adapt.js'

/**
 * Structured output by forced tool call: the model is required to call the one
 * tool we give it, and the tool's input_schema is the shape we want back.
 *
 * The system prompt is sent as a cacheable block. It is long, identical across
 * every request, and prompt caching makes repeat calls markedly cheaper — the
 * user's money, so worth the one extra line.
 */
export const anthropicAdapter = {
    async structured({ apiKey, model, system, user, tool, maxTokens = 8192, thinking }) {
        const client = new Anthropic({ apiKey })

        const response = await client.messages.create({
            model,
            max_tokens: maxTokens,
            ...(thinking ? { thinking } : {}),
            system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
            tools: [{
                name: tool.name,
                description: tool.description,
                input_schema: toAnthropicSchema(tool.input_schema),
            }],
            tool_choice: { type: 'tool', name: tool.name },
            messages: [{ role: 'user', content: user }],
        })

        return parseAnthropic(response)
    },
}

/** Pulls the tool input out of a Messages response. Exported for testing. */
export function parseAnthropic(response) {
    if (response?.stop_reason === 'refusal') {
        const category = response?.stop_details?.category
        throw new Error(`refused${category ? `: ${category}` : ''}`)
    }
    const block = response?.content?.find(b => b.type === 'tool_use')
    if (!block?.input) {
        throw new Error(`no tool_use block in the response (stop_reason=${response?.stop_reason ?? 'unknown'})`)
    }
    return block.input
}
