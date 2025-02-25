'use client';

import * as React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export const CodeBlock: React.FC<{ language: string; value: string }> = ({ language, value }) => {
  return (
    <div className="relative my-4 overflow-hidden rounded-md border bg-muted/50">
      <div className="absolute right-3 top-3 z-10 flex h-6 items-center rounded bg-muted px-2 text-xs font-medium">
        {language}
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{ margin: 0, borderRadius: '0.375rem', padding: '1.5rem 1rem' }}
        className="rounded-md"
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}; 