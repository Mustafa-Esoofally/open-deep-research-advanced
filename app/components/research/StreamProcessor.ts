import * as React from 'react';
import { nanoid } from 'nanoid';
import { ResearchState, Source, Activity } from './types';
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

  // Debug the incoming data
  debugLog(`Processing ${messages.length} stream messages`, {
    dataLength: data.length,
    firstMessagePreview: messages[0]?.substring(0, 50) + '...'
  });

  for (const message of messages) {
    if (!message.trim()) continue;
    
    try {
      const parsed = JSON.parse(message);
      
      // Log the type of message for debugging
      debugLog(`Parsed message type: ${parsed.type}`, {
        messageType: parsed.type,
        hasContent: Boolean(parsed.content),
        contentLength: parsed.content ? parsed.content.length : 0
      });
      
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
                content: parsed.content || '', // Ensure content is at least an empty string
                timestamp: Date.now()
              });
            }
            
            return {
              ...prevState,
              messages,
              status: 'Generating response...',
              isLoading: true, // Keep loading while streaming chunks
            };
          });
          break;
          
        case 'progress':
          setState(prevState => ({
            ...prevState,
            progress: parsed.progress,
            status: parsed.status || prevState.status,
            isLoading: true, // Ensure loading state continues
          }));
          
          // If we have detailed progress info for deep research, log it
          if (parsed.details) {
            debugLog('Deep research progress details', parsed.details);
          }
          break;
          
        case 'error':
          setState(prevState => ({
            ...prevState,
            error: parsed.content,
            isLoading: false,
            status: 'Error: ' + (parsed.content || 'Unknown error')
          }));
          break;
          
        case 'search_results':
          debugLog('Received search results', { 
            count: parsed.content?.length || 0 
          });
          
          // Add a search activity to track the search process
          setState(prevState => {
            const newActivity: Activity = {
              id: nanoid(),
              type: 'search',
              status: 'complete',
              message: `Found ${parsed.content?.length || 0} search results`,
              timestamp: new Date().toISOString()
            };
            
            return {
              ...prevState,
              searchResults: parsed.content,
              activities: [...prevState.activities, newActivity],
              status: 'Processing search results with Claude 3.7 Sonnet...',
              progress: 50, // Update progress for better UX
            };
          });
          break;
          
        case 'sources':
          // Deduplicate sources based on URL
          setState(prevState => {
            const existingUrls = new Set(prevState.sources.map(s => s.url));
            const newSources = (parsed.sources || [])
              .filter((s: Source) => !existingUrls.has(s.url))
              .map((source: Source) => ({
                ...source,
                // Extract domain from URL if not provided
                domain: source.domain || extractDomain(source.url),
                // Ensure title exists
                title: source.title || 'Untitled Source'
              }));
            
            if (newSources.length > 0) {
              // Add activity for sources found
              const newActivity: Activity = {
                id: nanoid(),
                type: 'extract',
                status: 'complete',
                message: `Added ${newSources.length} new sources`,
                timestamp: new Date().toISOString()
              };
              
              debugLog(`Adding ${newSources.length} new sources`, {
                totalSourcesAfter: prevState.sources.length + newSources.length
              });
              
              return {
                ...prevState,
                sources: [...prevState.sources, ...newSources],
                activities: [...prevState.activities, newActivity],
                status: newSources.length > 0 
                  ? `Found ${prevState.sources.length + newSources.length} sources...` 
                  : prevState.status
              };
            }
            
            return prevState;
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
                debugLog('Adding new source from source_update', {
                  url: parsed.url,
                  title: parsed.data.title || 'Untitled'
                });
                
                return {
                  ...prevState,
                  sources: [
                    ...prevState.sources, 
                    {
                      url: parsed.url,
                      ...parsed.data,
                      domain: parsed.data.domain || extractDomain(parsed.url),
                      title: parsed.data.title || 'Untitled Source' // Ensure title exists
                    }
                  ]
                };
              }
              
              // Otherwise update the existing source
              debugLog('Updating existing source', {
                url: parsed.url,
                title: parsed.data?.title
              });
              
              const updatedSources = prevState.sources.map(source => 
                source.url === parsed.url 
                  ? { 
                      ...source, 
                      ...parsed.data, 
                      domain: parsed.data?.domain || source.domain || extractDomain(source.url),
                      title: parsed.data?.title || source.title || 'Untitled Source' // Ensure title exists
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
          setState(prevState => {
            const newActivity: Activity = {
              id: nanoid(),
              type: 'analyze',
              status: 'complete',
              message: parsed.content,
              timestamp: new Date().toISOString()
            };
            
            return {
              ...prevState,
              learnings: [...prevState.learnings, parsed.content],
              activities: [...prevState.activities, newActivity],
              status: 'Learning from sources...'
            };
          });
          break;
          
        case 'learnings':
          // Handle multiple learnings at once
          if (parsed.content) {
            setState(prevState => {
              const newLearnings = Array.isArray(parsed.content) 
                ? parsed.content
                : parsed.content.split('\n').filter(Boolean);
              
              debugLog(`Adding ${newLearnings.length} learnings`, {
                totalLearningsAfter: prevState.learnings.length + newLearnings.length
              });
              
              // Add activity for learnings
              const newActivity: Activity = {
                id: nanoid(),
                type: 'synthesis',
                status: 'complete',
                message: `Processed ${newLearnings.length} insights from sources`,
                timestamp: new Date().toISOString()
              };
                
              return {
                ...prevState,
                learnings: [...prevState.learnings, ...newLearnings],
                activities: [...prevState.activities, newActivity],
                status: 'Analyzing learnings...'
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
            
            setState(prevState => {
              const newActivity: Activity = {
                id: nanoid(),
                type: 'reasoning',
                status: 'complete',
                message: `Processing reasoning step ${prevState.traces.length + 1}`,
                timestamp: new Date().toISOString()
              };
              
              return {
                ...prevState,
                traces: [...prevState.traces, parsed.content],
                activities: [...prevState.activities, newActivity],
                status: 'Reasoning through the information...'
              };
            });
          }
          break;
          
        case 'complete':
          // Mark the streaming as complete
          setState(prevState => ({
            ...prevState,
            isLoading: false,
            progress: 100,
            status: 'Complete'
          }));
          break;
          
        default:
          console.log('Unknown message type:', parsed.type);
      }
    } catch (e) {
      console.error('Error parsing stream data:', e);
      console.error('Problematic message:', message.substring(0, 100) + '...');
      
      // Try to recover gracefully - if it looks like text content, add it as a chunk
      if (message.length > 5 && !message.startsWith('{') && !message.startsWith('[')) {
        setState(prevState => {
          const messages = [...prevState.messages];
          const assistantMessageIndex = messages.findIndex(
            m => m.role === 'assistant' && messages.indexOf(m) === messages.length - 1
          );
          
          if (assistantMessageIndex >= 0) {
            // Append to existing message as raw text
            messages[assistantMessageIndex] = {
              ...messages[assistantMessageIndex],
              content: messages[assistantMessageIndex].content + message
            };
            
            return {
              ...prevState,
              messages,
              status: 'Streaming response...'
            };
          }
          
          return prevState;
        });
      }
    }
  }
}

// Helper function to extract domain from URL
function extractDomain(url: string): string {
  try {
    // Handle common URL format errors
    if (!url || typeof url !== 'string') return 'unknown';
    
    // Ensure URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    const hostname = new URL(url).hostname;
    // Strip www. and take up to the first dot in the remaining hostname
    const domain = hostname.replace(/^www\./, '');
    return domain;
  } catch (e) {
    // If URL parsing fails, try a simple extraction
    try {
      const parts = url.split('/');
      return parts[2]?.replace(/^www\./, '') || url;
    } catch {
      return 'unknown';
    }
  }
} 