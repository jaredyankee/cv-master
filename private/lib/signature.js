/**
 * A short fingerprint of a value, to tell whether it changed since a point in
 * time. Not cryptographic. src/lib/signature.js is the browser's copy; both
 * must hash the same JSON the same way, so change them together.
 */
export function signature(value) {
    const s = JSON.stringify(value ?? null)
    let h = 5381
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
    return (h >>> 0).toString(36)
}
