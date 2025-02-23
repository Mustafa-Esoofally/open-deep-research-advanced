import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './code-block'

interface MarkdownProps {
  children: string
}

export function Markdown({ children }: MarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code: CodeBlock,
        pre: ({ children }) => <>{children}</>,
        p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:no-underline"
          >
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-4 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-4 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => <li className="mb-2 last:mb-0">{children}</li>,
        h1: ({ children }) => (
          <h1 className="text-2xl font-bold mb-4 last:mb-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-bold mb-3 last:mb-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-bold mb-3 last:mb-0">{children}</h3>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary pl-4 italic mb-4 last:mb-0">
            {children}
          </blockquote>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  )
} 