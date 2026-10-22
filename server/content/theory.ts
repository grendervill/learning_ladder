export interface TheorySplit {
  title: string
  theoryMarkdown: string
  practiceIntro: string
}

const ASSIGNMENT_HEADING = /^##\s+✏️\s+Задан/im

export function splitTheory(markdown: string, fallbackTitle: string): TheorySplit {
  const titleMatch = markdown.match(/^#\s+(.+)$/m)
  const title = titleMatch?.[1]?.trim() || fallbackTitle
  const heading = ASSIGNMENT_HEADING.exec(markdown)
  const body = titleMatch ? markdown.replace(titleMatch[0], "").trimStart() : markdown

  if (!heading) {
    return { title, theoryMarkdown: body.trim(), practiceIntro: "" }
  }

  const headingIndex = body.indexOf(heading[0])
  const before = headingIndex === -1 ? body : body.slice(0, headingIndex)
  const after = headingIndex === -1 ? "" : body.slice(headingIndex + heading[0].length)
  const theoryMarkdown = before
    .replace(/\n\s*---\s*$/g, "")
    .trim()
  return { title, theoryMarkdown, practiceIntro: after.trim() }
}
