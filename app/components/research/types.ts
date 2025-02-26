// Message type for chat messages
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

// Source type for research sources
export interface Source {
  title: string;
  url: string;
  domain?: string;
  relevance?: number;
  snippet?: string;
  favicon?: string;
}

// Activity type for tracking research activities
export interface Activity {
  id: string;
  type: 'search' | 'extract' | 'analyze' | 'reasoning' | 'synthesis' | 'thought';
  status: 'pending' | 'complete' | 'error';
  message: string;
  timestamp: string;
}

// State type for research component
export interface ResearchState {
  messages: Message[];
  sources: Source[];
  searchResults: string;
  learnings: string[];
  isLoading: boolean;
  isDeepResearch: boolean;
  depth: number;
  breadth: number;
  progress: number;
  status: string;
  error: string | null;
  modelKey: string;
  traces: string[];
  activities: Activity[];
}

// Initial state for research component
export const initialResearchState: ResearchState = {
  messages: [],
  sources: [],
  searchResults: '',
  learnings: [],
  isLoading: false,
  isDeepResearch: false,
  depth: 2,
  breadth: 3,
  progress: 0,
  status: '',
  error: null,
  modelKey: process.env.NEXT_PUBLIC_DEFAULT_MODEL_KEY || 'deepseek-r1',
  traces: [],
  activities: []
}; 