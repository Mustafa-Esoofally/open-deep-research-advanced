'use client';

import * as React from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';
import { motion, AnimatePresence } from 'framer-motion';
import { Slider } from '@/app/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Textarea } from '@/app/components/ui/textarea';
import { Progress } from '@/app/components/ui/progress';
import { Switch } from '@/app/components/ui/switch';
import { Label } from '@/app/components/ui/label';
import { Sheet, SheetContent, SheetTrigger } from '@/app/components/ui/sheet';
import { ThemeToggle } from '@/app/components/ui/theme-toggle';
import { ModelSelector } from '@/app/components/ui/model-selector';
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { useModelSelection } from '@/app/hooks/useModelSelection';
import { Loader2, Expand, List, Search, ChevronDown, User, Clock, ExternalLink, Maximize2, X, ChevronRight, RefreshCw, History, ArrowRight } from 'lucide-react';

// Import custom components and utilities
import { MessageItem } from './MessageItem';
import { SidePanel } from './SidePanel';
import { SourcesPanel } from './SourcesPanel';
import { ReasoningTraces } from './ReasoningTraces';
import { processStreamData } from './StreamProcessor';
import { Message, ResearchState, initialResearchState } from './types';
import { debugLog } from './utils';

interface ResearchProps {
  initialQuery?: string;
  researchMode?: string;
  modelKey?: string;
}

export function Research({ initialQuery = '', researchMode = 'deep-research', modelKey }: ResearchProps) {
  // State for user input and chat messages
  const [input, setInput] = useState(initialQuery);
  const [state, setState] = useState<ResearchState>(() => {
    // Initialize state based on research mode
    if (researchMode === 'deep-research') {
      return {
        ...initialResearchState,
        isDeepResearch: true,
        depth: 2,
        breadth: 3,
        sources: [
          {
            title: 'How to display sources on the right side of chat in web applications',
            url: 'https://example.com/web-chat-design',
            domain: 'example.com',
            relevance: 0.95,
            snippet: 'Best practices for designing chat interfaces include placing sources on the right side for easy reference.'
          },
          {
            title: 'UI/UX Design Patterns for Chat Applications',
            url: 'https://uidesign.example.org/chat-patterns',
            domain: 'uidesign.example.org',
            relevance: 0.87,
            snippet: 'Modern chat interfaces often place supplementary information on the right side panel.'
          },
          {
            title: 'Research on Source Citation in AI Assistants',
            url: 'https://ai-research.example.net/citations',
            domain: 'ai-research.example.net',
            relevance: 0.92,
            snippet: 'Studies show users prefer seeing sources prominently displayed with counts of references.'
          },
          {
            title: 'The Psychology of Information Sources in Chat Interfaces',
            url: 'https://psychology.example.edu/chat-ux',
            domain: 'psychology.example.edu',
            relevance: 0.78,
            snippet: 'User trust increases when sources are clearly presented alongside chat conversations.'
          },
          {
            title: 'Implementing Source Panels in React Applications',
            url: 'https://react-dev.example.io/source-panels',
            domain: 'react-dev.example.io',
            relevance: 0.89,
            snippet: 'Tutorial on creating source panels for chat applications using React components.'
          }
        ]
      };
    } else if (researchMode === 'pro-search') {
      return {
        ...initialResearchState,
        isDeepResearch: true,
        depth: 1,
        breadth: 3,
        sources: [
          {
            title: 'Professional Search Interface Design',
            url: 'https://pro-search.example.com/design',
            domain: 'pro-search.example.com',
            relevance: 0.91,
            snippet: 'Professional search interfaces require clear source attribution and counts.'
          },
          {
            title: 'Advanced Search UI Components',
            url: 'https://ui-components.example.org/search',
            domain: 'ui-components.example.org',
            relevance: 0.85,
            snippet: 'Components for search interfaces including source panels and citation displays.'
          }
        ]
      };
    }
    return initialResearchState;
  });
  const [activeTab, setActiveTab] = useState<string>('sources');
  
  // State for UI elements
  const [isMobile, setIsMobile] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sheetPosition, setSheetPosition] = useState<'bottom' | 'right'>('bottom');
  const [showSidebar, setShowSidebar] = useState(true);
  
  // DeepSearch state
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  // Model selection
  const { selectedModel, updateModel } = useModelSelection();
  
  // Refs for DOM elements
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialQuerySubmittedRef = useRef(false);

  // When modelKey prop changes, update the selected model
  useEffect(() => {
    if (modelKey) {
      updateModel(modelKey);
    }
  }, [modelKey, updateModel]);

  // Enable deep research mode with predefined settings
  const enableDeepResearch = useCallback(() => {
    setState(prev => ({
      ...prev,
      isDeepResearch: true,
      depth: 2,
      breadth: 3
    }));
  }, []);

  // Function to scroll to bottom of chat
  const scrollToBottom = useCallback(() => {
    if (bottomRef.current && autoScrollEnabled) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [autoScrollEnabled]);

  // Effects for handling window resize and scroll
  useEffect(() => {
    const handleResize = () => {
      const isMobileView = window.innerWidth < 768;
      setIsMobile(isMobileView);
      setSheetPosition(isMobileView ? 'bottom' : 'right');
      setShowSidebar(!isMobileView);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Effect to scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [state.messages, scrollToBottom]);

  // Use this effect at the end, after handleSubmit has been defined
  // Effect to submit initialQuery when component mounts (put this after handleSubmit is defined)
  useEffect(() => {
    if (initialQuery && !initialQuerySubmittedRef.current) {
      initialQuerySubmittedRef.current = true;
      // Call handleSubmit only once when component mounts
      setTimeout(() => {
        handleSubmit(initialQuery);
      }, 0);
    }
  }, [initialQuery]); // Remove handleSubmit from deps array

  // Effect to detect scroll and disable auto-scroll when user scrolls up
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 200;
      setAutoScrollEnabled(isAtBottom);
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Function to get research content
  const getResearchContent = () => {
    return input;
  };

  // Handle DeepSearch
  const handleDeepSearch = async (query: string) => {
    setIsSearching(true);
    setSearchQuery(query);
    
    try {
      // Simulate search results - in a real app, this would be an API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock search results based on the image
      setSearchResults([
        {
          id: 1,
          title: `Top news of the day | ${query}`,
          url: 'www.thehindu.com',
          source: 'The Hindu'
        },
        {
          id: 2,
          title: `US News Today highlights on ${query}`,
          url: 'www.livemint.com',
          source: 'Livemint'
        },
        {
          id: 3,
          title: `${query} Calendar with Holidays & Celebrations`,
          url: 'www.wincalendar.com',
          source: 'WinCalendar'
        },
        {
          id: 4,
          title: `Donald Trump presidency news | CNN`,
          url: 'www.cnn.com',
          source: 'CNN'
        },
        {
          id: 5,
          title: `Pictures of the Day | ${query}`,
          url: 'www.reuters.com',
          source: 'Reuters'
        }
      ]);
    } catch (error) {
      toast.error('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle submit with DeepSearch integration
  const handleSubmit = async (userMessage: string) => {
    if (!userMessage.trim()) return;
    
    // Check if this is a search query
    if (userMessage.toLowerCase().includes('news') || 
        userMessage.toLowerCase().includes('search') || 
        userMessage.includes('find')) {
      handleDeepSearch(userMessage);
      return;
    }
    
    // Store the user message to use throughout the function
    const messageToSend = userMessage.trim();
    
    // Update state with user message first
    setState(prev => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          id: nanoid(),
          role: 'user',
          content: messageToSend,
          timestamp: Date.now()
        }
      ],
      isLoading: true,
      error: null,
      progress: 0,
      status: 'Starting research...',
      sources: [], // Clear sources for new query
      learnings: [], // Clear learnings for new query
      traces: [], // Clear traces for new query
    }));
    
    // Clear input field after the state has been updated
    setInput('');
    
    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: messageToSend,
          options: {
            isDeepResearch: state.isDeepResearch,
            depth: state.depth,
            breadth: state.breadth
          },
          modelKey: modelKey || selectedModel,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }
      
      // Process stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        processStreamData(chunk, state, setState);
      }
    } catch (error) {
      console.error('Error during research:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        progress: 0,
        status: 'Error'
      }));
      
      toast.error('Research failed', {
        description: errorMessage,
      });
    }
  };

  // Render the model info badge
  const renderModelInfo = () => {
    const displayName = selectedModel.includes('deepseek') ? 'DeepSeek R1 Distill 70B' : selectedModel;
    
    return (
      <div className="hidden md:flex items-center gap-1 text-xs text-slate-400 bg-slate-800/30 px-2 py-0.5 rounded">
        <span>Fast Llama-3.3-70B-Instruct distilled with DeepSeek R1 - powered by Groq for exceptional speed.</span>
      </div>
    );
  };

  // Render function for the main UI
  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border py-2 px-4 flex items-center justify-between">
        <div className="flex items-center">
          <span className="font-semibold text-lg">Grok 3</span>
          <span className="ml-2 text-sm bg-blue-600 text-white px-2 py-0.5 rounded">beta</span>
          <ChevronDown className="h-4 w-4 ml-1 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-2">
            <History className="h-4 w-4" />
            <span>History</span>
          </Button>
          {/* Hello button */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="bg-secondary hover:bg-secondary/80 rounded-full h-9 px-4"
          >
            hello
          </Button>
          {/* Header controls */}
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - only show when there are search results or messages */}
        {(searchResults.length > 0 || state.messages.length > 0) && showSidebar && (
          <div className="w-60 min-w-60 border-r border-border bg-card flex flex-col">
            <div className="p-4 border-b border-border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-5 w-5 flex items-center justify-center">
                  <span className="text-xl font-medium">·</span>
                </div>
                <div className="font-semibold">DeepSearch</div>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span>14s</span>
                <span>•</span>
                <span>30 sources</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm py-1 rounded text-muted-foreground">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <span>Assessing the greeting</span>
                </div>
              </div>
            </div>
            
            {/* Web pages indicator */}
            <div className="p-3 border-t border-border">
              <div className="flex items-center justify-center">
                <div className="flex -space-x-1.5">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div 
                      key={i} 
                      className="w-5 h-5 rounded-full border border-border" 
                      style={{ 
                        backgroundColor: ['#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#6366F1', '#ef4444', '#8B5CF6'][i % 7]
                      }} 
                    />
                  ))}
                </div>
                <span className="ml-2 text-sm text-muted-foreground">30 web pages</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages container */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto py-4 px-6"
          >
            {state.messages.length === 0 && searchResults.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-3xl font-bold mb-4">Ask anything</h1>
                  <p className="text-muted-foreground">Grok 3 is here to help with your questions</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* User messages */}
                {state.messages.map((message, index) => (
                  <MessageItem 
                    key={message.id} 
                    message={message}
                    state={state}
                    isLastMessage={index === state.messages.length - 1}
                  />
                ))}
                
                {/* DeepSearch results */}
                {searchResults.length > 0 && (
                  <div className="bg-card rounded-lg overflow-hidden border border-border">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Search className="h-4 w-4 text-muted-foreground" />
                          <span>Searching for "{searchQuery}"</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-secondary">
                            <Maximize2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-secondary">
                            <List className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="mb-6">
                        <div className="space-y-4 mt-2">
                          {searchResults.map((result) => (
                            <div key={result.id} className="flex gap-3 items-start group">
                              <div className="h-6 w-6 bg-muted rounded flex items-center justify-center text-xs flex-shrink-0 mt-0.5 text-muted-foreground">
                                {result.source.charAt(0)}
                              </div>
                              <div className="flex-1">
                                <div className="text-sm mb-1 group-hover:text-blue-400 flex items-start">
                                  <span className="flex-1">{result.title}</span>
                                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 ml-1 flex-shrink-0 text-muted-foreground" />
                                </div>
                                <div className="text-xs text-muted-foreground">{result.url}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <button className="mt-4 text-sm text-muted-foreground hover:text-foreground">See 5 more</button>
                      </div>
                      
                      <div className="mt-4 border-t border-border pt-4 text-sm">
                        <p className="flex gap-2 items-start">
                          <span className="text-lg leading-none mt-1.5">•</span>
                          <span>From this search, there are various news articles from {searchQuery}, covering different topics like legal cases, political events, and social issues.</span>
                        </p>
                      </div>
                      
                      <div className="mt-6 flex items-center gap-2 text-sm">
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                        <span>Searching for "what is special about {searchQuery}"</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-border p-4">
            <div className="max-w-3xl mx-auto relative">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything"
                className="resize-none bg-card border-border rounded-lg min-h-12 pr-12"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(input);
                    setInput('');
                  }
                }}
              />
              <div className="absolute right-3 bottom-3">
                <Button 
                  size="icon" 
                  variant="ghost"
                  className="rounded-full h-8 w-8 bg-muted hover:bg-muted/80"
                  onClick={() => {
                    if (input) {
                      handleSubmit(input);
                      setInput('');
                    }
                  }}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="max-w-3xl mx-auto mt-2 flex justify-start space-x-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="flex items-center gap-1 bg-transparent border-border hover:bg-secondary/60"
              >
                <Search className="h-3 w-3" />
                <span>DeepSearch</span>
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="bg-transparent border-border hover:bg-secondary/60"
              >
                <span>Think</span>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Right side sources panel */}
        {state.sources.length > 0 && (
          <SourcesPanel sources={state.sources} />
        )}
      </div>
    </div>
  );
} 