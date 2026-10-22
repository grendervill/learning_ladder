/** Russian plural form: plural(1, ["урок","урока","уроков"]) → "урок". */
export function plural(count: number, forms: [string, string, string]): string {
  const absolute = Math.abs(count)
  const lastTwo = absolute % 100
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2]
  const last = absolute % 10
  if (last === 1) return forms[0]
  if (last >= 2 && last <= 4) return forms[1]
  return forms[2]
}
