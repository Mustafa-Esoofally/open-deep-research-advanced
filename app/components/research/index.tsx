'use client';

import * as React from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Components } from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Textarea } from '@/app/components/ui/textarea';
import { Progress } from '@/app/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Badge } from '@/app/components/ui/badge';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Separator } from '@/app/components/ui/separator';
import { Avatar, AvatarFallback } from '@/app/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/app/components/ui/sheet';
import { ThemeToggle } from '@/app/components/ui/theme-toggle';
import { Switch } from '@/app/components/ui/switch';
import { Label } from '@/app/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/app/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Skeleton } from '@/app/components/ui/skeleton';

// Types
interface Message {
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  metadata?: {
    progress?: number;
    status?: string;
  };
}

interface Source {
  title: string;
  url: string;
  relevance: number;
  domain?: string;
  favicon?: string;
}

interface CodeBlockProps {
  language: string;
  value: string;
}

// Example research topics
const EXAMPLE_TOPICS = [
  {
    title: 'Quantum Computing',
    description: 'Recent breakthroughs in quantum computing technology',
    query: 'What are the latest advancements in quantum computing?',
    icon: '🔬'
  },
  {
    title: 'Climate Change',
    description: 'Latest research on climate change mitigation strategies',
    query: 'What are the most effective climate change mitigation strategies according to recent research?',
    icon: '🌍'
  },
  {
    title: 'Artificial Intelligence',
    description: 'Current state and future directions of AI research',
    query: 'What are the current limitations of AI and how are researchers addressing them?',
    icon: '🧠'
  },
  {
    title: 'Space Exploration',
    description: 'Recent discoveries and future missions in space exploration',
    query: 'What are the most significant recent discoveries in space exploration?',
    icon: '🚀'
  },
];

// Helper functions
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const extractDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch (e) {
    return 'unknown';
  }
};

// Components
const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
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

export function Chat() {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [activeTab, setActiveTab] = useState<string>('research');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Deep research settings
  const [isDeepResearch, setIsDeepResearch] = useState(false);
  const [deepResearchSettings, setDeepResearchSettings] = useState({
    depth: 5,
    breadth: 5
  });
  const [learnings, setLearnings] = useState<string[]>([]);

  // Enable deep research mode with predefined settings
  const enableDeepResearch = useCallback(() => {
    setIsDeepResearch(true);
    setDeepResearchSettings({
      depth: 5,
      breadth: 5
    });
  }, []);

  // Effects
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Callbacks
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Configure markdown components
  const markdownComponents: Components = {
    code: ({ className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      return match ? (
        <CodeBlock
          language={match[1]}
          value={String(children).replace(/\n$/, '')}
        />
      ) : (
        <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono" {...props}>
          {children}
        </code>
      );
    },
    h1: ({ children }) => <h1 className="mt-6 mb-4 text-2xl font-bold leading-tight">{children}</h1>,
    h2: ({ children }) => <h2 className="mt-5 mb-3 text-xl font-bold leading-tight">{children}</h2>,
    h3: ({ children }) => <h3 className="mt-4 mb-2 text-lg font-semibold leading-tight">{children}</h3>,
    ul: ({ children }) => <ul className="my-3 ml-6 list-disc space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="my-3 ml-6 list-decimal space-y-1">{children}</ol>,
    li: ({ children }) => <li className="my-0.5">{children}</li>,
    p: ({ children }) => <p className="my-3 leading-relaxed">{children}</p>,
    a: ({ href, children }) => (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
      >
        {children}
      </a>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-3 border-l-4 border-muted pl-4 italic text-muted-foreground">
        {children}
      </blockquote>
    ),
    table: ({ children }) => (
      <div className="my-4 overflow-x-auto rounded-md border">
        <table className="min-w-full divide-y divide-border">
          {children}
        </table>
      </div>
    ),
    th: ({ children }) => (
      <th className="bg-muted/50 px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border-t border-border px-4 py-2 text-sm">
        {children}
      </td>
    ),
  };

  // Get the latest research content
  const getResearchContent = () => {
    const assistantMessages = messages.filter(m => m.type === 'assistant');
    return assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1].content : '';
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { 
      type: 'user', 
      content: userMessage,
      timestamp: new Date()
    }]);
    setIsLoading(true);
    setActiveTab('research');
    
    // Clear previous results
    setSources([]);
    setLearnings([]);

    try {
      // Add initial system message
      setMessages((prev) => [
        ...prev,
        { 
          type: 'system', 
          content: isDeepResearch ? 'Starting deep research...' : 'Starting research...',
          timestamp: new Date(),
          metadata: {
            progress: 0,
            status: 'initializing'
          }
        }
      ]);

      // Use the unified API endpoint with a parameter to indicate deep research mode
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: userMessage, 
          options: {
            isDeepResearch: isDeepResearch,
            depth: deepResearchSettings.depth,
            breadth: deepResearchSettings.breadth
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }
      if (!response.body) {
        throw new Error('No response body');
      }

      // Process the streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        // Handle multiple JSON objects in a single chunk
        const jsonObjects = text.trim().split('\n');
        
        for (const jsonStr of jsonObjects) {
          if (!jsonStr.trim()) continue;
          
          try {
            const data = JSON.parse(jsonStr);
  
            // Update messages based on the type of update
            setMessages((prev) => {
              const updated = [...prev];
              const lastMessage = updated[updated.length - 1];
  
              if (data.type === 'progress') {
                if (lastMessage.type === 'system') {
                  lastMessage.metadata = {
                    progress: data.progress,
                    status: data.status
                  };
                  
                  // For deep research, show detailed progress in system message
                  if (isDeepResearch && data.details) {
                    const { depth, breadth, queries } = data.details;
                    lastMessage.content = `Deep Research Progress:
- Depth: ${depth.current}/${depth.total}
- Breadth: ${breadth.current}/${breadth.total}
- Queries: ${queries.current}/${queries.total || '?'}
${queries.currentQuery ? `\nCurrently researching: "${queries.currentQuery}"` : ''}
                    
${data.status || 'Processing...'}`;
                  }
                }
              } else if (data.type === 'search_results') {
                // Immediately display search results when they come in
                updated.push({
                  type: 'assistant',
                  content: `## Search Results\n${data.content}`,
                  timestamp: new Date()
                });
              } else if (data.type === 'learning' && isDeepResearch) {
                // For deep research, accumulate learnings
                setLearnings(prev => [...prev, data.content]);
              } else if (data.type === 'sources') {
                // Update sources from the server
                if (data.sources && Array.isArray(data.sources)) {
                  setSources(prev => {
                    // Deduplicate sources by URL
                    const urlSet = new Set(prev.map((s: Source) => s.url));
                    const enrichedSources = data.sources.filter((s: any) => !urlSet.has(s.url));
                    
                    // Auto-switch to sources tab when we get sources
                    if (enrichedSources.length > 0 && prev.length === 0) {
                      setActiveTab('sources');
                      setTimeout(() => setActiveTab('research'), 3000); // Switch back after 3 seconds
                    }
                    
                    return [...prev, ...enrichedSources];
                  });
                }
              } else if (data.type === 'content') {
                // Extract URLs from content to populate sources
                const urlRegex = /(https?:\/\/[^\s]+)/g;
                const urls = data.content.match(urlRegex) || [];
                
                if (urls.length > 0) {
                  // Add new sources
                  const newSources = urls.map((url: string, index: number) => {
                    const domain = extractDomain(url);
                    return {
                      title: `Source from ${domain}`,
                      url,
                      domain,
                      relevance: 0.9 - (index * 0.05) // Decreasing relevance
                    };
                  });
                  
                  setSources(prev => {
                    // Deduplicate sources by URL
                    const urlSet = new Set(prev.map((s: Source) => s.url));
                    const filteredNew = newSources.filter((s: Source) => !urlSet.has(s.url));
                    return [...prev, ...filteredNew];
                  });
                }
                
                updated.push({
                  type: 'assistant',
                  content: data.content,
                  timestamp: new Date()
                });
              } else if (data.type === 'error') {
                updated.push({
                  type: 'system',
                  content: data.content || 'An error occurred during research.',
                  timestamp: new Date(),
                  metadata: {
                    progress: 0,
                    status: 'error'
                  }
                });
              }
  
              return updated;
            });
          } catch (e) {
            console.error('Failed to parse JSON:', jsonStr, e);
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to process request. Please try again.');
      setMessages((prev) => [
        ...prev,
        {
          type: 'system',
          content: 'Research failed. Please try again.',
          timestamp: new Date(),
          metadata: {
            progress: 0,
            status: 'error'
          }
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Render helper functions
  const renderSidebarContent = () => {
    return (
      <>
        <div className="flex-1 overflow-auto">
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent Researches</h2>
            <div className="space-y-1.5">
              {messages.filter(m => m.type === 'user').length > 0 ? 
                messages
                  .filter(m => m.type === 'user')
                  .slice(0, 5)
                  .map((message, i) => (
                    <Button 
                      key={i}
                      variant="ghost" 
                      className="h-auto w-full justify-start py-2.5 px-3 text-left text-sm hover:bg-muted"
                      onClick={() => setInput(message.content)}
                    >
                      <span className="line-clamp-2">{message.content}</span>
                    </Button>
                  ))
                : 
                <div className="rounded-md bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
                  Your recent research queries will appear here
                </div>
              }
            </div>
          </div>
          
          <Separator className="my-5" />
          
          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Example Topics</h2>
            <div className="grid gap-2">
              {EXAMPLE_TOPICS.map((topic, i) => (
                <Button 
                  key={i}
                  variant="outline" 
                  className="h-auto w-full justify-start py-2.5 px-3 text-left hover:bg-muted"
                  onClick={() => setInput(topic.query)}
                >
                  <span className="mr-2 text-lg">{topic.icon}</span>
                  <span className="font-medium">{topic.title}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
        
        <Separator className="my-5" />
        
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="mb-2 font-medium text-sm">Pro Tips</p>
          <ul className="space-y-1.5 text-xs text-muted-foreground pl-5">
            <li>Ask specific questions for better results</li>
            <li>Request sources for evidence-based answers</li>
            <li>Click on topics to quickly start researching</li>
          </ul>
        </div>
      </>
    );
  };

  // Add a tab for learning insights in the side panel when using deep research
  const renderSidePanelTabs = () => {
    return (
      <Tabs defaultValue="research" value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="research">
            Summary
          </TabsTrigger>
          {isDeepResearch && learnings.length > 0 && (
            <TabsTrigger value="learnings">
              Insights {learnings.length > 0 && <Badge variant="secondary" className="ml-1.5">{learnings.length}</Badge>}
            </TabsTrigger>
          )}
          <TabsTrigger value="sources">
            Sources {sources.length > 0 && <Badge variant="secondary" className="ml-1.5">{sources.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="research" className="flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(80vh-120px)]">
            <div className="p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown components={markdownComponents}>
                  {getResearchContent()}
                </ReactMarkdown>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {isDeepResearch && (
          <TabsContent value="learnings" className="flex-1 overflow-hidden">
            <ScrollArea className="h-[calc(80vh-120px)]">
              <div className="p-4 space-y-3">
                <h3 className="text-sm font-medium">Key Insights Discovered</h3>
                {learnings.length > 0 ? (
                  <div className="space-y-3">
                    {learnings.map((learning, i) => (
                      <Card key={i}>
                        <CardContent className="p-3 text-sm">
                          {learning}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg bg-muted/30 py-4 px-3">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    <span className="text-sm">Discovering insights...</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        )}

        <TabsContent value="sources" className="flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(80vh-120px)]">
            <div className="space-y-4 p-4">
              {sources.length === 0 && isLoading && (
                <div className="flex items-center gap-3 rounded-lg bg-muted/30 py-4 px-3">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                  <span className="text-sm">Searching web sources...</span>
                </div>
              )}

              {sources.map((source, i) => (
                <SourceCard key={i} source={source} index={i} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    );
  }

  // Add a helper function to render deep research progress
  const renderDeepResearchProgress = (message: Message) => {
    if (!message.metadata) return null;
    
    // Extract depth and breadth details from metadata
    const details = message.metadata as any;
    const hasDepthDetails = details?.depth?.current !== undefined && details?.depth?.total !== undefined;
    const hasBreadthDetails = details?.breadth?.current !== undefined && details?.breadth?.total !== undefined;
    const hasQueryDetails = details?.queries?.current !== undefined && details?.queries?.total !== undefined;
    
    if (!hasDepthDetails && !hasBreadthDetails) {
      return (
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">{message.metadata.status || 'Researching...'}</span>
          <Progress value={message.metadata.progress} className="h-1.5" />
        </div>
      );
    }
    
    return (
      <div className="space-y-3">
        <span className="text-sm font-medium">{message.metadata.status || 'Deep Research in Progress...'}</span>
        
        {/* Overall Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span>Overall Progress</span>
            <span className="font-medium">{Math.round(message.metadata.progress || 0)}%</span>
          </div>
          <Progress value={message.metadata.progress} className="h-1.5" />
        </div>
        
        {/* Depth Progress */}
        {hasDepthDetails && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span>Depth</span>
              <span className="font-medium">{details.depth.current}/{details.depth.total}</span>
            </div>
            <Progress value={(details.depth.current / details.depth.total) * 100} className="h-1.5" />
          </div>
        )}
        
        {/* Breadth Progress */}
        {hasBreadthDetails && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span>Breadth</span>
              <span className="font-medium">{details.breadth.current}/{details.breadth.total}</span>
            </div>
            <Progress value={(details.breadth.current / details.breadth.total) * 100} className="h-1.5" />
          </div>
        )}
        
        {/* Query Progress */}
        {hasQueryDetails && details.queries.currentQuery && (
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span>Queries</span>
              <span className="font-medium">{details.queries.current}/{details.queries.total}</span>
            </div>
            <div className="mt-1 rounded bg-muted/50 p-2 text-xs text-muted-foreground">
              <span className="font-medium">Current query:</span> {details.queries.currentQuery}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="fixed left-3 top-3 z-30 md:hidden"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[300px] p-0">
          <div className="flex h-full flex-col p-4">
            <div className="mb-4 flex items-center">
              <h3 className="text-lg font-bold">Deep Research</h3>
              <Badge variant="outline" className="ml-2">AI-Powered</Badge>
            </div>
            <Separator className="mb-4" />
            {renderSidebarContent()}
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden h-full w-[280px] shrink-0 flex-col border-r bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:flex">
        {renderSidebarContent()}
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 max-w-screen-2xl items-center">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">Deep Research</h1>
              <Badge variant="secondary" className="ml-1">AI-Powered</Badge>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {/* Moved Deep Research controls to input area */}
              
              {/* Add deep research settings when enabled */}
              {isDeepResearch && (
                <div className="hidden md:flex gap-2 items-center">
                  <Select 
                    value={deepResearchSettings.depth.toString()} 
                    onValueChange={(value) => setDeepResearchSettings(prev => ({...prev, depth: parseInt(value)}))}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="w-[120px] h-8">
                      <SelectValue placeholder="Depth" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Depth: 1</SelectItem>
                      <SelectItem value="2">Depth: 2</SelectItem>
                      <SelectItem value="3">Depth: 3</SelectItem>
                      <SelectItem value="4">Depth: 4</SelectItem>
                      <SelectItem value="5">Depth: 5</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select 
                    value={deepResearchSettings.breadth.toString()} 
                    onValueChange={(value) => setDeepResearchSettings(prev => ({...prev, breadth: parseInt(value)}))}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="w-[120px] h-8">
                      <SelectValue placeholder="Breadth" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">Breadth: 2</SelectItem>
                      <SelectItem value="3">Breadth: 3</SelectItem>
                      <SelectItem value="4">Breadth: 4</SelectItem>
                      <SelectItem value="5">Breadth: 5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <ThemeToggle />
              
              {messages.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setMessages([]);
                    setSources([]);
                    setLearnings([]);
                    setInput('');
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-1"
                  >
                    <path d="M3 3v18h18" />
                    <path d="M3 12h9" />
                    <path d="M3 6h6" />
                    <path d="M3 9h3" />
                  </svg>
                  New Research
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Messages area */}
        <ScrollArea className="flex-1">
          <div className="container mx-auto max-w-4xl px-4 py-8">
            {/* Welcome message */}
            {messages.length === 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-8 py-8"
              >
                <div className="text-center">
                  <h2 className="mb-4 text-3xl font-bold">Welcome to Deep Research</h2>
                  <p className="mx-auto mb-6 max-w-lg text-muted-foreground">
                    Ask any research question to get comprehensive, AI-powered analysis with credible sources.
                  </p>
                </div>
                
                <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
                  {EXAMPLE_TOPICS.map((topic, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.1 }}
                    >
                      <Card className="transition-all hover:shadow-md hover:bg-muted/50">
                        <CardHeader className="pb-2">
                          <div className="flex items-center">
                            <span className="mr-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary">
                              {topic.icon}
                            </span>
                            <CardTitle className="text-lg">{topic.title}</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="pb-2">
                          <CardDescription className="line-clamp-2">
                            {topic.description}
                          </CardDescription>
                        </CardContent>
                        <CardFooter className="pt-0">
                          <Button 
                            variant="ghost" 
                            className="w-full justify-center"
                            onClick={() => setInput(topic.query)}
                          >
                            Research This Topic
                          </Button>
                        </CardFooter>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Messages */}
            <div className="space-y-6">
              <AnimatePresence>
                {messages.map((message, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`group/message ${
                      message.type === 'user' ? 'flex justify-end' : ''
                    }`}
                  >
                    <div className={`flex gap-3 ${
                      message.type === 'user' 
                        ? 'ml-12 max-w-[80%]' 
                        : message.type === 'system'
                        ? 'max-w-[90%]'
                        : 'mr-12 max-w-[90%]'
                    }`}>
                      {message.type !== 'user' && (
                        <Avatar className="mt-1 h-9 w-9 shrink-0 select-none">
                          <AvatarFallback className={message.type === 'assistant' ? 
                            "bg-primary/10 text-primary" : 
                            "bg-muted text-muted-foreground"}>
                            {message.type === 'assistant' ? 'AI' : '⚙️'}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      
                      <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                        <div className={`
                          space-y-2 rounded-lg px-4 py-3
                          ${message.type === 'user' ? 'bg-primary text-primary-foreground' : 
                            message.type === 'assistant' ? 'bg-muted shadow-sm' : 'bg-transparent w-full'}
                        `}>
                          {message.type !== 'system' && (
                            <div>
                              {message.timestamp && (
                                <div className="mb-1 text-xs opacity-70">
                                  {formatTime(message.timestamp)}
                                </div>
                              )}
                              <ReactMarkdown 
                                components={markdownComponents}
                                className={`prose ${message.type === 'user' ? 'prose-invert' : ''} max-w-none`}
                              >
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          )}
                          
                          {message.type === 'system' && (
                            <div className="w-full rounded-md bg-muted/80 p-4 text-sm shadow-sm">
                              {message.metadata ? (
                                isDeepResearch ? 
                                renderDeepResearchProgress(message) : 
                                <div className="space-y-2">
                                  <span className="text-sm text-muted-foreground">{message.metadata.status || 'Researching...'}</span>
                                  <Progress value={message.metadata.progress} className="h-1.5" />
                                </div>
                              ) : (
                                message.content
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {message.type === 'user' && (
                        <Avatar className="mt-1 h-9 w-9 shrink-0 select-none">
                          <AvatarFallback className="bg-primary text-primary-foreground">U</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          </div>
        </ScrollArea>

        {/* Sources panel - Desktop */}
        <AnimatePresence>
          {(sources.length > 0 || (isDeepResearch && learnings.length > 0)) && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="fixed right-4 top-20 hidden w-80 overflow-hidden rounded-lg border bg-background shadow-lg md:block"
            >
              {renderSidePanelTabs()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sources panel - Mobile (bottom sheet) */}
        {(sources.length > 0 || (isDeepResearch && learnings.length > 0)) && (
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="fixed bottom-20 right-4 z-10 flex items-center gap-1 shadow-md md:hidden"
              >
                <span>{activeTab === 'sources' ? 'Sources' : activeTab === 'learnings' ? 'Insights' : 'Research'}</span>
                {activeTab === 'sources' && sources.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {sources.length}
                  </Badge>
                )}
                {activeTab === 'learnings' && learnings.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {learnings.length}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] px-0 pt-6 md:hidden">
              {renderSidePanelTabs()}
            </SheetContent>
          </Sheet>
        )}

        {/* Input area */}
        <div className="sticky bottom-0 border-t bg-background p-4">
          {/* Input container with enhanced styling */}
          <form 
            onSubmit={handleSubmit}
            className="relative mx-auto max-w-3xl"
          >
            <div className="flex items-end gap-2">
              {/* Deep Research toggle moved to input area */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => setIsDeepResearch(!isDeepResearch)}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={isDeepResearch ? "text-primary" : "text-muted-foreground"}
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 2a4.5 4.5 0 0 0 0 9 4.5 4.5 0 0 1 0 9 4.5 4.5 0 0 0 0-9 4.5 4.5 0 0 1 0-9Z" />
                        <path d="M12 16v.01" />
                      </svg>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">{isDeepResearch ? 'Disable' : 'Enable'} Deep Research</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <div className="relative flex-1">
                <Textarea 
                  placeholder={isDeepResearch 
                    ? "Ask a complex research question for deep multi-query research..." 
                    : "Ask a research question..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={1}
                  className="min-h-[3.25rem] resize-none pr-16 py-3.5 pl-4 rounded-md shadow-sm border-muted"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">              
                  <Button 
                    type="submit" 
                    disabled={isLoading || !input.trim()}
                    className="h-9"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-1.5">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                        <span>Working</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span>Send</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
                        </svg>
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </form>
          <div className="mt-2 flex items-center justify-center gap-1.5">
            {isDeepResearch ? (
              <div className="flex items-center space-x-1.5 text-xs text-muted-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a4.5 4.5 0 0 0 0 9 4.5 4.5 0 0 1 0 9 4.5 4.5 0 0 0 0-9 4.5 4.5 0 0 1 0-9Z" />
                  <path d="M12 16v.01" />
                </svg>
                <span>
                  Deep Research Mode {deepResearchSettings.depth > 2 || deepResearchSettings.breadth > 3 ? '(Higher settings may take longer)' : ''}
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 text-xs text-muted-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>Powered by advanced AI research tools and web search</span>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Deep Research settings button */}
        {isDeepResearch && (
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="fixed bottom-20 right-24 z-10 shadow-md md:hidden h-9 w-9"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="18" 
                  height="18" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="pt-6 md:hidden">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Deep Research Settings</h3>
                  <Badge variant="outline">Beta</Badge>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Configure settings for more comprehensive research results
                </p>
                
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="mobile-depth" className="font-medium">Research Depth</Label>
                      <Badge variant="secondary">{deepResearchSettings.depth}/5</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Higher values produce more thorough research but take longer.</p>
                    <Select 
                      value={deepResearchSettings.depth.toString()} 
                      onValueChange={(value) => setDeepResearchSettings(prev => ({...prev, depth: parseInt(value)}))}
                    >
                      <SelectTrigger id="mobile-depth">
                        <SelectValue placeholder="Depth" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Depth: 1 (Quick)</SelectItem>
                        <SelectItem value="2">Depth: 2 (Standard)</SelectItem>
                        <SelectItem value="3">Depth: 3 (Thorough)</SelectItem>
                        <SelectItem value="4">Depth: 4 (Comprehensive)</SelectItem>
                        <SelectItem value="5">Depth: 5 (Maximum)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="mobile-breadth" className="font-medium">Research Breadth</Label>
                      <Badge variant="secondary">{deepResearchSettings.breadth}/5</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Higher values explore more diverse sources and perspectives.</p>
                    <Select 
                      value={deepResearchSettings.breadth.toString()} 
                      onValueChange={(value) => setDeepResearchSettings(prev => ({...prev, breadth: parseInt(value)}))}
                    >
                      <SelectTrigger id="mobile-breadth">
                        <SelectValue placeholder="Breadth" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">Breadth: 2 (Focused)</SelectItem>
                        <SelectItem value="3">Breadth: 3 (Balanced)</SelectItem>
                        <SelectItem value="4">Breadth: 4 (Diverse)</SelectItem>
                        <SelectItem value="5">Breadth: 5 (Maximum)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    variant="default" 
                    className="w-full mt-2"
                    onClick={() => {
                      const sheet = document.querySelector('[data-state="open"]');
                      if (sheet) {
                        const closeButton = sheet.querySelector('button[aria-label="Close"]');
                        if (closeButton) {
                          (closeButton as HTMLButtonElement).click();
                        }
                      }
                    }}
                  >
                    Apply Settings
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
}

// SourceCard component for rendering source items with enhanced styling
function SourceCard({ source, index }: { source: Source, index: number }) {
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
                      {Math.round(source.relevance * 100)}%
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