import { FIT_LEVEL_META } from '../../schemas/jobApplication'

/**
 * Fit level as an outlined pill — the level's color on the border and the
 * text, never a fill. Keeps the page monochrome except where it matters.
 * Renders nothing for an unknown or missing level.
 */
export default function FitBadge({ level }) {
    const meta = FIT_LEVEL_META[level]
    if (!meta) return null
    return (
        <span className="fit-badge" style={{ '--fit': meta.cssVar }}>
            {meta.label}
        </span>
    )
}
