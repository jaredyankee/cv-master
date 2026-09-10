/**
 * Status lines for the two long-running AI calls. Progress steps through them
 * in order and holds on the last one — looping back to the first after two
 * minutes would read as a restart.
 *
 * They describe the actual stages of each prompt, so a stall late in the list
 * is a different signal than a stall on the first line.
 */

export const INGEST_PHRASES = [
    'Reading your story',
    'Separating roles from projects',
    'Normalizing dates and titles',
    'Grouping your skills',
    'Looking for things worth asking about',
    'Drafting suggested revisions',
    'Almost there',
]

export const BUILD_PHRASES = [
    'Reading the posting',
    'Matching requirements against your profile',
    'Assessing fit',
    'Selecting the strongest evidence',
    'Building your resume',
    'Outlining the cover letter',
    'Finishing up',
]
