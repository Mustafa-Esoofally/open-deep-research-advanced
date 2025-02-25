import { NextRequest } from 'next/server';
import { UnifiedResearchAgent } from '@/app/lib/models/unified-research-agent';
import { refreshEnv } from '@/app/lib/env';
import { modelRegistry } from '@/app/lib/models/providers';

// Force environment refresh at the start of each API call
refreshEnv();

export async function POST(req: NextRequest) {
  const { query, options = { isDeepResearch: false, depth: 2, breadth: 3 }, modelKey = '' } = await req.json();

  // Validate the model key
  let validatedModelKey = modelKey;
  if (!modelKey || !modelRegistry.getModelConfig(modelKey)) {
    // Use default model if invalid
    validatedModelKey = process.env.DEFAULT_MODEL_KEY || 'o1-mini';
    console.log(`Invalid model key: ${modelKey}, using default: ${validatedModelKey}`);
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Start processing in the background
  (async () => {
    try {
      // Initialize the agent with a progress callback and model
      const agent = new UnifiedResearchAgent({
        progressCallback: (progress) => {
          // Stream progress updates to the client
          const progressUpdate = options.isDeepResearch 
            ? JSON.stringify({
                type: 'progress',
                progress: progress.progress || 0,
                status: progress.status || `Researching depth ${progress.currentDepth}/${progress.totalDepth}`,
                details: {
                  depth: {
                    current: progress.currentDepth,
                    total: progress.totalDepth
                  },
                  breadth: {
                    current: progress.currentBreadth,
                    total: progress.totalBreadth
                  },
                  queries: {
                    current: progress.completedQueries,
                    total: progress.totalQueries,
                    currentQuery: progress.currentQuery
                  }
                }
              })
            : JSON.stringify({
                type: 'progress',
                progress: progress.progress || 0,
                status: progress.status || 'Researching...'
              });
          
          writer.write(encoder.encode(progressUpdate + '\n'));
        },
        modelKey: validatedModelKey
      });

      // Process the query and stream the results
      for await (const chunk of agent.processQueryStream(query, options)) {
        await writer.write(encoder.encode(chunk));
      }
    } catch (error) {
      console.error('Error:', error);
      await writer.write(
        encoder.encode(
          JSON.stringify({
            type: 'error',
            content: 'An error occurred during research. Please try again with a more specific query.',
          }) + '\n'
        )
      );
    } finally {
      writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
} 