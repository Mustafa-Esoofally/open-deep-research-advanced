'use client';

import { Research } from '@/app/components/research';
import { useEffect, useState, useRef } from 'react';
import { Search, ArrowRight, Globe, LightbulbIcon, Check, Paperclip, ChevronDown } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Switch } from '@/app/components/ui/switch';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { MODEL_CONFIGS } from '@/app/lib/models/providers/model-registry';

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
      
      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full px-4">
        {/* Heading */}
        <h1 className="text-2xl font-medium mb-16 text-center">An open source research assistant for your every day curiosity</h1>
        
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
            />
            
            <div className="absolute right-3 bottom-1/2 transform translate-y-1/2">
              <Button 
                size="icon" 
                variant="ghost"
                className="rounded-full h-9 w-9 bg-muted hover:bg-muted/80"
                onClick={handleSearch}
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
                              <div className="flex-1">
                                <div className="flex items-center">
                                  <div className="font-medium">{mode.name}</div>
                                  {selectedMode.id === mode.id && (
                                    <Check className="ml-2 h-4 w-4 text-blue-400" />
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">{mode.description}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                        
                        <div className="px-3 py-2 border-t border-border text-sm text-muted-foreground">
                          5 enhanced queries remaining today
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                <Button variant="ghost" size="icon" className="ml-2 text-muted-foreground hover:text-foreground">
                  <Paperclip className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Right side: Deep Research toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Deep Research</span>
                <Switch 
                  checked={isDeepResearchEnabled}
                  onCheckedChange={setIsDeepResearchEnabled}
                  className="data-[state=checked]:bg-teal-600"
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