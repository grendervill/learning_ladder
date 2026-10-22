import type { ReactNode } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"

export function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join("")
  if (typeof node === "object" && "props" in node) {
    return textOf((node as { props?: { children?: ReactNode } }).props?.children)
  }
  return ""
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
}

const components: Components = {
  h2({ children }) {
    return <h2 id={slugify(textOf(children))}>{children}</h2>
  },
  h3({ children }) {
    return <h3 id={slugify(textOf(children))}>{children}</h3>
  },
  a({ href, children }) {
    const external = Boolean(href && /^https?:\/\//.test(href))
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer noopener" : undefined}
      >
        {children}
      </a>
    )
  },
}

export function Markdown({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeHighlight, { detect: false, subset: ["lua", "bash", "text"] }]]}
      components={components}
    >
      {markdown}
    </ReactMarkdown>
  )
}
