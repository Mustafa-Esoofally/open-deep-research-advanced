'use client';

import { Research } from '@/app/components/research';
import { useEffect, useState, useRef } from 'react';
import { Search, ArrowRight, Globe, LightbulbIcon, Check, Paperclip, ChevronDown } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

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
    {
      id: 'trending1',
      title: 'Xi Reaffirm',
      subtitle: "China's commitment to peace",
      color: 'from-indigo-500 to-purple-500'
    },
    {
      id: 'trending2',
      title: 'Ubisoft Addresses',
      subtitle: 'Shadows Leak',
      color: 'from-red-500 to-orange-500'
    }
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
  
  // Research modes definition with model keys
  const researchModes: ResearchMode[] = [
    {
      id: 'auto',
      name: 'Auto',
      icon: <Globe className="h-4 w-4" />,
      description: 'Best for daily searches',
      modelKey: 'openai/o3-mini' // Default lightweight model
    },
    {
      id: 'pro-search',
      name: 'Pro Search',
      icon: <Search className="h-4 w-4" />,
      description: '3x more sources and detailed answers',
      modelKey: 'openai/o3' // More capable model
    },
    {
      id: 'deep-research',
      name: 'Deep Research',
      icon: <Search className="h-4 w-4 text-teal-400" />,
      description: 'In-depth reports on complex topics',
      modelKey: 'deepseek-distill-70b' // High-quality research model
    },
    {
      id: 'reasoning-r1',
      name: 'Reasoning with R1',
      icon: <LightbulbIcon className="h-4 w-4" />,
      description: 'DeepSeek\'s new model hosted in the US',
      modelKey: 'deepseek-r1' 
    },
    {
      id: 'reasoning-o3-mini',
      name: 'Reasoning with o3-mini',
      icon: <LightbulbIcon className="h-4 w-4" />,
      description: 'OpenAI\'s newest reasoning model',
      modelKey: 'openai/o3-mini'
    }
  ];
  
  // State for selected mode with proper typing
  const [selectedMode, setSelectedMode] = useState<ResearchMode>(
    researchModes.find(mode => mode.id === 'deep-research') || researchModes[0]
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
          researchMode={selectedMode.id}
          modelKey={selectedMode.modelKey} 
        />
      </main>
    );
  }
  
  // Otherwise show the landing page
  return (
    <main className="h-screen w-full bg-background text-foreground flex flex-col">
      {/* Header - keeping minimal for focus on search */}
      <header className="h-14 border-b border-border py-2 px-4 flex items-center justify-end">
        <Button variant="ghost" size="sm" className="rounded-full h-9 px-4 bg-secondary hover:bg-secondary/80">
          hello
        </Button>
      </header>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full px-4">
        {/* Heading */}
        <h1 className="text-4xl font-medium mb-16 text-center">What do you want to know?</h1>
        
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
          
          {/* Research mode selector */}
          <div className="flex flex-col">
            <div className="flex items-center mb-4">
              {/* Model selector dropdown button */}
              <div className="relative inline-block" ref={dropdownRef}>
                <button
                  onClick={() => setShowModes(!showModes)}
                  className="flex items-center gap-2 px-3 py-2 bg-transparent border border-transparent hover:bg-secondary/60 rounded-md"
                >
                  {/* Selected model icon */}
                  <span className="flex items-center justify-center w-5 h-5 text-teal-400">
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
                      <div className="p-1">
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
          </div>
        </div>
        
        {/* Trending searches */}
        {trendingSearches.length > 0 && (
          <div className="w-full max-w-3xl mt-10 grid grid-cols-2 gap-4">
            {trendingSearches.map((item) => (
              <div 
                key={item.id}
                className="bg-card border border-border p-4 rounded-lg overflow-hidden cursor-pointer hover:bg-secondary/30 transition-colors duration-150"
                onClick={() => handleExampleClick(item.title)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                    {/* Dynamic gradient background */}
                    <div className={`w-full h-full bg-gradient-to-r ${item.color}`} />
                  </div>
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{item.subtitle}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
} 