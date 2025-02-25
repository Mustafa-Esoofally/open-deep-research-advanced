'use client';

import * as React from 'react';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Card, CardContent } from '@/app/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Badge } from '@/app/components/ui/badge';
import { Search, RefreshCw, ChevronDown, ExternalLink } from 'lucide-react';
import { ResearchState } from './types';
import { SourceCard, Source } from './SourceCard';

interface SidePanelProps {
  state: ResearchState;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function SidePanel({ state, activeTab, setActiveTab }: SidePanelProps) {
  // Generate mock search results
  const mockSearchResults = [
    {
      id: 1,
      title: 'Top news of the day | February 25, 2025',
      url: 'www.thehindu.com',
      source: 'The Hindu'
    },
    {
      id: 2,
      title: 'US News Today highlights on February 10, 2025',
      url: 'www.livemint.com',
      source: 'Livemint'
    },
    {
      id: 3,
      title: 'February 25, 2025 Calendar with Holidays & Celebrations',
      url: 'www.wincalendar.com',
      source: 'WinCalendar'
    },
    {
      id: 4,
      title: 'February 1, 2025: Donald Trump presidency news',
      url: 'www.cnn.com',
      source: 'CNN'
    },
    {
      id: 5,
      title: 'Pictures of the Day | February 25, 2025',
      url: 'www.reuters.com',
      source: 'Reuters'
    }
  ];
  
  return (
    <div className="flex flex-col h-full">
      {/* DeepSearch header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-2">
          <Search className="h-5 w-5" />
          <span className="font-semibold">DeepSearch</span>
          <span className="text-xs text-gray-400">14s • 30 sources</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <Search className="h-4 w-4 text-gray-400" />
          <span>Searching for "news on February 25, 2025"</span>
        </div>
      </div>
      
      {/* Search results */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {mockSearchResults.map((result) => (
            <div key={result.id} className="mb-4 group">
              <div className="flex gap-3 items-start">
                <div className="w-6 h-6 bg-gray-700 rounded flex items-center justify-center text-xs">
                  {result.source.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="text-sm mb-1 group-hover:text-blue-400 flex items-start">
                    <span className="flex-1">{result.title}</span>
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 ml-1 flex-shrink-0" />
                  </div>
                  <div className="text-xs text-gray-400">{result.url}</div>
                </div>
              </div>
            </div>
          ))}
          
          <button className="text-sm text-gray-400 mt-2">See 5 more</button>
          
          <div className="mt-6 text-sm">
            <p className="mb-3">• From this search, there are various news articles from February 25, 2025, covering different topics like legal cases, political events, and social issues.</p>
          </div>
          
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm mb-3">
              <RefreshCw className="h-4 w-4 text-gray-400" />
              <span>Searching for "what is special about February 25, 2025"</span>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
} 