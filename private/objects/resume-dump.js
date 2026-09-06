import Anthropic from "@anthropic-ai/sdk"
import { SYSTEM_PROMPTS } from "../registry/prompts.js"
import { insertResumeDump, insertResumeDumpDiff, getResumeDumpResult } from "../db/resume-dump.js";
import { saveApiKey } from "../db/users.js";
/**
 * 
 * @param {*} apiKey 
 * @param {*} payload {
 *      id: string
 *      resume_dump: string,
 * }
 */
/**
 * Polling handler for the GET /resume-dump?ping endpoint.
 * Returns null if the background job hasn't written results yet,
 * or { resume_dump, revisions, questions } once it has.
 *
 * @param {string} user_id
 * @returns {Promise<{ resume_dump: object, revisions: any[], questions: any[] } | null>}
 */
export const getResumeDumpPoll = async (user_id) => {
    const row = await getResumeDumpResult(user_id)
    if (!row) return null

    return {
        resume_dump: {
            contact: {
                name:     row.contact_name,
                email:    row.contact_email,
                phone:    row.contact_phone,
                location: row.contact_location,
                links:    row.contact_links    ?? [],
            },
            positioning:  row.positioning,
            education:    row.education        ?? [],
            experience:   row.experience       ?? [],
            freelance:    row.freelance         ?? [],
            projects:     row.projects         ?? [],
            portfolio:    row.portfolio,
            skills:       row.skills           ?? [],
            gaps:         row.gaps             ?? [],
            workingStyle: row.working_style,
            lookingFor:   row.looking_for,
        },
        revisions: row.revisions ?? [],
        questions: row.questions ?? [],
    }
}

export const createResumeDump = async (apiKey, payload) => {
    // return if ID/dump already exists; can't have multiple dumps yet
    //@todo id checks when DB gets implemented
    if (!payload?.user_id) {
        return {
            ok: false,
            error: "User id is missing"
        };
    }
    const userId = payload.user_id;
    if (!payload?.resume_dump) {
        return {
            ok: false,
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
        console.log(JSON.stringify(response, null, 2));

        const toolUse = response.content?.find(block => block.type === "tool_use");
        if (!toolUse?.input) {
            throw new Error("resume_dump returned no tool_use block", response?.stop_reason);
        }


        // checking to see the full shape of a anthropic message response
        if (response.content.length > 0) {
            let data = toolUse.input;

            // database updates
            await insertResumeDump(userId, data.resume_dump);
            await insertResumeDumpDiff(userId, dump.id, data.revisions, data.questions);
            await saveApiKey(userId, apiKey);

            return {
                ok: true,
                result: data
            }
        }
    } catch (err) {
        console.error("An error occured building the resume dump", err);
        return {
            ok: false,
            error: err
        };
    }

}