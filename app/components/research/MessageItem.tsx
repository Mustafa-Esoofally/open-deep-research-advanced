'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import { Avatar, AvatarFallback } from '@/app/components/ui/avatar';
import { Message, ResearchState } from './types';
import { CodeBlock } from './CodeBlock';
import { formatTime } from './utils';
import { User } from 'lucide-react';

// Markdown components configuration
const MarkdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    
    if (inline) {
      return <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-sm" {...props}>{children}</code>;
    }

    return (
      <CodeBlock
        language={(match && match[1]) || ''}
        value={String(children).replace(/\n$/, '')}
      />
    );
  },
  a({ node, className, children, ...props }) {
    return (
      <a className="text-blue-400 hover:text-blue-300 underline underline-offset-4" target="_blank" {...props}>
        {children}
      </a>
    );
  },
  ul({ node, className, children, ...props }) {
    return <ul className="list-disc pl-6 my-3" {...props}>{children}</ul>;
  },
  ol({ node, className, children, ...props }) {
    return <ol className="list-decimal pl-6 my-3" {...props}>{children}</ol>;
  },
  li({ node, className, children, ...props }) {
    return <li className="mt-2" {...props}>{children}</li>;
  },
  p({ node, className, children, ...props }) {
    return <p className="mb-3 last:mb-0" {...props}>{children}</p>;
  },
  h1({ node, className, children, ...props }) {
    return <h1 className="text-2xl font-bold mb-3 mt-6" {...props}>{children}</h1>;
  },
  h2({ node, className, children, ...props }) {
    return <h2 className="text-xl font-bold mb-3 mt-5" {...props}>{children}</h2>;
  },
  h3({ node, className, children, ...props }) {
    return <h3 className="text-lg font-bold mb-2 mt-4" {...props}>{children}</h3>;
  },
  blockquote({ node, className, children, ...props }) {
    return (
      <blockquote className="border-l-2 border-slate-700 pl-4 italic text-slate-300 my-3" {...props}>
        {children}
      </blockquote>
    );
  },
  table({ node, className, children, ...props }) {
    return (
      <div className="overflow-x-auto my-4">
        <table className="w-full border-collapse text-sm" {...props}>
          {children}
        </table>
      </div>
    );
  },
  th({ node, className, children, ...props }) {
    return (
      <th className="border-b border-slate-700 px-3 py-2 text-left font-medium text-slate-300" {...props}>
        {children}
      </th>
    );
  },
  td({ node, className, children, ...props }) {
    return (
      <td className="border-b border-slate-800 px-3 py-2 text-slate-200" {...props}>
        {children}
      </td>
    );
  },
};

interface MessageItemProps {
  message: Message;
  state?: ResearchState;
  isLastMessage?: boolean;
  index?: number;
}

export function MessageItem({ message, state, isLastMessage, index }: MessageItemProps) {
  // Parse content for citation references like [1], [2], etc.
  const content = message.content.replace(/\[(\d+)\]/g, '[[citation:$1]]');
  
  // Render citation links
  const renderWithCitations = (text: string) => {
    if (!text.includes('[[citation:')) return text;
    
    const parts = text.split(/(\[\[citation:(\d+)\]\])/g);
    return parts.map((part, i) => {
      if (part.match(/^\[\[citation:(\d+)\]\]$/)) {
        const num = parts[i+1];
        return (
          <a 
            key={i} 
            href={`#citation-${num}`}
            className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-500/10 text-xs text-blue-400 font-medium hover:bg-blue-500/20 cursor-pointer mx-0.5"
          >
            {num}
          </a>
        );
      } else if (!isNaN(Number(part)) && parts[i-1]?.includes('[[citation:')) {
        return null; // Skip the number part as it's already included in the citation
      } else {
        return part;
      }
    });
  };

  return (
    <div className={`${message.role === 'user' ? 'mb-8' : 'mb-10'}`}>
      {message.role === 'user' ? (
        <div className="flex gap-3 items-start">
          <div className="h-8 w-8 mt-0.5 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
            <User className="h-5 w-5 text-slate-400" />
          </div>
          <div className="flex-1 px-4 py-2.5 bg-slate-800 rounded-xl text-slate-100">
            {message.content}
          </div>
        </div>
      ) : (
        <div className="ml-11 pt-1">
          <div className="prose prose-invert max-w-none text-slate-200">
            <ReactMarkdown 
              components={{
                ...MarkdownComponents,
                p: ({ node, className, children, ...props }) => {
                  return (
                    <p className="mb-4 last:mb-0 text-slate-200" {...props}>
                      {renderWithCitations(String(children))}
                    </p>
                  );
                }
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
} 