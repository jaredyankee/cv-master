/**
 * The tool schemas in `private/registry/schema.js` are the source of truth for
 * every provider. They are written as plain JSON Schema and each provider wants
 * a slightly different dialect, so the translation lives here rather than in
 * three copies of the schema.
 *
 * Our schemas only ever use type, properties, required, description, items and
 * enum, which is the intersection every provider supports. Keep it that way:
 * reaching for $ref, oneOf or format means writing three adapters instead of
 * one.
 */

/**
 * OpenAI's strict mode guarantees the output matches the schema, but only
 * accepts schemas in a narrow form: every object must set
 * `additionalProperties: false` and must list *every* property in `required`.
 *
 * That is at odds with having optional fields, so the standard move is to keep
 * them required and let them be null. Our normalizers already coerce null to
 * empty, so a nulled optional field costs nothing downstream.
 *
 * @param {object} schema  plain JSON Schema
 * @returns {object} a deep copy in strict form; the input is not touched
 */
export function toStrictSchema(schema) {
    if (!schema || typeof schema !== 'object') return schema

    if (Array.isArray(schema)) return schema.map(toStrictSchema)

    const out = {}
    for (const [key, value] of Object.entries(schema)) {
        if (key === 'properties' && value && typeof value === 'object') {
            out.properties = Object.fromEntries(
                Object.entries(value).map(([k, v]) => [k, toStrictSchema(v)])
            )
        } else if (key === 'items') {
            out.items = toStrictSchema(value)
        } else if (key === 'required') {
            // Recomputed below from the full property list.
            continue
        } else {
            out[key] = value && typeof value === 'object' ? toStrictSchema(value) : value
        }
    }

    if (out.type === 'object' && out.properties) {
        const names = Object.keys(out.properties)
        const wasRequired = new Set(Array.isArray(schema.required) ? schema.required : [])

        out.required = names
        out.additionalProperties = false

        // Anything the original schema did not require becomes nullable, so
        // "required by strict mode" doesn't turn into "the model must invent
        // a value for it".
        for (const name of names) {
            if (wasRequired.has(name)) continue
            const prop = out.properties[name]
            if (prop && typeof prop.type === 'string' && prop.type !== 'null') {
                prop.type = [prop.type, 'null']
            }
        }
    }

    return out
}

/**
 * Gemini's `responseJsonSchema` takes real JSON Schema but supports only part
 * of it. Everything our schemas use is on the supported list, so this is a
 * copy that drops anything outside it rather than a translation — if a schema
 * ever grows an unsupported keyword, it is dropped here instead of failing the
 * request with an opaque 400.
 */
const GEMINI_KEYWORDS = new Set([
    '$id', '$defs', '$ref', '$anchor',
    'type', 'format', 'title', 'description', 'enum',
    'items', 'prefixItems', 'minItems', 'maxItems',
    'minimum', 'maximum', 'anyOf', 'oneOf',
    'properties', 'additionalProperties', 'required',
    'propertyOrdering',
])

export function toGeminiSchema(schema) {
    if (!schema || typeof schema !== 'object') return schema
    if (Array.isArray(schema)) return schema.map(toGeminiSchema)

    const out = {}
    for (const [key, value] of Object.entries(schema)) {
        if (!GEMINI_KEYWORDS.has(key)) continue
        if (key === 'properties' && value && typeof value === 'object') {
            out.properties = Object.fromEntries(
                Object.entries(value).map(([k, v]) => [k, toGeminiSchema(v)])
            )
        } else {
            out[key] = value && typeof value === 'object' ? toGeminiSchema(value) : value
        }
    }
    return out
}

/** Anthropic takes the schema as written. Here for symmetry at the call site. */
export const toAnthropicSchema = schema => schema
