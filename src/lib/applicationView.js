/**
 * Sorting and filtering the applications list.
 *
 * All of it happens in the browser. The dashboard already holds every
 * application, so a round trip per change of sort order would spend a Netlify
 * invocation and a Neon query to reorder data that is already on screen.
 *
 * Pure functions: nothing here touches React or storage, so every rule is
 * testable on its own.
 */

import { FIT_LEVELS } from '../schemas/jobApplication.js'
import { applicationLabel } from '../components/Dashboard/applicationUtils.js'

/** Sorts offered in the menu, in menu order. */
export const SORTS = [
    { value: 'newest',  label: 'Newest first' },
    { value: 'oldest',  label: 'Oldest first' },
    { value: 'fit',     label: 'Best fit first' },
    { value: 'status',  label: 'Furthest along' },
    { value: 'company', label: 'Company A–Z' },
]

export const DEFAULT_VIEW = { sort: 'newest', fits: [], status: '', query: '' }

/**
 * The "fit" of an application with no analysis yet — still being assessed,
 * or the assessment failed. Filterable as its own option, because an
 * application you just created vanishing behind a fit filter reads as lost.
 */
export const NO_FIT = 'none'

const fitOf = app => app?.response?.fit_criteria?.level ?? null

/** Higher is better. Unknown fit ranks below every real level. */
function fitRank(app) {
    const i = FIT_LEVELS.indexOf(fitOf(app))
    return i === -1 ? -1 : i
}

const time = app => {
    const t = Date.parse(app?.createdAt ?? '')
    return Number.isFinite(t) ? t : 0
}

const byNewest = (a, b) => time(b) - time(a)

/**
 * The applications that pass the filters.
 *
 *   fits   — fit levels to show, plus NO_FIT for "not analysed yet". Empty
 *            means every fit.
 *   status — one lifecycle stage, or '' for any.
 *   query  — matched case-insensitively against company, title and the
 *            label the card shows, so what you read on a card is what you
 *            can search for.
 */
export function filterApplications(apps, { fits = [], status = '', query = '' } = {}) {
    const list = Array.isArray(apps) ? apps : []
    const wantFits = new Set(fits)
    const q = String(query ?? '').trim().toLowerCase()

    return list.filter(app => {
        if (wantFits.size > 0) {
            const f = fitOf(app) ?? NO_FIT
            if (!wantFits.has(f)) return false
        }
        if (status && app?.status !== status) return false
        if (q) {
            const haystack = [app?.companyName, app?.jobTitle, applicationLabel(app ?? {})]
                .filter(Boolean).join(' ').toLowerCase()
            if (!haystack.includes(q)) return false
        }
        return true
    })
}

/**
 * The applications in the chosen order. Never mutates its input.
 *
 * Every order falls back to newest first on a tie, so two Targets, or two
 * applications at the same stage, stay in a predictable order instead of
 * shuffling between renders.
 *
 * @param {object[]} apps
 * @param {string} sort       one of SORTS
 * @param {string[]} statuses the lifecycle in pipeline order, for 'status'
 */
export function sortApplications(apps, sort = 'newest', statuses = []) {
    const list = Array.isArray(apps) ? [...apps] : []
    const stage = app => {
        const i = statuses.indexOf(app?.status)
        return i === -1 ? -1 : i
    }

    const compare = {
        newest:  byNewest,
        oldest:  (a, b) => time(a) - time(b),
        // Best first; applications still being assessed sink to the bottom
        // rather than posing as a poor fit.
        fit:     (a, b) => (fitRank(b) - fitRank(a)) || byNewest(a, b),
        // Furthest along the pipeline first — the ones closest to an answer.
        status:  (a, b) => (stage(b) - stage(a)) || byNewest(a, b),
        // An application whose company wasn't extracted sorts after every
        // named one. Its card label starts with the job title, so filing it
        // by that label would put "Platform Engineer at Delta" under P.
        company: (a, b) => {
            const ca = String(a?.companyName ?? '').trim().toLowerCase()
            const cb = String(b?.companyName ?? '').trim().toLowerCase()
            if (!ca !== !cb) return ca ? -1 : 1
            return ca.localeCompare(cb) || byNewest(a, b)
        },
    }[sort] ?? byNewest

    return list.sort(compare)
}

/** Filter, then sort. */
export function applyView(apps, view = DEFAULT_VIEW, statuses = []) {
    return sortApplications(filterApplications(apps, view), view.sort, statuses)
}

/** Whether any filter is narrowing the list (the sort alone never hides anything). */
export function isFiltered(view) {
    return Boolean(view && ((view.fits?.length ?? 0) > 0 || view.status || String(view.query ?? '').trim()))
}

/**
 * A stored view, trusted only as far as it can be checked. Local storage
 * outlives releases, so a sort that has since been removed, or a stage that
 * no longer exists, is dropped instead of silently filtering everything out.
 */
export function sanitizeView(raw, statuses = []) {
    const v = raw && typeof raw === 'object' ? raw : {}
    const validFits = new Set([...FIT_LEVELS, NO_FIT])
    return {
        sort: SORTS.some(s => s.value === v.sort) ? v.sort : DEFAULT_VIEW.sort,
        fits: Array.isArray(v.fits) ? v.fits.filter(f => validFits.has(f)) : [],
        status: typeof v.status === 'string' && (statuses.length === 0 || statuses.includes(v.status)) ? v.status : '',
        // The search box is not remembered: coming back to a list quietly
        // narrowed by last week's search is how things look lost.
        query: '',
    }
}
