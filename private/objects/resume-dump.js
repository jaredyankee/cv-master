import Anthropic from "@anthropic-ai/sdk"
import { SYSTEM_PROMPTS } from "../registry/prompts"
/**
 * 
 * @param {*} apiKey 
 * @param {*} payload {
 *      id: string
 *      resume_dump: string,
 * }
 */
export const createResumeDump = async (apiKey, payload) => {
    // return if ID/dump already exists; can't have multiple dumps yet
    //@todo id checks when DB gets implemented
    
    if (!payload?.resume_dump) {
        return;
    }
    // or
    if (!payload.resume_dump) {
        return {
            success: false,
            error: {
                status: 400,
                message: "Resume dump is missing" 
            }
        };
    }
    
    const anthropic = new Anthropic({
        apiKey, apiKey
    });
    
    const system = SYSTEM_PROMPTS["CREATE_RESUME_DUMP"];
    const user = payload.resume_dump;

    try {
        const response = await anthropic.messages.create({
            model: "claude-sonnet-5",
            max_tokens: 8192, // @todo verify token usage
            system,
            tools: [
                {
                    name: "emit_resume_dump",
                    description: "Returns the resume_dump",
                    input_schema: RESUME_DUMP_SCHEMA
                }
            ],
            tool_choice: { type: "tool", name: "emit_resume_dump" },
            messages: [
                {
                    role: "user",
                    content: user
                }
            ]
        });
        // checking to see the full shape of a anthropic message response
        console.log(JSON.stringify(response, null, 2));
        if (response.content.length > 0) {
            return {
                success: true,
                text: response.content[0].text
            }
        }
    } catch (err) {
        console.error("An error occured building the resume dump", err);
        return {
            success: false,
            error: err
        };
    }

}