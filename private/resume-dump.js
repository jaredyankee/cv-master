import Anthropic from "@anthropic-ai/sdk"
import { SYSTEM_PROMPTS } from "./registry/prompts.js"
import { RESUME_DUMP_TOOL } from "./registry/schema.js"

/**
 * @param {string} apiKey
 * @param {{ resume_dump: string }} payload
 */
export const createResumeDump = async (apiKey, payload) => {
    if (!payload?.resume_dump) {
        return {
            ok: false,
            error: { status: 400, message: "Resume dump is missing" }
        };
    }

    const anthropic = new Anthropic({ apiKey });

    try {
        const response = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 8192,
            system: SYSTEM_PROMPTS.CREATE_RESUME_DUMP,
            tools: [RESUME_DUMP_TOOL],
            tool_choice: { type: "tool", name: "create_resume_dump" },
            messages: [
                { role: "user", content: payload.resume_dump }
            ]
        });

        const toolUse = response.content.find(b => b.type === "tool_use");
        if (toolUse) {
            return { success: true, data: toolUse.input };
        }

        return {
            ok: false,
            error: { status: 500, message: "Model did not return a tool_use block" }
        };

    } catch (err) {
        console.error("Error building resume dump:", err);
        return { success: false, error: err };
    }
}
