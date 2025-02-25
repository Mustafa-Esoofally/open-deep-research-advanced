import * as React from 'react';
import { nanoid } from 'nanoid';
import { ResearchState, Source } from './types';
import { debugLog } from './utils';

/**
 * Process the streamed data from the research API
 */
export function processStreamData(
  data: string,
  state: ResearchState,
  setState: React.Dispatch<React.SetStateAction<ResearchState>>
): void {
  // Split the received chunk by newlines to handle multiple JSON objects
  const messages = data.trim().split('\n');

  for (const message of messages) {
    if (!message.trim()) continue;
    
    try {
      const parsed = JSON.parse(message);
      
      // Process each type of message
      switch (parsed.type) {
        case 'content':
          // Check if we already have an assistant message
          const existingAssistantMessage = state.messages.find(
            m => m.role === 'assistant' && state.messages.indexOf(m) === state.messages.length - 1
          );
          
          if (existingAssistantMessage) {
            // Update existing message with appended content for streaming effect
            setState(prevState => {
              const updatedMessages = [...prevState.messages];
              const lastIndex = updatedMessages.length - 1;
              
              if (updatedMessages[lastIndex].role === 'assistant') {
                updatedMessages[lastIndex] = {
                  ...updatedMessages[lastIndex],
                  content: updatedMessages[lastIndex].content + parsed.content
                };
              }
              
              return {
                ...prevState,
                messages: updatedMessages,
                isLoading: false,
                progress: 100,
                status: 'Complete'
              };
            });
          } else {
            // Create new assistant message
            setState(prevState => ({
              ...prevState,
              messages: [
                ...prevState.messages,
                {
                  id: nanoid(),
                  role: 'assistant',
                  content: parsed.content,
                  timestamp: Date.now()
                }
              ],
              isLoading: false,
              progress: 100,
              status: 'Complete'
            }));
          }
          break;
          
        case 'content_chunk':
          // For streaming responses chunk by chunk
          setState(prevState => {
            const messages = [...prevState.messages];
            const assistantMessageIndex = messages.findIndex(
              m => m.role === 'assistant' && messages.indexOf(m) === messages.length - 1
            );
            
            if (assistantMessageIndex >= 0) {
              // Append to existing message
              messages[assistantMessageIndex] = {
                ...messages[assistantMessageIndex],
                content: messages[assistantMessageIndex].content + parsed.content
              };
            } else {
              // Create new assistant message
              messages.push({
                id: nanoid(),
                role: 'assistant',
                content: parsed.content,
                timestamp: Date.now()
              });
            }
            
            return {
              ...prevState,
              messages,
              status: 'Generating response...'
            };
          });
          break;
          
        case 'progress':
          setState(prevState => ({
            ...prevState,
            progress: parsed.progress,
            status: parsed.status || prevState.status
          }));
          break;
          
        case 'error':
          setState(prevState => ({
            ...prevState,
            error: parsed.content,
            isLoading: false
          }));
          break;
          
        case 'search_results':
          setState(prevState => ({
            ...prevState,
            searchResults: parsed.content,
            status: 'Processing search results with DeepSeek R1 Distill 70B...'
          }));
          break;
          
        case 'sources':
          // Deduplicate sources based on URL
          setState(prevState => {
            const existingUrls = new Set(prevState.sources.map(s => s.url));
            const newSources = parsed.sources
              .filter((s: Source) => !existingUrls.has(s.url))
              .map((source: Source) => ({
                ...source,
                // Extract domain from URL if not provided
                domain: source.domain || extractDomain(source.url)
              }));
            
            return {
              ...prevState,
              sources: [...prevState.sources, ...newSources],
              status: newSources.length > 0 
                ? `Found ${prevState.sources.length + newSources.length} sources...` 
                : prevState.status
            };
          });
          break;
          
        case 'source_update':
          // Update a specific source with more details
          if (parsed.url) {
            setState(prevState => {
              // Check if we already have this source
              const sourceExists = prevState.sources.some(s => s.url === parsed.url);
              
              // If the source doesn't exist, add it
              if (!sourceExists && parsed.data) {
                return {
                  ...prevState,
                  sources: [
                    ...prevState.sources, 
                    {
                      url: parsed.url,
                      ...parsed.data,
                      domain: parsed.data.domain || extractDomain(parsed.url)
                    }
                  ]
                };
              }
              
              // Otherwise update the existing source
              const updatedSources = prevState.sources.map(source => 
                source.url === parsed.url 
                  ? { 
                      ...source, 
                      ...parsed.data, 
                      domain: parsed.data?.domain || source.domain || extractDomain(source.url) 
                    }
                  : source
              );
              
              return {
                ...prevState,
                sources: updatedSources
              };
            });
          }
          break;
          
        case 'learning':
          setState(prevState => ({
            ...prevState,
            learnings: [...prevState.learnings, parsed.content]
          }));
          break;
          
        case 'learnings':
          // Handle multiple learnings at once
          if (parsed.content) {
            setState(prevState => {
              const newLearnings = Array.isArray(parsed.content) 
                ? parsed.content
                : parsed.content.split('\n').filter(Boolean);
                
              return {
                ...prevState,
                learnings: [...prevState.learnings, ...newLearnings]
              };
            });
          }
          break;
          
        case 'reasoning_trace':
          // Add the reasoning trace
          if (parsed.content) {
            debugLog('Received reasoning trace', { 
              length: parsed.content.length,
              traceNumber: state.traces.length + 1
            });
            
            setState(prevState => ({
              ...prevState,
              traces: [...prevState.traces, parsed.content],
              status: 'Processing search results with DeepSeek R1 Distill 70B...'
            }));
          }
          break;
          
        default:
          console.log('Unknown message type:', parsed.type);
      }
    } catch (e) {
      console.error('Error parsing stream data:', e);
    }
  }
}

// Helper function to extract domain from URL
function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Strip www. and take up to the first dot in the remaining hostname
    const domain = hostname.replace(/^www\./, '');
    return domain;
  } catch {
    // If URL parsing fails, try a simple extraction
    const parts = url.split('/');
    return parts[2]?.replace(/^www\./, '') || url;
  }
} 