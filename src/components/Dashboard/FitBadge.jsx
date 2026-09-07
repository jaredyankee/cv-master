import { FIT_LEVEL_META } from '../../schemas/jobApplication'

/** Colored pill for a fit level; renders nothing for unknown/missing levels. */
export default function FitBadge({ level }) {
    const meta = FIT_LEVEL_META[level]
    if (!meta) return null
    return (
        <span className="fit-badge" style={{ background: meta.cssVar }}>
            {meta.label}
        </span>
    )
}
