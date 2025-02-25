'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/app/components/ui/card';

// Types
export interface Source {
  title: string;
  url: string;
  domain?: string;
  relevance?: number;
  snippet?: string;
  favicon?: string;
}

// Utility function for extracting domain from URL
export const extractDomain = (url: string): string => {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain;
  } catch (error) {
    return url;
  }
};

// SourceCard component for rendering source items with enhanced styling
export function SourceCard({ source, index }: { source: Source, index: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
    >
      <Card className="overflow-hidden transition-all hover:shadow-md hover:bg-muted/30">
        <CardContent className="p-0">
          <a 
            href={source.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block p-3 hover:bg-muted/20"
          >
            <div className="flex items-start gap-3">
              {source.favicon ? (
                <img 
                  src={source.favicon} 
                  alt=""
                  className="mt-1 h-5 w-5 rounded-sm object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-sm bg-primary/10 text-xs font-bold text-primary">
                  {source.domain ? source.domain[0].toUpperCase() : 'S'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="line-clamp-2 text-sm font-medium">
                  {source.title}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="truncate text-xs text-muted-foreground">
                    {source.domain || extractDomain(source.url)}
                  </span>
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-muted-foreground"></span>
                  <div className="flex items-center gap-0.5">
                    <span className="text-xs font-medium">
                      {source.relevance ? Math.round(source.relevance * 100) : 100}%
                    </span>
                    <span className="text-xs text-muted-foreground">relevant</span>
                  </div>
                </div>
              </div>
            </div>
          </a>
        </CardContent>
      </Card>
    </motion.div>
  );
} 