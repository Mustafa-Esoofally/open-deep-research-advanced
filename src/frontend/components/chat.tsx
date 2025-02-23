'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Messages } from './messages';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { ChatHeader } from './chat-header';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<'search' | 'deep-research'>('deep-research');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to process request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <ChatHeader />

      <main className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          <ScrollArea className="flex-1 px-4">
            <div className="max-w-3xl mx-auto py-6">
              <Messages messages={messages} isLoading={isLoading} />
            </div>
          </ScrollArea>

          <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-4 flex gap-3">
              <div className="flex-1 overflow-hidden">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter your research query..."
                  className="min-h-[52px]"
                  disabled={isLoading}
                />
              </div>
              <Button 
                type="submit" 
                size="lg"
                disabled={isLoading}
                className="min-w-[100px]"
              >
                {isLoading ? "Researching..." : "Research"}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
} 