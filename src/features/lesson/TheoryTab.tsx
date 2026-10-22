import { useMemo } from "react"
import { BookOpen } from "lucide-react"
import { Markdown, slugify, textOf } from "../../lib/markdown"
import "./TheoryTab.css"

export function TheoryTab({ markdown }: { markdown: string }) {
  const headings = useMemo(() => {
    const out: Array<{ level: number; text: string; id: string }> = []
    for (const line of markdown.split(/\r?\n/)) {
      const match = line.match(/^(##|###)\s+(.+)$/)
      if (match) {
        const text = match[2].trim()
        out.push({ level: match[1].length, text, id: slugify(textOf(text)) })
      }
    }
    return out
  }, [markdown])

  return (
    <div className="theory-layout">
      <article className="lesson-markdown">
        <Markdown markdown={markdown} />
      </article>
      {headings.length > 0 && (
        <aside className="theory-rail" aria-label="Содержание урока">
          <div className="theory-rail__head">
            <BookOpen size={13} aria-hidden />
            <span>В этом уроке</span>
          </div>
          <nav>
            {headings.map((heading) => (
              <a
                key={`${heading.level}-${heading.id}`}
                href={`#${heading.id}`}
                className={heading.level === 3 ? "theory-rail__sub" : undefined}
              >
                {heading.text}
              </a>
            ))}
          </nav>
        </aside>
      )}
    </div>
  )
}
