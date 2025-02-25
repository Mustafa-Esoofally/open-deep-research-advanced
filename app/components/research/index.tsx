'use client';

import * as React from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Components } from 'react-markdown';
import { motion } from 'framer-motion';

// UI Components
import { Card } from '@/app/components/ui/card';
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
    query: 'What are the latest advancements in quantum computing?'
  },
  {
    title: 'Climate Change',
    description: 'Latest research on climate change mitigation strategies',
    query: 'What are the most effective climate change mitigation strategies according to recent research?'
  },
  {
    title: 'Artificial Intelligence',
    description: 'Current state and future directions of AI research',
    query: 'What are the current limitations of AI and how are researchers addressing them?'
  },
  {
    title: 'Space Exploration',
    description: 'Recent discoveries and future missions in space exploration',
    query: 'What are the most significant recent discoveries in space exploration?'
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
    <div className="relative">
      <div className="absolute right-2 top-2 text-xs text-gray-400">{language}</div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{ margin: 0 }}
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
        <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>
          {children}
        </code>
      );
    },
    h1: ({ children }) => <h1 className="text-2xl font-bold my-4">{children}</h1>,
    h2: ({ children }) => <h2 className="text-xl font-bold my-3">{children}</h2>,
    h3: ({ children }) => <h3 className="text-lg font-bold my-2">{children}</h3>,
    ul: ({ children }) => <ul className="list-disc pl-6 my-2">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-6 my-2">{children}</ol>,
    li: ({ children }) => <li className="my-1">{children}</li>,
    p: ({ children }) => <p className="my-2">{children}</p>,
    a: ({ href, children }) => (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="text-blue-500 hover:underline"
      >
        {children}
      </a>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-muted pl-4 italic my-2">
        {children}
      </blockquote>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full divide-y divide-border">
          {children}
        </table>
      </div>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 whitespace-nowrap text-sm">
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

    try {
      // Add initial system message
      setMessages((prev) => [
        ...prev,
        { 
          type: 'system', 
          content: 'Starting research...',
          timestamp: new Date(),
          metadata: {
            progress: 0,
            status: 'initializing'
          }
        }
      ]);

      // Make API request
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage }),
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
      
      // Clear sources at the start of new research
      setSources([]);

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
                }
              } else if (data.type === 'search_results') {
                // Immediately display search results when they come in
                updated.push({
                  type: 'assistant',
                  content: `## Search Results\n${data.content}`,
                  timestamp: new Date()
                });
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
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Recent Researches</h2>
            <div className="space-y-1">
              {messages.filter(m => m.type === 'user').length > 0 ? 
                messages
                  .filter(m => m.type === 'user')
                  .slice(0, 5)
                  .map((message, i) => (
                    <Button 
                      key={i}
                      variant="ghost" 
                      className="w-full justify-start text-left h-auto py-2 text-sm"
                      onClick={() => setInput(message.content)}
                    >
                      <span className="truncate">{message.content}</span>
                    </Button>
                  ))
                : 
                <div className="px-2 py-3 text-sm text-muted-foreground">
                  Your recent research queries will appear here
                </div>
              }
            </div>
          </div>
          
          <Separator className="my-4" />
          
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Example Topics</h2>
            <div className="space-y-1">
              {EXAMPLE_TOPICS.map((topic, i) => (
                <Button 
                  key={i}
                  variant="ghost" 
                  className="w-full justify-start text-left h-auto py-2 text-sm"
                  onClick={() => setInput(topic.query)}
                >
                  <span className="truncate">{topic.title}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
        
        <Separator className="my-4" />
        
        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-medium">Pro Tips</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Ask specific questions for better results</li>
            <li>Request sources for evidence-based answers</li>
            <li>Click on topics to quickly start researching</li>
          </ul>
        </div>
      </>
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
            className="md:hidden fixed top-3 left-3 z-30"
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
          <div className="flex flex-col h-full p-4">
            <div className="flex items-center mb-4">
              <h3 className="font-bold text-lg">Deep Research</h3>
              <Badge variant="outline" className="ml-2">AI</Badge>
            </div>
            <Separator className="mb-4" />
            {renderSidebarContent()}
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col w-[280px] p-4 border-r shrink-0 h-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {renderSidebarContent()}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 max-w-screen-2xl items-center">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-lg">Deep Research</h1>
              <Badge variant="secondary" className="ml-1">AI-Powered</Badge>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              {messages.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setMessages([]);
                    setSources([]);
                    setInput('');
                  }}
                >
                  New Research
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Messages area */}
        <ScrollArea className="flex-1">
          <div className="container max-w-3xl mx-auto py-6 px-4">
            {/* Welcome message */}
            {messages.length === 0 && (
              <div className="space-y-8 py-8">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">Welcome to Deep Research</h2>
                  <p className="text-muted-foreground mb-2 max-w-lg mx-auto">
                    Ask any research question to get comprehensive, AI-powered analysis with credible sources.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  {EXAMPLE_TOPICS.map((topic, i) => (
                    <Card key={i} className="overflow-hidden transition-all hover:shadow-md">
                      <Button 
                        variant="ghost" 
                        className="p-5 h-auto flex flex-col items-center gap-2 w-full"
                        onClick={() => setInput(topic.query)}
                      >
                        <span className="font-medium">{topic.title}</span>
                        <span className="text-sm text-muted-foreground text-center">
                          {topic.description}
                        </span>
                      </Button>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="space-y-6">
              {messages.map((message, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`group/message ${
                    message.type === 'user' ? 'flex justify-end' : ''
                  }`}
                >
                  <div className={`flex gap-3 ${
                    message.type === 'user' 
                      ? 'max-w-[80%]' 
                      : message.type === 'system'
                      ? 'max-w-[90%]'
                      : 'max-w-[90%]'
                  }`}>
                    {message.type === 'assistant' && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary">AI</AvatarFallback>
                      </Avatar>
                    )}
                    
                    {message.type === 'user' && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground">U</AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div className="flex flex-col gap-1 w-full">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">
                          {message.type === 'user' ? 'You' : message.type === 'assistant' ? 'Research Assistant' : 'System'}
                        </span>
                        {message.timestamp && (
                          <span className="text-xs text-muted-foreground">
                            {formatTime(message.timestamp)}
                          </span>
                        )}
                      </div>
                      
                      {message.type === 'system' && message.metadata && (
                        <div className="mb-1">
                          <div className="flex items-center gap-2">
                            <Progress value={message.metadata.progress} className="h-2" />
                            <span className="text-xs text-muted-foreground">
                              {message.metadata.status}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className={`rounded-lg ${
                        message.type === 'user' 
                          ? 'bg-primary text-primary-foreground px-4 py-2 rounded-tr-none' 
                          : message.type === 'system'
                          ? 'bg-muted p-3'
                          : 'bg-card border shadow-sm p-4'
                      }`}>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown components={markdownComponents}>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </ScrollArea>

        {/* Sources panel - Desktop */}
        {sources.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed right-4 top-20 w-80 bg-background border rounded-lg shadow-lg overflow-hidden md:block hidden"
          >
            <Tabs defaultValue="research" value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
              <TabsList className="w-full">
                <TabsTrigger value="research" className="flex-1">
                  Summary
                </TabsTrigger>
                <TabsTrigger value="sources" className="flex-1">
                  Sources ({sources.length})
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

              <TabsContent value="sources" className="flex-1 overflow-hidden">
                <ScrollArea className="h-[calc(80vh-120px)]">
                  <div className="space-y-4 p-4">
                    {sources.length === 0 && isLoading && (
                      <div className="flex items-center gap-2 py-4 px-2 bg-muted/30 rounded-lg">
                        <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div>
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
          </motion.div>
        )}

        {/* Sources panel - Mobile (bottom sheet) */}
        {sources.length > 0 && (
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="fixed right-4 bottom-24 z-10 shadow-md md:hidden flex items-center gap-1"
              >
                <span>Sources</span>
                <Badge variant="secondary" className="ml-1">{sources.length}</Badge>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] pt-6 px-0 md:hidden">
              <Tabs defaultValue="research" value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
                <TabsList className="w-full px-4 mb-2">
                  <TabsTrigger value="research" className="flex-1">
                    Summary
                  </TabsTrigger>
                  <TabsTrigger value="sources" className="flex-1">
                    Sources ({sources.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="research" className="flex-1 overflow-hidden">
                  <ScrollArea className="h-[calc(80vh-80px)]">
                    <div className="p-4">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown components={markdownComponents}>
                          {getResearchContent()}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="sources" className="flex-1 overflow-hidden">
                  <ScrollArea className="h-[calc(80vh-80px)]">
                    <div className="space-y-4 p-4">
                      {sources.map((source, i) => (
                        <SourceCard key={i} source={source} index={i} />
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </SheetContent>
          </Sheet>
        )}

        {/* Input area */}
        <div className="border-t bg-background p-4 sticky bottom-0">
          <form 
            onSubmit={handleSubmit}
            className="relative max-w-3xl mx-auto"
          >
            <Textarea 
              placeholder="Ask a research question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={1}
              className="min-h-[3rem] resize-none pr-20 py-3"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button 
              type="submit" 
              className="absolute right-2 top-1/2 -translate-y-1/2"
              disabled={isLoading || !input.trim()}
            >
              {isLoading ? (
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full border-2 border-current border-r-transparent animate-spin"></span>
                  <span>Working</span>
                </span>
              ) : (
                "Send"
              )}
            </Button>
          </form>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Powered by advanced AI research tools and web search
          </p>
        </div>
      </div>
    </div>
  );
}

// SourceCard component for rendering source items
function SourceCard({ source, index }: { source: Source, index: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
    >
      <Card className="overflow-hidden transition-all hover:shadow-md">
        <div className="p-3">
          <div className="flex items-start gap-3">
            {source.favicon ? (
              <img 
                src={source.favicon} 
                alt=""
                className="w-4 h-4 mt-1 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-4 h-4 mt-1 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary">
                {source.domain ? source.domain[0].toUpperCase() : 'S'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <a 
                href={source.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm font-medium hover:underline block truncate"
              >
                {source.title}
              </a>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground truncate">
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
        </div>
      </Card>
    </motion.div>
  );
} 