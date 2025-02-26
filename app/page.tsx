'use client';

import { Research } from '@/app/components/research';
import { useEffect, useState, useRef } from 'react';
import { Search, ArrowRight, Globe, LightbulbIcon, Check, Paperclip, ChevronDown, AlertTriangle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Switch } from '@/app/components/ui/switch';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { MODEL_CONFIGS } from '@/app/lib/models/providers/model-registry';
import { useEnvCheck } from '@/app/hooks/useEnvCheck';

// Define research mode type for better type safety
export type ResearchMode = {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  modelKey?: string; // Optional field to map to actual model key
};

// Mock trending search data - in a real app this would come from an API
const fetchTrendingSearches = async () => {
  // Simulating API call delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  return [
    // Technology
    {
      id: 'tech1',
      title: 'AGI progress timeline',
      subtitle: 'Latest developments in artificial general intelligence',
      category: 'Technology',
      color: 'from-blue-500 to-indigo-600'
    },
    {
      id: 'tech2',
      title: 'Quantum computing applications',
      subtitle: 'Real-world use cases today',
      category: 'Technology',
      color: 'from-indigo-500 to-purple-600'
    },
  ];
};

export default function Home() {
  // Add client-side only rendering to prevent hydration issues
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showModes, setShowModes] = useState(false);
  const [trendingSearches, setTrendingSearches] = useState<any[]>([]);
  const [isLoadingTrending, setIsLoadingTrending] = useState(false);
  const [isDeepResearchEnabled, setIsDeepResearchEnabled] = useState(false);
  
  // Use our environment check hook
  const envStatus = useEnvCheck();
  
  // Research modes definition with model keys - now based on MODEL_CONFIGS
  const researchModes: ResearchMode[] = Object.entries(MODEL_CONFIGS).map(([key, config]) => ({
    id: key,
    name: config.name,
    icon: getModelIcon(config.provider),
    description: config.description,
    modelKey: key
  }));
  
  // Get icon based on provider
  function getModelIcon(provider: string) {
    switch (provider.toLowerCase()) {
      case 'anthropic':
        return <LightbulbIcon className="h-4 w-4 text-purple-400" />;
      case 'deepseek':
        return <LightbulbIcon className="h-4 w-4 text-blue-400" />;
      case 'google':
        return <Globe className="h-4 w-4 text-green-400" />;
      case 'perplexity':
        return <Search className="h-4 w-4 text-orange-400" />;
      case 'groq':
        return <Search className="h-4 w-4 text-teal-400" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  }
  
  // State for selected mode with proper typing
  const [selectedMode, setSelectedMode] = useState<ResearchMode>(
    researchModes.find(mode => mode.id === 'claude-3.7-sonnet') || researchModes[0]
  );
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Load trending searches
  const loadTrendingSearches = async () => {
    setIsLoadingTrending(true);
    try {
      const data = await fetchTrendingSearches();
      setTrendingSearches(data);
    } catch (error) {
      console.error('Failed to fetch trending searches:', error);
    } finally {
      setIsLoadingTrending(false);
    }
  };
  
  useEffect(() => {
    setMounted(true);
    
    // Load trending searches when component mounts
    loadTrendingSearches();
    
    // Add click outside listener for dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowModes(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleSearch = () => {
    if (input.trim()) {
      setShowChat(true);
    }
  };
  
  const handleExampleClick = (title: string) => {
    setInput(title);
    setTimeout(() => {
      setShowChat(true);
    }, 100);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };
  
  const handleModeSelect = (mode: ResearchMode) => {
    setSelectedMode(mode);
    setShowModes(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };
  
  if (!mounted) return null;
  
  // Show environment error message if any issues are detected in production
  // In development, we'll show a warning banner instead
  if (!envStatus.loading && !envStatus.valid && !envStatus.isDevelopment) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full p-6 bg-card rounded-lg border border-destructive shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <h2 className="text-xl font-medium">Environment Configuration Error</h2>
          </div>
          <p className="mb-4 text-muted-foreground">
            The application is missing required environment variables:
          </p>
          <ul className="list-disc list-inside mb-4 text-sm">
            {envStatus.missingVariables.map(variable => (
              <li key={variable} className="text-destructive">{variable}</li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground mb-4">
            These variables need to be configured on the deployment platform (Vercel).
          </p>
          <div className="pt-2 border-t border-border">
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Show the Research component when chat is active
  if (showChat) {
    return (
      <main className="h-screen w-full">
        <Research 
          initialQuery={input} 
          researchMode={isDeepResearchEnabled ? 'deep-research' : selectedMode.id}
          modelKey={selectedMode.modelKey} 
        />
      </main>
    );
  }
  
  // Otherwise show the landing page
  return (
    <main className="h-screen w-full bg-background text-foreground flex flex-col">
      {/* Header - keeping minimal for focus on search */}
      {/* <header className="h-14 border-b border-border py-2 px-4 flex items-center justify-end">
        <Button variant="ghost" size="sm" className="rounded-full h-9 px-4 bg-secondary hover:bg-secondary/80">
          hello
        </Button>
      </header> */}
      
      {/* Development mode warning banner */}
      {(!envStatus.valid && envStatus.isDevelopment && envStatus.helpMessage) && (
        <div className="w-full bg-amber-500 text-black px-4 py-2">
          <div className="container mx-auto flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <p className="text-sm font-medium">
              Development Mode: Missing environment variables. Some features might not work.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-auto bg-white text-black border-black hover:bg-black hover:text-white"
              onClick={() => window.open('https://github.com/Mustafa-Esoofally/plex-search#environment-variables', '_blank')}
            >
              Setup Guide
            </Button>
          </div>
        </div>
      )}
      
      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full px-4">
        {/* Heading */}
        <h1 className="text-2xl font-medium mb-16 text-center">An open source research assistant for your every day curiosity</h1>
        
        {/* Environment check indicator - only show when loading */}
        {envStatus.loading && (
          <div className="mb-4 px-4 py-2 bg-muted rounded-md text-sm text-muted-foreground flex items-center gap-2">
            <div className="h-2 w-2 bg-orange-400 rounded-full animate-pulse"></div>
            Checking environment configuration...
          </div>
        )}
        
        {/* Development mode message */}
        {(!envStatus.valid && envStatus.isDevelopment && envStatus.helpMessage) && (
          <div className="mb-4 px-4 py-2 bg-amber-100 border border-amber-300 rounded-md text-sm text-amber-800">
            <p className="font-medium mb-1">Development Mode</p>
            <p>{envStatus.helpMessage}</p>
            <p className="mt-2 text-xs">Missing: {envStatus.missingVariables.join(', ')}</p>
          </div>
        )}
        
        {/* Search input container */}
        <div className="w-full max-w-3xl">
          {/* Input field */}
          <div className="relative mb-2">
            <Input
              ref={inputRef}
              placeholder="Ask anything..."
              className="h-[58px] bg-card/50 border border-border rounded-lg px-4 py-6 pr-12 text-base"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!envStatus.valid && !envStatus.loading && !envStatus.isDevelopment}
            />
            
            <div className="absolute right-3 bottom-1/2 transform translate-y-1/2">
              <Button 
                size="icon" 
                variant="ghost"
                className="rounded-full h-9 w-9 bg-muted hover:bg-muted/80"
                onClick={handleSearch}
                disabled={!envStatus.valid && !envStatus.loading && !envStatus.isDevelopment}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Research mode selector with deep research toggle */}
          <div className="flex flex-col">
            <div className="flex items-center mb-4 justify-between">
              {/* Left side: Model selector dropdown button */}
              <div className="flex items-center">
                <div className="relative inline-block" ref={dropdownRef}>
                  <button
                    onClick={() => setShowModes(!showModes)}
                    className="flex items-center gap-2 px-3 py-2 bg-transparent border border-transparent hover:bg-secondary/60 rounded-md"
                    disabled={!envStatus.valid && !envStatus.loading && !envStatus.isDevelopment}
                  >
                    {/* Selected model icon */}
                    <span className="flex items-center justify-center w-5 h-5">
                      {selectedMode.icon}
                    </span>
                    
                    {/* Model name */}
                    <span className="text-sm">{selectedMode.name}</span>
                    
                    {/* Dropdown indicator */}
                    <ChevronDown className="h-4 w-4 ml-1 text-muted-foreground" />
                  </button>
                  
                  {/* Dropdown menu */}
                  <AnimatePresence>
                    {showModes && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 top-full mt-1 w-80 bg-popover border border-border rounded-lg shadow-xl z-10 overflow-hidden"
                      >
                        <div className="p-1 max-h-[400px] overflow-y-auto">
                          {researchModes.map((mode) => (
                            <button
                              key={mode.id}
                              className={`w-full text-left px-3 py-2 hover:bg-muted rounded flex items-center gap-3 ${
                                selectedMode.id === mode.id ? 'bg-secondary' : ''
                              }`}
                              onClick={() => handleModeSelect(mode)}
                            >
                              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                                {mode.icon}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{mode.name}</div>
                                <div className="text-xs text-muted-foreground line-clamp-2">{mode.description}</div>
                              </div>
                              
                              {selectedMode.id === mode.id && (
                                <Check className="h-4 w-4 text-primary" />
                              )}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              
              {/* Right side: Deep research toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm">Deep research</span>
                <Switch 
                  checked={isDeepResearchEnabled} 
                  onCheckedChange={setIsDeepResearchEnabled}
                  disabled={!envStatus.valid && !envStatus.loading && !envStatus.isDevelopment}
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Trending searches */}
        {trendingSearches.length > 0 && (
          <div className="w-full max-w-3xl mt-10">
            {/* Search suggestions */}
            <div className="mt-8 flex flex-wrap gap-2">
              <h3 className="w-full text-sm text-muted-foreground mb-2">Quick searches</h3>
              {[
                "History of cryptocurrencies",
                "Future of remote work",
                "Climate change solutions",
                "Space exploration timeline"
              ].map((suggestion, index) => (
                <button 
                  key={index}
                  onClick={() => handleExampleClick(suggestion)}
                  className="px-3 py-1.5 bg-secondary/50 hover:bg-secondary text-sm rounded-full transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
} 