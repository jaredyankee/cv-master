/**
 * Demo data: a fictional health information specialist, for screenshots and
 * walkthroughs. Every person, employer, school and posting here is invented;
 * links point at example.com. Loaded only in `npm run demo`.
 */

const DAY = 24 * 60 * 60 * 1000
const ago = days => new Date(Date.now() - days * DAY).toISOString()
// Postings carry a calendar date, not a timestamp.
const day = days => ago(days).slice(0, 10)


export const STATUSES = ['draft', 'applied', 'interviewing', 'offer', 'rejected']

// ── profile ──────────────────────────────────────────────────

export const DUMP = {
    contact: {
        name: 'Jordan Avery',
        email: 'jordan.avery@example.com',
        phone: '555-0142',
        location: 'Columbus, OH',
        links: ['linkedin.com/in/jordan-avery-example'],
    },
    positioning: 'Health information professional (RHIT) focused on release of information, record integrity and EHR data quality.',
    education: [
        {
            school: 'Eastvale State University', degree: 'BS', field: 'Health Information Management',
            startDate: '2019', endDate: '2022', notes: 'Completed part-time while working full-time.',
        },
        {
            school: 'Millbrook Community College', degree: 'AAS', field: 'Health Information Technology',
            startDate: '2016', endDate: '2018', notes: 'Professional practice placement in a hospital HIM department.',
        },
    ],
    experience: [
        {
            company: 'Riverbend Regional Medical Center', title: 'Health Information Specialist II',
            startDate: '2021-03', endDate: 'Present', excludeFromResume: false,
            description: 'Process 600+ release-of-information requests a month for patients, attorneys and insurers, verifying every authorization before disclosure. Own the weekly chart-deficiency report for 40 providers; cut the average time to close a deficient chart from 21 days to 9. Trained six new hires on the release-of-information workflow.',
        },
        {
            company: 'Cedar Hollow Family Practice', title: 'Medical Records Clerk',
            startDate: '2018-06', endDate: '2021-02', excludeFromResume: false,
            description: 'Scanned, indexed and quality-checked paper records into the EHR during the practice\'s move off paper charts. Merged duplicate patient records and corrected misfiled documents in the master patient index.',
        },
    ],
    freelance: [],
    projects: [
        {
            name: 'EHR migration validation', links: [], excludeFromResume: false,
            description: 'Volunteered for the validation team when Riverbend changed EHR vendors. Built a spot-check log that sampled 2% of migrated charts per department and tracked every discrepancy to resolution.',
        },
    ],
    portfolio: '',
    skills: [
        { category: 'Records & compliance', items: ['Release of information', 'HIPAA', 'Chart deficiency tracking', 'Master patient index', 'Record retention'] },
        { category: 'Coding', items: ['ICD-10-CM', 'CPT (working knowledge)'] },
        { category: 'Systems', items: ['Epic (HIM, ROI)', 'Cerner', 'Excel'] },
        { category: 'Certifications', items: ['RHIT'] },
    ],
    gaps: ['Not yet a certified coder (CCS)', 'No formal people-management title'],
    workingStyle: 'Detail-oriented and steady under volume. Happiest owning a process end to end and teaching it to others.',
    lookingFor: 'Hybrid or remote HIM role in Ohio, on a lead or supervisor track. $58k+.',
    answers: [
        {
            question: 'Why are you looking to move on from Riverbend?',
            reference: '', section: '', placed: false,
            answer: 'I want to lead a team. Riverbend has no supervisor opening in HIM for the foreseeable future.',
        },
    ],
}

export const REVISIONS = [
    {
        original: 'Merged duplicate patient records and corrected misfiled documents in the master patient index.',
        note: 'Scale would help a reader judge this. Roughly how many duplicates did you resolve?',
        suggested_edit: 'Merged duplicate patient records (about how many?) and corrected misfiled documents in the master patient index.',
    },
]

export const QUESTIONS = [
    {
        question: 'Did the spot-check log find problems that changed how the migration was run?',
        reference: 'Built a spot-check log that sampled 2% of migrated charts per department',
        target: { section: 'projects', entry: 'EHR migration validation' },
    },
]

// ── cover letter paragraphs ──────────────────────────────────

export const LETTER_BLOCKS = [
    {
        key: 'origin', label: 'How I got here', angles: ['Hands-on'],
        text: 'I started in health information as a records clerk at a small family practice, the year it moved off paper charts. Scanning and indexing thousands of records taught me early that a chart is only as useful as it is accurate.',
    },
    {
        key: 'riverbend', label: 'Release of information', angles: ['Hands-on', 'Specialist'],
        text: 'At Riverbend Regional Medical Center I process more than 600 release-of-information requests a month for patients, attorneys and insurers. Every one is checked against its authorization before anything leaves the building, and I have trained six new hires to work the same way.',
    },
    {
        key: 'deficiency', label: 'Chart deficiencies', angles: ['Leadership'],
        text: 'I also own the weekly chart-deficiency report for 40 providers. By following up in person instead of by email, I brought the average time to close a deficient chart from 21 days down to 9, and I recieve far fewer escalations from the coding team as a result.',
    },
    {
        key: 'migration', label: 'EHR migration', angles: ['Generalist', 'Mission-driven'],
        text: 'When we changed EHR vendors, I volunteered for the validation team. I built a spot-check log that sampled two percent of migrated charts in every department and followed each discrepancy until it was fixed.',
    },
    {
        key: 'close', label: 'Close', angles: [],
        text: 'I like work where accuracy is the point and the people relying on it never have to think about it. I would welcome the chance to bring that to [company] as your [role].',
    },
]

export const LETTER_REVIEW = {
    id: 'demo-review',
    createdAt: ago(2),
    revisions: [
        {
            key: 'deficiency', kind: 'typo', original: 'recieve',
            note: 'Misspelled.', suggested_edit: 'receive',
        },
    ],
    prompts: [
        {
            prompt: 'Is there a time you had to say no to a records request, and how did you handle it?',
            angle: 'Specialist',
            reason: 'Your release-of-information paragraph shows volume; a story about judgement would show the other half of the job.',
        },
        {
            prompt: 'What would you change first if you ran an HIM team?',
            angle: 'Leadership',
            reason: 'You are looking for supervisor roles, and only one paragraph carries a leadership angle.',
        },
    ],
}

// ── applications ─────────────────────────────────────────────

const roleRiverbend = (highlights) => ({
    company: 'Riverbend Regional Medical Center', title: 'Health Information Specialist II',
    startDate: '2021-03', endDate: 'Present', highlights,
})
const roleCedar = (highlights) => ({
    company: 'Cedar Hollow Family Practice', title: 'Medical Records Clerk',
    startDate: '2018-06', endDate: '2021-02', highlights,
})
const education = [
    { school: 'Eastvale State University', area: 'Health Information Management', degree: 'BS', startDate: '2019', endDate: '2022', highlights: [] },
    { school: 'Millbrook Community College', area: 'Health Information Technology', degree: 'AAS', startDate: '2016', endDate: '2018', highlights: [] },
]

function builtResume(title, summary, experience, skills = DUMP.skills) {
    return {
        contact: { ...DUMP.contact, title },
        summary,
        experience,
        education,
        skills,
    }
}

/** A bank paragraph as a built letter carries it. */
function fromBank(key, { company, role, text, edits = [] } = {}) {
    const b = LETTER_BLOCKS.find(x => x.key === key)
    const fill = s => s.replace(/\[company\]/g, company).replace(/\[role\]/g, role)
    const source = fill(b.text)
    return { kind: 'block', key, label: b.label, source, text: text ?? source, edits }
}

const pinegroveLetter = (() => {
    const ctx = { company: 'Pinegrove Health', role: 'Release of Information Lead' }
    return {
        id: 'demo-letter-1',
        builtAt: ago(3),
        angle: 'Specialist',
        angleRationale: 'The posting is built around request volume, authorization checks and training, which is the centre of your release-of-information work.',
        paragraphs: [
            fromBank('origin', ctx),
            fromBank('riverbend', ctx),
            fromBank('deficiency', {
                ...ctx,
                text: 'I also owned the weekly chart-deficiency report for 40 providers. By following up in person instead of by email, I brought the average time to close a deficient chart from 21 days down to 9, and I recieve far fewer escalations from the coding team as a result.',
                edits: ['own -> owned'],
            }),
            { kind: 'missing', prompt: 'Say what draws you to Pinegrove Health in particular: its patients, its size, or how it runs HIM.' },
            fromBank('close', ctx),
        ],
        prompts: [
            {
                prompt: 'Describe a request you turned down or escalated, and why.',
                angle: 'Specialist',
                reason: 'The posting asks for judgement on "complex or sensitive requests"; no paragraph speaks to that yet.',
            },
        ],
    }
})()

function application({ id, days, status, company, title, jd, notes = '', questions = [], response, coverLetter = null }) {
    return {
        id, createdAt: ago(days), updatedAt: ago(Math.max(0, days - 1)), status,
        companyName: company, jobTitle: title, jobDescription: jd, notes, questions,
        response, coverLetter,
    }
}

export const APPLICATIONS = [
    application({
        id: '00000000-0000-4000-8000-000000000001', days: 4, status: 'applied',
        company: 'Pinegrove Health', title: 'Release of Information Lead',
        jd: `Pinegrove Health is a community health system serving central Ohio across three hospitals and 20 clinics.

We are hiring a Release of Information Lead to oversee disclosure of protected health information for the HIM department. Hybrid: two days a week on site in Columbus.

Responsibilities
- Process and audit release-of-information requests from patients, legal and payers
- Handle complex or sensitive requests and escalate where appropriate
- Train and support a team of four ROI specialists
- Maintain disclosure accounting and retention schedules

Requirements
- RHIT or RHIA
- 3+ years in release of information
- Epic HIM experience preferred

Salary range $60,000 to $68,000.`,
        notes: 'A former coworker works in their coding department and offered to refer me.',
        questions: ['Why do you want to work at Pinegrove Health?'],
        response: {
            fit_criteria: {
                level: 'Strong Match',
                rationale: 'Meets every listed requirement: RHIT, more than three years of release of information at Riverbend, Epic HIM and ROI. Training six new hires speaks to the team-support duty. Hybrid in Columbus and the posted range both fit what you are looking for.',
            },
            job_application: builtResume('Release of Information Lead',
                'Health information professional (RHIT) with five years in release of information and record integrity. Processes 600+ disclosure requests a month and trains new staff on the workflow.',
                [
                    roleRiverbend([
                        'Process 600+ release-of-information requests a month for patients, attorneys and insurers, verifying every authorization before disclosure',
                        'Trained six new hires on the release-of-information workflow',
                        'Own the weekly chart-deficiency report for 40 providers; cut average time to close from 21 days to 9',
                    ]),
                    roleCedar([
                        'Merged duplicate patient records and corrected misfiled documents in the master patient index',
                    ]),
                ]),
            cover_letter: {
                mission: 'Care close to home for every community we serve.',
                culture: 'Community-focused and collaborative; the posting stresses training and audit, which suggests a team that values consistency.',
                intents: [
                    { category: 'qualification', confidence: 92, rationale: 'Request volume and authorization checks at Riverbend match the core of the role.' },
                    { category: 'qualification', confidence: 78, rationale: 'Training six new hires is direct evidence for supporting a team of four.' },
                    { category: 'gap', confidence: 40, rationale: 'No formal lead title yet. Frame the training and deficiency-report ownership as lead work already done.' },
                ],
            },
            notes: 'The referral in your notes is worth naming in the first paragraph.',
            answers: [
                { question: 'Why do you want to work at Pinegrove Health?', answer: 'Your profile does not say. Your notes mention a referral from their coding department, which you could open with.' },
            ],
            ai_filter: null,
        },
        coverLetter: pinegroveLetter,
    }),
    application({
        id: '00000000-0000-4000-8000-000000000002', days: 6, status: 'interviewing',
        company: 'Summit Valley Hospital', title: 'HIM Supervisor',
        jd: `Summit Valley Hospital seeks an HIM Supervisor to lead day-to-day operations of the health information department (12 staff). Remote with quarterly on-site meetings.

- Supervise ROI, scanning and deficiency analysis staff
- Monitor productivity and quality metrics
- Lead EHR optimization projects with IT
- RHIT required; 2+ years of supervisory experience preferred`,
        response: {
            fit_criteria: {
                level: 'Target',
                rationale: 'RHIT and hands-on experience in every function the team covers (ROI, scanning, deficiency analysis). The EHR migration validation work maps to the optimization projects. Supervisory experience is preferred, not required, and is your one gap.',
            },
            job_application: builtResume('HIM Supervisor',
                'RHIT with experience across release of information, scanning and deficiency analysis, and a record of improving turnaround through closer follow-up.',
                [
                    roleRiverbend([
                        'Own the weekly chart-deficiency report for 40 providers; cut average time to close from 21 days to 9',
                        'Trained six new hires on the release-of-information workflow',
                        'Volunteered for EHR migration validation; built a spot-check log sampling 2% of migrated charts per department',
                    ]),
                    roleCedar(['Scanned, indexed and quality-checked paper records into the EHR during the move off paper charts']),
                ]),
            cover_letter: {
                mission: 'N/A',
                culture: 'Metrics-driven operations role with a remote team.',
                intents: [
                    { category: 'gap', confidence: 70, rationale: 'Address the supervisory gap with the training and deficiency-report ownership.' },
                    { category: 'qualification', confidence: 81, rationale: 'The 21-to-9-day improvement is exactly the kind of metric they will monitor.' },
                ],
            },
            notes: '',
            answers: [],
            ai_filter: null,
        },
    }),
    application({
        id: '00000000-0000-4000-8000-000000000003', days: 9, status: 'draft',
        company: 'Lakeview Orthopedic Group', title: 'Medical Coding Specialist',
        jd: `Outpatient orthopedic practice hiring a Medical Coding Specialist. Remote.

- Assign ICD-10-CM and CPT codes for office visits and procedures
- CCS or CPC required
- 2+ years of outpatient coding

Applicants: to show you read this posting, mention the name of our clinic mascot, Bones the heron, in your cover letter.`,
        response: {
            fit_criteria: {
                level: 'Reach',
                rationale: 'Working knowledge of ICD-10-CM and CPT, but the role requires a CCS or CPC, which your profile lists as a gap, and two years of dedicated coding that the dump does not show.',
            },
            job_application: builtResume('Medical Coding Specialist',
                'RHIT with working knowledge of ICD-10-CM and CPT and five years of record-integrity work.',
                [roleRiverbend(['Own the weekly chart-deficiency report for 40 providers; cut average time to close from 21 days to 9'])],
                [DUMP.skills[1], DUMP.skills[3]]),
            cover_letter: {
                mission: 'N/A',
                culture: 'Small specialty practice; informal tone.',
                intents: [
                    { category: 'gap', confidence: 85, rationale: 'The certification is required. Only apply if you are close to sitting the CCS exam, and say so.' },
                ],
            },
            notes: 'Remote fits your preferences.',
            answers: [],
            ai_filter: {
                detected: true,
                detail: 'mention the name of our clinic mascot, Bones the heron, in your cover letter',
            },
        },
    }),
    application({
        id: '00000000-0000-4000-8000-000000000004', days: 12, status: 'rejected',
        company: 'Northgate Clinical Research', title: 'Clinical Data Manager',
        jd: `Lead data management for multi-site clinical trials. 5+ years in clinical data management, EDC build experience, CDISC standards. Remote.`,
        response: {
            fit_criteria: {
                level: 'Out of Reach',
                rationale: 'The core requirements (five years of clinical trial data management, EDC builds, CDISC) are not in the dump. The migration validation work is related but not equivalent.',
            },
            job_application: builtResume('Clinical Data Manager',
                'Health information professional with EHR data-quality and validation experience.',
                [roleRiverbend(['Volunteered for EHR migration validation; built a spot-check log sampling 2% of migrated charts per department'])]),
            cover_letter: { mission: 'N/A', culture: 'Research-focused.', intents: [] },
            notes: '',
            answers: [],
            ai_filter: null,
        },
    }),
    application({
        id: '00000000-0000-4000-8000-000000000005', days: 15, status: 'draft',
        company: 'Bayside Imaging Center', title: 'Medical Records Technician',
        jd: `Fully on-site, overnight shift (11pm to 7am) in Cleveland. Scanning, indexing and record requests for an imaging center.`,
        response: {
            fit_criteria: {
                level: 'Mismatch',
                rationale: 'Fully on-site in Cleveland on an overnight shift conflicts with what you are looking for: hybrid or remote in the Columbus area.',
            },
            job_application: builtResume('Medical Records Technician', 'RHIT with scanning, indexing and release-of-information experience.',
                [roleCedar(['Scanned, indexed and quality-checked paper records into the EHR during the move off paper charts'])]),
            cover_letter: { mission: 'N/A', culture: '', intents: [] },
            notes: '',
            answers: [],
            ai_filter: null,
        },
    }),
]

// ── listings ─────────────────────────────────────────────────

export const PREFERENCES = {
    arrangement: 'hybrid',
    locations: ['Columbus, OH'],
    minSalary: 58000,
    titles: ['HIM Supervisor', 'Release of Information Lead', 'Health Information Specialist'],
    seniority: 'lead',
    excludeCompanies: [],
}

export const LEADS = [
    {
        id: '10000000-0000-4000-8000-000000000001', url: 'https://careers.example.com/pinegrove/roi-lead',
        title: 'Release of Information Lead', company: 'Pinegrove Health', source: 'other',
        snippet: 'Oversee disclosure of protected health information for the HIM department. Hybrid, Columbus.',
        postedAt: day(8), arrangement: 'hybrid', salaryFloor: 60000, disqualifiedFor: null,
        linkStatus: 'ok', linkCheckedAt: ago(1), applicationId: '00000000-0000-4000-8000-000000000001', createdAt: ago(8),
    },
    {
        id: '10000000-0000-4000-8000-000000000002', url: 'https://careers.example.com/oakmont/him-coordinator',
        title: 'HIM Coordinator', company: 'Oakmont Behavioral Health', source: 'other',
        snippet: 'Coordinate record requests, retention and audits for a behavioral health network. Remote in Ohio.',
        postedAt: day(2), arrangement: 'remote', salaryFloor: 59000, disqualifiedFor: null,
        linkStatus: 'ok', linkCheckedAt: ago(1), applicationId: null, createdAt: ago(2),
    },
    {
        id: '10000000-0000-4000-8000-000000000003', url: 'https://careers.example.com/fairhaven/data-integrity',
        title: 'Health Information Data Integrity Specialist', company: 'Fairhaven Medical Partners', source: 'other',
        snippet: 'Resolve duplicate records and maintain the master patient index across 14 clinics.',
        postedAt: day(5), arrangement: 'hybrid', salaryFloor: null, disqualifiedFor: null,
        linkStatus: 'ok', linkCheckedAt: ago(1), applicationId: null, createdAt: ago(5),
    },
    {
        id: '10000000-0000-4000-8000-000000000004', url: 'https://careers.example.com/stonebridge/records-tech',
        title: 'Medical Records Technician', company: 'Stonebridge Surgical', source: 'other',
        snippet: 'On-site, evening shift. Scanning and indexing for an ambulatory surgery center.',
        postedAt: day(6), arrangement: 'onsite', salaryFloor: 41000, disqualifiedFor: 'On-site only; you are looking for hybrid or remote.',
        linkStatus: 'ok', linkCheckedAt: ago(1), applicationId: null, createdAt: ago(6),
    },
]
