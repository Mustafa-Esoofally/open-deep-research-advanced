'use client';

import * as React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Source } from './types';
import { ExternalLink, Globe, Search } from 'lucide-react';

interface SourcesPanelProps {
  sources: Source[];
  isLoading?: boolean;
}

export function SourcesPanel({ sources, isLoading = false }: SourcesPanelProps) {
  const [sortBy, setSortBy] = useState<'relevance' | 'name'>('relevance');
  const [hoveredSourceIndex, setHoveredSourceIndex] = useState<number | null>(null);

  // Skip rendering if no sources
  if (sources.length === 0 && !isLoading) {
    return null;
  }

  // Sort sources based on current sort preference
  const sortedSources = [...sources].sort((a, b) => {
    if (sortBy === 'relevance') {
      return (b.relevance || 0) - (a.relevance || 0);
    } else {
      return a.title.localeCompare(b.title);
    }
  });

  // Format the relevance for display
  const formatRelevance = (relevance?: number) => {
    if (relevance === undefined) return 'N/A';
    return `${Math.round((relevance || 0) * 100)}%`;
  };

  return (
    <div className="w-full border-l border-border bg-card flex flex-col h-full max-h-full">
      <div className="p-4 border-b border-border flex justify-between items-center">
        <h3 className="font-semibold">Web Sources</h3>
        <div>
          <select 
            className="text-xs bg-background border border-border rounded p-1"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'relevance' | 'name')}
          >
            <option value="relevance">Sort by Relevance</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence initial={false}>
          {sortedSources.length > 0 ? (
            <div className="p-4 space-y-4">
              {sortedSources.map((source, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border border-border rounded-lg p-3 bg-background hover:bg-secondary/20 transition-colors"
                  onMouseEnter={() => setHoveredSourceIndex(index)}
                  onMouseLeave={() => setHoveredSourceIndex(null)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                        {source.favicon ? (
                          <img src={source.favicon} alt="" className="h-4 w-4" />
                        ) : (
                          <Globe className="h-3 w-3" />
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm font-medium hover:text-blue-500 flex items-start gap-1 group mb-1"
                      >
                        <span className="line-clamp-2">{source.title}</span>
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 mt-1 flex-shrink-0" />
                      </a>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <span className="truncate">{source.domain || new URL(source.url).hostname}</span>
                        {source.relevance !== undefined && (
                          <>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <div className="bg-muted h-1.5 w-14 rounded-full overflow-hidden">
                                <div 
                                  className="bg-blue-500 h-full rounded-full" 
                                  style={{ width: `${(source.relevance || 0) * 100}%` }}
                                />
                              </div>
                              <span>{formatRelevance(source.relevance)}</span>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {hoveredSourceIndex === index && source.snippet && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-xs text-muted-foreground bg-muted/30 p-2 rounded"
                        >
                          <p className="line-clamp-3">{source.snippet}</p>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground p-4">
              {isLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  <p>Searching for sources...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Search className="h-8 w-8 text-muted-foreground/50" />
                  <p>No sources found</p>
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
} 