import { memo } from 'react';
import { Message } from './message';
import { Spinner } from './ui/spinner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface MessagesProps {
  messages: Message[];
  isLoading: boolean;
}

function PureMessages({ messages, isLoading }: MessagesProps) {
  return (
    <div className="flex flex-col gap-6">
      {messages.length === 0 && (
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold mb-4">Welcome to Deep Research</h1>
          <p className="text-muted-foreground mb-4">
            Enter your research query and our AI will help you explore and analyze complex topics.
          </p>
          <div className="text-sm text-muted-foreground">
            Example queries:
            <ul className="mt-2 space-y-2 text-left">
              <li>• "What are the latest developments in quantum computing?"</li>
              <li>• "Analyze the impact of AI on healthcare"</li>
              <li>• "Research the future of renewable energy technologies"</li>
            </ul>
          </div>
        </div>
      )}

      {messages.map((message) => (
        <Message
          key={message.id}
          role={message.role}
          content={message.content}
        />
      ))}
      
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner className="h-4 w-4" />
          <span>Researching...</span>
        </div>
      )}
    </div>
  );
}

export const Messages = memo(PureMessages); 