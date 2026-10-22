/** Extract the first complete JSON object from a model answer. */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch {
      // A fenced wrapper may still contain the real object.
    }
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const source = fenced ? fenced[1] : text
  const fencedStart = source.indexOf("{")
  const fencedEnd = source.lastIndexOf("}")
  if (fencedStart === -1 || fencedEnd === -1 || fencedEnd <= fencedStart) {
    throw new Error("json_not_found")
  }
  return JSON.parse(source.slice(fencedStart, fencedEnd + 1))
}
