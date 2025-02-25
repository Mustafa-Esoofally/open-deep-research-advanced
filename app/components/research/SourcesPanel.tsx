'use client';

import * as React from 'react';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Card } from '@/app/components/ui/card';
import { Search, ExternalLink } from 'lucide-react';
import { Source } from './types';
import { SourceCard } from './SourceCard';

interface SourcesPanelProps {
  sources: Source[];
}

export function SourcesPanel({ sources }: SourcesPanelProps) {
  // Group sources by domain for counting
  const domainCount = React.useMemo(() => {
    const counts: Record<string, number> = {};
    sources.forEach(source => {
      const domain = source.domain || 'unknown';
      counts[domain] = (counts[domain] || 0) + 1;
    });
    return counts;
  }, [sources]);
  
  return (
    <div className="flex flex-col h-full border-l border-border w-72">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            <span className="font-semibold">Sources</span>
          </div>
          <span className="text-sm font-medium bg-primary/10 text-primary rounded-full px-2 py-0.5">
            {sources.length}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Sources found across {Object.keys(domainCount).length} domains
        </p>
      </div>
      
      {/* Sources list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {sources.length > 0 ? (
            sources.map((source, index) => (
              <div key={index} className="relative">
                <div className="absolute -left-1 top-3 flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {index + 1}
                </div>
                <div className="pl-6">
                  <SourceCard source={source} index={index} />
                </div>
                
                {/* Show domain count badge if this is the first occurrence of the domain */}
                {index === sources.findIndex(s => s.domain === source.domain) && source.domain && (
                  <div className="absolute top-3 right-3 bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded">
                    {domainCount[source.domain]} sources
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <p>No sources available</p>
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Footer with statistics */}
      {sources.length > 0 && (
        <div className="p-3 border-t border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total sources: {sources.length}</span>
            <span>From {Object.keys(domainCount).length} domains</span>
          </div>
        </div>
      )}
    </div>
  );
} 