# cv-master
Manages and builds resumes for users based on a master "resume-dump" of their accomplishments and experience. User enters a job description, AI model assesses the fit based on the resume dump and returns a resume build from pieces of the resume dump

## Claude's role
Create the front-end design for CV master and help concretely define schemas.

## resume dump
Still figuring out the exact structure, probably something like; please advise if necessary.

1. Contact
2. Identity/Preferred positioning
3. Education
4. Experience
5. Freelance/independent work
6. Projects (kind of like the above)
7. Portfolio (kind of in contact and projects?)
8. Skills
9. Gaps (where they find they are missing edge quals or skills they don't have)
10. Working style (autonomous, lead, leading etc..)
11. Looking for... (remote, location, title, pay)

When the user enters the app, they are prompted for a resume-dump. This can be structured or unstructured. Have them write about themselves as if they were pitching their professional self, attach existing resumes.

The resume-dump will be ingested by Anthropic API and will return a structured resume dump from what the user provides. The AI is allowed to organize, make notes, and make small revisions to the dump (for clarity and readbility), but should NOT create new content.

### Initial Output Schema

{
    resume_dump: {
        ...// the categories fron the schema above, pending edits
    }
    revisions: [
        {
            original: string, // original text uneditabler
            note: string // why it was highlighted/should be addressed
            suggested_edit: string // editable by the user
        }
    ]
    questions: [
        {
            question: string // digging for information
            reference string // optional; for elaborating on points, asking for specific numbers, clarifying implied skills
        }
    ]
}

Notes on the resume dump should be given like a word doc. revision; highlighted section and comment. This should be presented as Original (highlighted, uneditable), comment, Original (editable in text area with option to submit). 

For information that is missing or the model wants to add, it should be presented with a question and text box for the answer. Reference to the text should be included if relevant

### UI/UX
The first load of the site should have a form for the resume dump. A large text area is fine; it should show an udpating character count beneath the text area. 

### *API handling*
users must provide their own API key; along with the resume dump field, there should also be a field to enter their API key

### Storage/Persistance
NeonDB (Postgres) will be used for storage and auth. There needs to be a safe way to store the API keys the user enters. 

## resume manager
After onboarding is complete, the main user interface displays the resume dump in the left panel, and existing resumes / applications in the right panel

Users can click a "+" button to add a job application, or click on their existing applications to view them

## job applications
When creating a new job application, users enter:
- job description
- notes //optional
- additional questions // array of questions, show one blank with a checkbox to indicate completed, when completed, still editable, but shows a new empty field below it

On submit, the AI will receive 
- the resume dump
- the JD
- the notes if there are any
- the questions if there are any

it returns
- a fit criteria
    - Unsure how to qualify this yet, maybe Mismatch, Out of reach, Reach, Target?
        - Mismatch is something about the job that disqualifies it from the users radar (non-remote when user wants a remote job)
        - for Out of Reach and Mismatch "Are you sure you want to generate a resume?"; prevents token burn
- a job application BUILT WITH PIECES FROM THE RESUME DUMP
    - the job application is built, not generated.
- Cover letter outline
    - Don't write the cover letter. Target:
        - The companies missions statement / culture observations
            - Are they strict corporate, open to fun/wonder etc..
        - Highlight overlap between the resume-dump's pulled facts and the JD requirements
        - Point out gaps
    - *blurbs can be written to guide the user, but writing a cover letter from AI is going to be bad no matter what. IF they want to take this output, give it to an AI to write the letter and submit it, thats fine, but don't provide a written cover letter.*
    - If there is a small "ai-filter/test" in the JD (go to our website, what color is the logo?) point that out at the end of the cover letter summary

The return structure will probably be something like
{
    fit_criteria: {
        level: enum
        rationale: ""
    },
    job_application: {
        contact: {
            name,
            title,
            location,
            email,
            phone,
            links: [

            ]
        },
        summary: string,
        exprience: [
            {
                company,
                title,
                highlights: [

                ],
                startDate,
                endDate
            }
        ],
        education: [
            {
                school,
                startDate,
                endDate,
                highlights: [

                ]
            }
        ],
        skills: [
            // this could be variable depending on the field could be somethng like:
            {
                // based on my current resumes; "Programming Languages: JavaScript, Python..."
                category: string,
                items: [

                ]
                
            }
        ],
    },
    cover_letter: {
        mission: string //if applicable
        culture: string
        intents: [
            {
                category: enum [qualification, gap, etc..]
                confidence: number // percentage on how confident the AI is that this intent is good for the cover letter
                rationale: "why it thinks this would be a good idea to target in the cover letter
                blurb: string //optional save for complex ideas where wording/phrasing is important
            }
        ]
    }
}





