import { NextRequest } from 'next/server';
import { LangChainAgent } from '@/app/lib/models/research-agent';

export async function POST(req: NextRequest) {
  const { query } = await req.json();

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Start processing in the background
  (async () => {
    try {
      // Initialize the agent with a progress callback
      const agent = new LangChainAgent({
        progressCallback: (progress, status) => {
          // Stream progress updates to the client
          writer.write(
            encoder.encode(
              JSON.stringify({
                type: 'progress',
                progress,
                status,
              }) + '\n'
            )
          );
        }
      });

      // Process the query and stream the results
      for await (const chunk of agent.processQueryStream(query)) {
        await writer.write(encoder.encode(chunk));
      }
    } catch (error) {
      console.error('Error:', error);
      await writer.write(
        encoder.encode(
          JSON.stringify({
            type: 'content',
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