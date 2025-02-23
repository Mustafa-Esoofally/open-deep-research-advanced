import { cn } from "@/lib/utils"
import { Markdown } from "./markdown"
import { UserIcon, BrainCircuitIcon } from 'lucide-react'

interface MessageProps {
  role: 'user' | 'assistant'
  content: string
  className?: string
}

export function Message({ role, content, className }: MessageProps) {
  const Icon = role === 'user' ? UserIcon : BrainCircuitIcon;

  return (
    <div
      className={cn(
        "group relative flex items-start gap-4 rounded-lg px-4",
        role === 'user' 
          ? "bg-primary/5 border border-primary/10" 
          : "bg-muted/50",
        className
      )}
    >
      <div className="mt-4 flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-background shadow">
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1 space-y-2 overflow-hidden px-1 py-4">
        <div className="prose dark:prose-invert max-w-none break-words">
          <Markdown>{content}</Markdown>
        </div>
      </div>
    </div>
  )
} 