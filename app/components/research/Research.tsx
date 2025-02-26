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
import { Loader2, Expand, List, Search, ChevronDown, User, Clock, ExternalLink, Maximize2, X, ChevronRight, RefreshCw, History, ArrowRight, Activity, Globe } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';

// Import custom components and utilities
import { MessageItem } from './MessageItem';
import { SidePanel } from './SidePanel';
import { SourcesPanel } from './SourcesPanel';
import { ActivityPanel } from './ActivityPanel';
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
    const isDeepResearch = researchMode === 'deep-research';
    
    return {
      ...initialResearchState,
      isDeepResearch,
      depth: isDeepResearch ? 2 : 1,
      breadth: isDeepResearch ? 3 : 2,
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
      // Update the model to Claude 3.7 Sonnet if not already set
      const currentModelKey = modelKey || selectedModel || 'claude-3.7-sonnet';
      
      // Log the model being used
      console.log(`Using model: ${currentModelKey}`);
      console.log(`Deep research mode: ${state.isDeepResearch ? 'enabled' : 'disabled'}`);
      
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: messageToSend,
          options: {
            isDeepResearch: state.isDeepResearch,
            depth: state.isDeepResearch ? state.depth : 1,
            breadth: state.isDeepResearch ? state.breadth : 2
          },
          modelKey: currentModelKey,
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
        console.log('Received chunk:', chunk.substring(0, 100) + '...');
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
    if (modelKey === 'claude-3.7-sonnet' || selectedModel === 'claude-3.7-sonnet') {
      return (
        <div className="hidden md:flex items-center gap-1 text-xs text-slate-400 bg-slate-800/30 px-2 py-0.5 rounded">
          <span>Claude 3.7 Sonnet: Fast, powerful model with 200K context window</span>
        </div>
      );
    }
    
    if (selectedModel?.includes('deepseek')) {
      return (
        <div className="hidden md:flex items-center gap-1 text-xs text-slate-400 bg-slate-800/30 px-2 py-0.5 rounded">
          <span>Fast Llama-3.3-70B-Instruct distilled with DeepSeek R1 - powered by Groq for exceptional speed.</span>
        </div>
      );
    }
    
    return (
      <div className="hidden md:flex items-center gap-1 text-xs text-slate-400 bg-slate-800/30 px-2 py-0.5 rounded">
        <span>{selectedModel || modelKey || 'Default model'}</span>
      </div>
    );
  };

  // Render the main UI
  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Simplified Header */}
      <header className="border-b border-border py-2 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {renderModelInfo()}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages container */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto py-4 px-6"
          >
            {state.messages.length === 0 && searchResults.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-xl">
                  <h1 className="text-3xl font-bold mb-4">Advanced Research Assistant</h1>
                  <p className="text-muted-foreground mb-8">
                    Ask any question and get thoroughly researched answers with web sources. Enable Deep Research for more comprehensive results.
                  </p>
                  
                  <div className="bg-card border border-border rounded-lg p-6">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center">
                        <Search className="h-5 w-5 mr-3 text-muted-foreground" />
                        <div className="text-left">
                          <p className="font-medium">Web Research</p>
                          <p className="text-sm text-muted-foreground">Searches across the web to find relevant information</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <Activity className="h-5 w-5 mr-3 text-muted-foreground" />
                        <div className="text-left">
                          <p className="font-medium">Reasoning Traces</p>
                          <p className="text-sm text-muted-foreground">Shows the AI's reasoning process in the main content area</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <Globe className="h-5 w-5 mr-3 text-muted-foreground" />
                        <div className="text-left">
                          <p className="font-medium">Source Citations</p>
                          <p className="text-sm text-muted-foreground">Provides credible sources for all information</p>
                        </div>
                      </div>
                    </div>
                  </div>
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
                
                {/* Display reasoning traces in the main content area */}
                {state.traces.length > 0 && (
                  <ReasoningTraces traces={state.traces} />
                )}
                
                {/* Show progress indicator */}
                {state.isLoading && (
                  <div className="flex items-center space-x-4 my-4">
                    <div className="w-full">
                      <Progress value={state.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">{state.status}</p>
                    </div>
                  </div>
                )}
                
                {/* DeepSearch results */}
                {searchResults.length > 0 && (
                  <div className="bg-card rounded-lg overflow-hidden border border-border">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Search className="h-4 w-4 text-muted-foreground" />
                          <span>Searching for "{searchQuery}"</span>
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
            
            {/* Controls below the search box */}
            <div className="max-w-3xl mx-auto mt-2 flex justify-between items-center">
              <div className="flex items-center space-x-2">
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
                
                {/* Deep Research Toggle */}
                <div className="flex items-center space-x-2 ml-2 px-2 py-1 border border-border rounded-md bg-background">
                  <Label 
                    htmlFor="deep-research" 
                    className="text-xs cursor-pointer"
                  >
                    Deep Research
                  </Label>
                  <Switch
                    id="deep-research"
                    checked={state.isDeepResearch}
                    onCheckedChange={(checked) => {
                      setState(prev => ({
                        ...prev,
                        isDeepResearch: checked,
                        depth: checked ? 2 : 1,
                        breadth: checked ? 3 : 2
                      }));
                    }}
                    className="scale-75 origin-right"
                  />
                </div>
              </div>
              
              {/* Model Selector Dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1 bg-transparent border-border hover:bg-secondary/60"
                  >
                    <span className="text-xs truncate max-w-28">
                      {selectedModel === 'claude-3.7-sonnet' ? 'Claude 3.7 Sonnet' :
                       selectedModel === 'deepseek-r1' ? 'DeepSeek R1' :
                       selectedModel === 'gpt-4o' ? 'GPT-4o' :
                       selectedModel || 'Select Model'}
                    </span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-0" align="end">
                  <div className="p-2">
                    <div className="space-y-1">
                      <button
                        className={`w-full text-left px-2 py-1.5 text-sm rounded-md ${selectedModel === 'claude-3.7-sonnet' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                        onClick={() => updateModel('claude-3.7-sonnet')}
                      >
                        Claude 3.7 Sonnet
                      </button>
                      <button
                        className={`w-full text-left px-2 py-1.5 text-sm rounded-md ${selectedModel === 'deepseek-r1' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                        onClick={() => updateModel('deepseek-r1')}
                      >
                        DeepSeek R1
                      </button>
                      <button
                        className={`w-full text-left px-2 py-1.5 text-sm rounded-md ${selectedModel === 'gpt-4o' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                        onClick={() => updateModel('gpt-4o')}
                      >
                        GPT-4o
                      </button>
                      <button
                        className={`w-full text-left px-2 py-1.5 text-sm rounded-md ${selectedModel === 'claude-3-sonnet' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                        onClick={() => updateModel('claude-3-sonnet')}
                      >
                        Claude 3 Sonnet
                      </button>
                      <button
                        className={`w-full text-left px-2 py-1.5 text-sm rounded-md ${selectedModel === 'llama-3-70b-instruct' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                        onClick={() => updateModel('llama-3-70b-instruct')}
                      >
                        Llama-3-70B-Instruct
                      </button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        
        {/* Right side panel with tabs for sources and activities */}
        <div className="w-80 min-w-80 h-full border-l border-border">
          <Tabs defaultValue="sources" className="h-full flex flex-col">
            <TabsList className="w-full flex border-b border-border rounded-none">
              <TabsTrigger 
                value="sources" 
                onClick={() => setActiveTab('sources')}
                className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-primary"
              >
                Sources ({state.sources.length})
              </TabsTrigger>
              <TabsTrigger 
                value="activities" 
                onClick={() => setActiveTab('activities')}
                className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-primary"
              >
                Activity
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="sources" className="flex-1 overflow-hidden p-0 m-0">
              <SourcesPanel sources={state.sources} />
            </TabsContent>
            
            <TabsContent value="activities" className="flex-1 overflow-hidden p-0 m-0">
              <ActivityPanel activities={state.activities} isLoading={state.isLoading} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
} 