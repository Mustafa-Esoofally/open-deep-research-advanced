import { useChat as useVercelChat } from 'ai/react';

export function useChat() {
  return useVercelChat({
    api: '/api/chat',
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });
} 