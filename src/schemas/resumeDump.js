/**
 * @typedef {Object} Contact
 * @property {string} name
 * @property {string} email
 * @property {string} phone
 * @property {string} location
 * @property {string[]} links
 */

/**
 * @typedef {Object} ExperienceEntry
 * @property {string} company
 * @property {string} title
 * @property {string} startDate
 * @property {string} endDate
 * @property {string} description
 */

/**
 * @typedef {Object} EducationEntry
 * @property {string} school
 * @property {string} degree
 * @property {string} field
 * @property {string} startDate
 * @property {string} endDate
 * @property {string} notes
 */

/**
 * @typedef {Object} ProjectEntry
 * @property {string} name
 * @property {string} description
 * @property {string[]} links
 */

/**
 * @typedef {Object} SkillCategory
 * @property {string} category
 * @property {string[]} items
 */

/**
 * The master resume dump — 100% user-defined content.
 * The AI must never infer or generate content; anything it wants to add
 * must be raised as a question in OnboardingResponse.questions.
 *
 * @typedef {Object} ResumeDump
 * @property {Contact} contact
 * @property {string} positioning - Preferred identity / positioning statement
 * @property {EducationEntry[]} education
 * @property {ExperienceEntry[]} experience
 * @property {ExperienceEntry[]} freelance - Independent / contract work
 * @property {ProjectEntry[]} projects
 * @property {string} portfolio - Portfolio URL or description
 * @property {SkillCategory[]} skills
 * @property {string[]} gaps - Self-reported gaps the user acknowledges
 * @property {string} workingStyle - e.g. "autonomous", "lead", "collaborative"
 * @property {string} lookingFor - Preferences: remote, title, pay, location
 */

/**
 * A single AI-flagged revision.
 * The original text is uneditable; the user edits suggested_edit before accepting.
 * Accepting replaces the original text in the dump.
 *
 * @typedef {Object} Revision
 * @property {string} original - The exact text from the dump (uneditable)
 * @property {string} note - Why the AI flagged it
 * @property {string} suggested_edit - Editable replacement; pre-filled by the AI
 */

/**
 * A question the AI is asking for missing or ambiguous information.
 * Answered text is appended to the relevant section of the dump.
 *
 * @typedef {Object} Question
 * @property {string} question
 * @property {string} [reference] - Optional: the dump text being referenced
 */

/**
 * The full response returned after the AI ingests the raw resume dump.
 *
 * @typedef {Object} OnboardingResponse
 * @property {ResumeDump} resume_dump
 * @property {Revision[]} revisions
 * @property {Question[]} questions
 */

/** @returns {ResumeDump} */
export function createEmptyResumeDump() {
  return {
    contact: { name: '', email: '', phone: '', location: '', links: [] },
    positioning: '',
    education: [],
    experience: [],
    freelance: [],
    projects: [],
    portfolio: '',
    skills: [],
    gaps: [],
    workingStyle: '',
    lookingFor: '',
  }
}

/** Mock data for UI development — remove before shipping */
export const MOCK_ONBOARDING_RESPONSE = {
  resume_dump: {
    contact: {
      name: 'Alex Rivera',
      email: 'alex@example.com',
      phone: '555-0100',
      location: 'Austin, TX',
      links: ['github.com/alexrivera', 'linkedin.com/in/alexrivera'],
    },
    positioning:
      'Full-stack developer focused on developer experience and scalable internal tooling.',
    education: [
      {
        school: 'University of Texas',
        degree: 'B.S.',
        field: 'Computer Science',
        startDate: '2015',
        endDate: '2019',
        notes: '',
      },
    ],
    experience: [
      {
        company: 'Acme Corp',
        title: 'Senior Software Engineer',
        startDate: '2021',
        endDate: 'Present',
        description:
          'Led development of internal tooling used by 200+ engineers. Reduced CI times by 40%.',
      },
      {
        company: 'Beta Startup',
        title: 'Software Engineer',
        startDate: '2019',
        endDate: '2021',
        description:
          'Built customer-facing React applications. Owned the payments integration.',
      },
    ],
    freelance: [],
    projects: [
      {
        name: 'DevBoard',
        description: 'Open-source developer dashboard with plugin system.',
        links: ['github.com/alexrivera/devboard'],
      },
    ],
    portfolio: 'alexrivera.dev',
    skills: [
      { category: 'Languages', items: ['JavaScript', 'TypeScript', 'Python'] },
      { category: 'Frameworks', items: ['React', 'Node.js', 'FastAPI'] },
    ],
    gaps: [
      'Limited experience with Kubernetes at scale',
      'No formal design background',
    ],
    workingStyle: 'Autonomous contributor comfortable leading small teams.',
    lookingFor: 'Remote-first, senior IC or tech lead, $150k+',
  },
  revisions: [
    {
      original: 'Reduced CI times by 40%.',
      note: 'Quantified metrics are strong — can you specify before/after wall-clock times to make this more concrete?',
      suggested_edit: 'Reduced CI times by 40% (from ~18 min to ~11 min).',
    },
    {
      original: 'Built customer-facing React applications.',
      note: 'This is vague — consider naming the product or user scale.',
      suggested_edit:
        'Built customer-facing React applications serving 10k+ monthly active users.',
    },
  ],
  questions: [
    {
      question:
        'What was the scope of the CI improvement at Acme Corp? Did you design the solution or implement an existing one?',
      reference:
        'Led development of internal tooling used by 200+ engineers. Reduced CI times by 40%.',
    },
    {
      question:
        'Can you share measurable outcomes from the payments integration at Beta Startup (e.g. revenue processed, error rate reduction)?',
      reference: 'Owned the payments integration.',
    },
  ],
}
