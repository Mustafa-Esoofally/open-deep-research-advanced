'use client';

import * as React from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Components } from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { Slider } from '@/app/components/ui/slider';

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
import { ModelSelector } from '@/app/components/ui/model-selector';
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { useModelSelection } from '@/app/hooks/useModelSelection';
import { MODEL_CONFIGS } from '@/app/lib/models/providers/model-registry';

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

// Get a display name for model identifiers
const getModelDisplayName = (modelKey: string): string => {
  if (!modelKey) return 'Unknown';
  
  // Try to get the name from model configs
  if (MODEL_CONFIGS[modelKey]?.name) {
    // Get the first word or first 6 chars if it's too long
    const name = MODEL_CONFIGS[modelKey].name;
    const firstWord = name.split(' ')[0];
    return firstWord.length > 6 ? firstWord.substring(0, 6) : firstWord;
  }
  
  // Fallback to the key itself
  const parts = modelKey.split('-');
  // Use the first part or first 6 chars of the key
  return parts[0].length > 6 ? parts[0].substring(0, 6) : parts[0];
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
    depth: 2,
    breadth: 3
  });
  const [learnings, setLearnings] = useState<string[]>([]);

  // Use the model selection hook
  const { selectedModel, updateModel, isLoading: isModelLoading } = useModelSelection();

  // Enable deep research mode with predefined settings
  const enableDeepResearch = useCallback(() => {
    setIsDeepResearch(true);
    setDeepResearchSettings({
      depth: 2,
      breadth: 3
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
          },
          modelKey: selectedModel
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
    if (activeTab === 'settings') {
      return (
        <div className="p-4 space-y-6">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Research Mode</h3>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="deep-research">Deep Research</Label>
                <div className="text-sm text-muted-foreground">
                  More thorough research with iterative queries
                </div>
              </div>
              <Switch
                id="deep-research"
                checked={isDeepResearch}
                onCheckedChange={setIsDeepResearch}
              />
            </div>
          </div>

          {isDeepResearch && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="research-depth">Search Depth</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">1</span>
                  <Slider
                    id="research-depth"
                    min={1}
                    max={5}
                    step={1}
                    value={[deepResearchSettings.depth]}
                    onValueChange={(value) => setDeepResearchSettings(prev => ({ ...prev, depth: value[0] }))}
                    className="flex-1"
                  />
                  <span className="text-sm">5</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  How many levels of follow-up queries to explore
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="research-breadth">Search Breadth</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">1</span>
                  <Slider
                    id="research-breadth"
                    min={1}
                    max={5}
                    step={1}
                    value={[deepResearchSettings.breadth]}
                    onValueChange={(value) => setDeepResearchSettings(prev => ({ ...prev, breadth: value[0] }))}
                    className="flex-1"
                  />
                  <span className="text-sm">5</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  How many parallel queries to explore at each level
                </div>
              </div>
            </div>
          )}
          
          <Separator />
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Model Settings</h3>
            <ModelSelector 
              value={selectedModel}
              onValueChange={updateModel}
              showDescription={true}
              disabled={isLoading || isModelLoading}
            />
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Display</h3>
            <div className="flex items-center justify-between">
              <Label htmlFor="theme-toggle">Dark Mode</Label>
              <ThemeToggle />
            </div>
          </div>
        </div>
      );
    } else if (activeTab === 'sources') {
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
    } else {
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
    }
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
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Model loading overlay */}
      {isModelLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <h3 className="text-xl font-medium">Loading Models</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Preparing available AI models for your research experience...
            </p>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-grow overflow-hidden">
        {/* Header - Simplified */}
        <header className="border-b bg-background/95 backdrop-blur py-4 px-4">
          <div className="container max-w-screen-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">Deep Research</h1>
              <Badge variant="secondary" className="ml-1">AI-Powered</Badge>
            </div>
            
            <div className="flex items-center gap-2">
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
                  New
                </Button>
              )}
              
              {/* Mobile menu */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                    <span className="sr-only">Menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] p-0">
                  <div className="flex h-full flex-col p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-bold">Settings</h3>
                      <Badge variant="outline">AI-Powered</Badge>
                    </div>
                    <Separator className="mb-4" />
                    {renderSidebarContent()}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        {/* Messages area with fixed width container */}
        <div className="flex-grow overflow-auto">
          <div className="container mx-auto max-w-3xl px-4 py-12">
            {/* Welcome message / empty state */}
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center mt-8 mb-16">
                <h2 className="text-4xl font-bold text-center mb-4">What do you want to know?</h2>
                <p className="text-muted-foreground text-center max-w-lg mb-12">
                  Ask any research question to get comprehensive, AI-powered analysis with credible sources.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
                  {EXAMPLE_TOPICS.map((topic, i) => (
                    <Button 
                      key={i}
                      variant="outline" 
                      className="h-auto p-4 justify-start text-left hover:bg-muted/50"
                      onClick={() => setInput(topic.query)}
                    >
                      <span className="mr-3 text-2xl">{topic.icon}</span>
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-base">{topic.title}</span>
                        <span className="text-xs text-muted-foreground mt-1">{topic.description}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
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
            )}
          </div>
        </div>

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
                className="fixed bottom-24 right-4 z-10 flex items-center gap-1 shadow-md md:hidden"
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
            <SheetContent side="bottom" className="h-[70vh] px-0 pt-6">
              {renderSidePanelTabs()}
            </SheetContent>
          </Sheet>
        )}

        {/* Input area - Fixed at bottom */}
        <div className="border-t bg-background/80 backdrop-blur-md py-6 px-4 sticky bottom-0 z-20">
          <div className="container mx-auto max-w-3xl">
            {messages.length === 0 && (
              <h2 className="text-2xl font-medium text-center mb-4">
                What do you want to know?
              </h2>
            )}
            
            <form onSubmit={handleSubmit} className="relative">
              <div className="flex items-center gap-2 bg-background rounded-xl border shadow-sm p-1">
                {/* Research mode selector */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-10 rounded-lg text-muted-foreground hover:text-foreground px-3 flex items-center gap-2"
                    >
                      {isDeepResearch ? (
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
                          className="text-primary"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 2a4.5 4.5 0 0 0 0 9 4.5 4.5 0 0 1 0 9 4.5 4.5 0 0 0 0-9 4.5 4.5 0 0 1 0-9Z" />
                          <path d="M12 16v.01" />
                        </svg>
                      ) : (
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
                          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                        </svg>
                      )}
                      <span className="hidden sm:inline text-sm">
                        {isDeepResearch ? "Deep Research" : "Auto"}
                      </span>
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
                        className="text-muted-foreground"
                      >
                        <path d="m6 9 6 6 6-6"/>
                      </svg>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[260px] p-0" align="start">
                    <div className="p-3 space-y-3">
                      <h3 className="text-sm font-medium border-b pb-2">Select Mode</h3>
                      
                      <div className="grid gap-2">
                        <Button 
                          variant="ghost" 
                          className={`w-full justify-start p-2.5 ${!isDeepResearch ? 'ring-1 ring-primary bg-muted/30' : ''}`}
                          onClick={() => setIsDeepResearch(false)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
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
                                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                              </svg>
                            </div>
                            <div className="flex flex-col items-start">
                              <span className="font-medium text-sm">Auto</span>
                              <span className="text-xs text-muted-foreground">Quick answers using the web</span>
                            </div>
                            {!isDeepResearch && (
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
                                className="ml-auto text-primary"
                              >
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            )}
                          </div>
                        </Button>
                        
                        <Button 
                          variant="ghost" 
                          className={`w-full justify-start p-2.5 ${isDeepResearch ? 'ring-1 ring-primary bg-muted/30' : ''}`}
                          onClick={() => setIsDeepResearch(true)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
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
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 2a4.5 4.5 0 0 0 0 9 4.5 4.5 0 0 1 0 9 4.5 4.5 0 0 0 0-9 4.5 4.5 0 0 1 0-9Z" />
                                <path d="M12 16v.01" />
                              </svg>
                            </div>
                            <div className="flex flex-col items-start">
                              <span className="font-medium text-sm">Deep Research</span>
                              <span className="text-xs text-muted-foreground">In-depth reports on complex topics</span>
                            </div>
                            {isDeepResearch && (
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
                                className="ml-auto text-primary"
                              >
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            )}
                          </div>
                        </Button>
                      </div>
                      
                      {isDeepResearch && (
                        <div className="mt-3 pt-3 border-t space-y-3">
                          <h4 className="text-xs font-medium">Deep Research Settings</h4>
                          
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label htmlFor="depth-control" className="text-xs">Research Depth</Label>
                                <Badge variant="outline" className="h-5 text-xs">{deepResearchSettings.depth}</Badge>
                              </div>
                              <Slider
                                id="depth-control"
                                min={1}
                                max={5}
                                step={1}
                                value={[deepResearchSettings.depth]}
                                onValueChange={(value) => setDeepResearchSettings(prev => ({ ...prev, depth: value[0] }))}
                              />
                            </div>
                            
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label htmlFor="breadth-control" className="text-xs">Research Breadth</Label>
                                <Badge variant="outline" className="h-5 text-xs">{deepResearchSettings.breadth}</Badge>
                              </div>
                              <Slider
                                id="breadth-control"
                                min={1}
                                max={5}
                                step={1}
                                value={[deepResearchSettings.breadth]}
                                onValueChange={(value) => setDeepResearchSettings(prev => ({ ...prev, breadth: value[0] }))}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Text input area */}
                <div className="flex-1">
                  <Textarea 
                    placeholder="Ask anything..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    rows={1}
                    className="min-h-[40px] max-h-[200px] resize-none py-2.5 px-1 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 pr-1">
                  {/* Model Selector */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground relative"
                        disabled={isModelLoading}
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
                          className={`${isModelLoading ? "animate-pulse" : ""}`}
                        >
                          <circle cx="12" cy="12" r="3" />
                          <path d="m19 12-7-7-7 7 7 7 7-7Z" />
                        </svg>
                        {isModelLoading && (
                          <span className="absolute -top-1 -right-1 h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[270px] p-0" align="end">
                      <div className="p-3 space-y-3">
                        <h3 className="text-sm font-medium border-b pb-2">Select AI Model</h3>
                        
                        <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
                          {Object.entries(MODEL_CONFIGS).map(([key, model]) => (
                            <Button 
                              key={key}
                              variant="ghost" 
                              className={`w-full justify-start p-2.5 ${selectedModel === key ? 'ring-1 ring-primary bg-muted/30' : ''}`}
                              onClick={() => {
                                updateModel(key);
                                toast.success(`Model changed to ${model.name}`);
                              }}
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                  <span className="text-xs font-semibold">
                                    {model.provider ? model.provider[0] : 'AI'}
                                  </span>
                                </div>
                                <div className="flex flex-col items-start">
                                  <span className="font-medium text-sm">{model.name}</span>
                                  <span className="text-xs text-muted-foreground">{model.provider || 'AI model'}</span>
                                </div>
                                {selectedModel === key && (
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
                                    className="ml-auto text-primary"
                                  >
                                    <path d="M20 6 9 17l-5-5" />
                                  </svg>
                                )}
                              </div>
                            </Button>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Send button */}
                  <Button 
                    type="submit" 
                    disabled={isLoading || !input.trim()}
                    className="h-9 rounded-full"
                    size="icon"
                  >
                    {isLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                    ) : (
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
                        <path d="m5 12 14-9-9 18v-9z" />
                      </svg>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
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