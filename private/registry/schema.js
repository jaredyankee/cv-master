// ── Reusable item shapes ─────────────────────────────────────

const experienceItem = {
    type: 'object',
    properties: {
        company:     { type: 'string' },
        title:       { type: 'string' },
        startDate:   { type: 'string' },
        endDate:     { type: 'string', description: 'Use "Present" for current roles.' },
        description: { type: 'string' },
    },
}

const skillItem = {
    type: 'object',
    properties: {
        category: { type: 'string' },
        items:    { type: 'array', items: { type: 'string' } },
    },
}

// ── Tool definition ───────────────────────────────────────────
// Pass this to the Anthropic SDK as tools: [RESUME_DUMP_TOOL]
// and force it with tool_choice: { type: 'tool', name: 'create_resume_dump' }.
// The structured output comes back in response.content[].input.

export const RESUME_DUMP_TOOL = {
    name: 'create_resume_dump',
    description: 'Populate the structured resume dump from the raw user input.',
    input_schema: {
        type: 'object',
        properties: {

            resume_dump: {
                type: 'object',
                properties: {

                    contact: {
                        type: 'object',
                        properties: {
                            name:     { type: 'string' },
                            email:    { type: 'string' },
                            phone:    { type: 'string' },
                            location: { type: 'string' },
                            links:    { type: 'array', items: { type: 'string' } },
                        },
                    },

                    positioning: {
                        type: 'string',
                        description: 'Preferred professional headline or identity. Verbatim from input if stated; otherwise empty.',
                    },

                    education: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                school:    { type: 'string' },
                                degree:    { type: 'string' },
                                field:     { type: 'string' },
                                startDate: { type: 'string' },
                                endDate:   { type: 'string' },
                                notes:     { type: 'string' },
                            },
                        },
                    },

                    experience: {
                        type: 'array',
                        description: 'Employer-employee roles only (W2, salaried, intern).',
                        items: experienceItem,
                    },

                    freelance: {
                        type: 'array',
                        description: 'Contract, self-employed, and founder roles where the user was the business entity.',
                        items: experienceItem,
                    },

                    projects: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name:        { type: 'string' },
                                description: { type: 'string' },
                                links:       { type: 'array', items: { type: 'string' } },
                            },
                        },
                    },

                    portfolio:    { type: 'string' },
                    skills:       { type: 'array', items: skillItem },
                    gaps:         { type: 'array', items: { type: 'string' }, description: 'Self-reported gaps only — never inferred.' },
                    workingStyle: { type: 'string' },
                    lookingFor:   { type: 'string', description: 'Role preferences: remote/hybrid, title, compensation, location.' },
                },
            },

            revisions: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        original:       { type: 'string', description: 'Verbatim text from the input. Must match exactly.' },
                        note:           { type: 'string', description: 'Why this is being flagged.' },
                        suggested_edit: { type: 'string', description: 'Proposed replacement — editable by the user before accepting.' },
                    },
                    required: ['original', 'note', 'suggested_edit'],
                },
            },

            questions: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        question:  { type: 'string' },
                        reference: { type: 'string', description: 'Verbatim input text being referenced, if applicable.' },
                    },
                    required: ['question'],
                },
            },

        },
        required: ['resume_dump', 'revisions', 'questions'],
    },
}
