import { cn } from '@/lib/utils'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface CodeBlockProps {
  children: string
  className?: string
  inline?: boolean
}

export function CodeBlock({ children, className, inline }: CodeBlockProps) {
  const language = className?.replace('language-', '') || 'text'

  if (inline) {
    return (
      <code className="px-1 py-0.5 rounded-md bg-muted font-mono text-sm">
        {children}
      </code>
    )
  }

  return (
    <div className="relative group">
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: '1rem',
          borderRadius: '0.5rem',
          background: 'hsl(var(--muted))',
        }}
        PreTag="div"
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
  )
} 