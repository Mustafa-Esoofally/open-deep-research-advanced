import FirecrawlApp, { SearchResponse, FirecrawlDocument } from '@mendable/firecrawl-js';
import { generateObject } from 'ai';
import { compact } from 'lodash-es';
import pLimit from 'p-limit';
import { z } from 'zod';

import { o3MiniModel, trimPrompt } from './ai/providers';
import { systemPrompt } from './prompt';
import { OutputManager } from './output-manager';

// Initialize output manager for coordinated console/progress output
const output = new OutputManager();

// Replace console.log with output.log
function log(...args: any[]) {
  output.log(...args);
}

export type ResearchProgress = {
  currentDepth: number;
  totalDepth: number;
  currentBreadth: number;
  totalBreadth: number;
  currentQuery?: string;
  totalQueries: number;
  completedQueries: number;
};

export type ResearchResult = {
  learnings: string[];
  visitedUrls: string[];
};

export type SerpQuery = {
  query: string;
  researchGoal: string;
};

// Add new types for extraction
export type ExtractionResult = {
  key_findings: string[];
  expert_opinions: Array<{
    expert: string;
    opinion: string;
    credentials?: string;
  }>;
  statistical_data: Array<{
    metric: string;
    value: string;
    context: string;
  }>;
  counter_arguments: string[];
  research_gaps: string[];
};

// Add extraction status type
export type ExtractionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

// Update ExtractResponse type to include jobId
export type ExtractResponse = {
  success: boolean;
  data: ExtractionResult;
  status: ExtractionStatus;
  expiresAt: string;
  jobId: string;  // Add jobId at the top level
};

// increase this if you have higher API rate limits
const ConcurrencyLimit = 2;

// Initialize Firecrawl with optional API key and optional base url
const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_KEY ?? '',
  apiUrl: process.env.FIRECRAWL_BASE_URL,
});

// Add timeout configuration
const EXTRACT_TIMEOUT_MS = 60000; // 1 minute
const SEARCH_TIMEOUT_MS = 30000;  // 30 seconds

// Add rate limiting configuration
const RATE_LIMIT = {
  MAX_REQUESTS_PER_MINUTE: 5,
  BACKOFF_INITIAL_MS: 1000,
  BACKOFF_MAX_MS: 60000,
  BACKOFF_MULTIPLIER: 2
};

// Rate limiting state
let requestCount = 0;
let lastResetTime = Date.now();
let currentBackoffMs = RATE_LIMIT.BACKOFF_INITIAL_MS;

// Rate limiting utility functions
async function waitForRateLimit() {
  const now = Date.now();
  const timeElapsed = now - lastResetTime;
  
  // Reset counter if a minute has passed
  if (timeElapsed >= 60000) {
    requestCount = 0;
    lastResetTime = now;
    currentBackoffMs = RATE_LIMIT.BACKOFF_INITIAL_MS;
    return;
  }

  // If we've hit the rate limit, wait with exponential backoff
  if (requestCount >= RATE_LIMIT.MAX_REQUESTS_PER_MINUTE) {
    log(`Rate limit reached, waiting ${currentBackoffMs}ms before retry...`);
    await new Promise(resolve => setTimeout(resolve, currentBackoffMs));
    currentBackoffMs = Math.min(
      currentBackoffMs * RATE_LIMIT.BACKOFF_MULTIPLIER,
      RATE_LIMIT.BACKOFF_MAX_MS
    );
    requestCount = 0;
    lastResetTime = Date.now();
  }
}

// Wrap Firecrawl calls with rate limiting
async function searchWithRateLimit(query: string, options: any = {}) {
  while (true) {
    try {
      await waitForRateLimit();
      requestCount++;
      return await firecrawl.search(query, options);
    } catch (error: any) {
      if (error?.statusCode === 429) {
        // Extract wait time from error message if available
        const waitMatch = error.message.match(/retry after (\d+)s/);
        const waitTime = waitMatch ? parseInt(waitMatch[1]) * 1000 : currentBackoffMs;
        
        log(`Rate limit exceeded, waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
}

async function extractWithRateLimit(urls: string[], options: any = {}) {
  while (true) {
    try {
      await waitForRateLimit();
      requestCount++;
      return await firecrawl.extract(urls, options);
    } catch (error: any) {
      if (error?.statusCode === 429) {
        // Extract wait time from error message if available
        const waitMatch = error.message.match(/retry after (\d+)s/);
        const waitTime = waitMatch ? parseInt(waitMatch[1]) * 1000 : currentBackoffMs;
        
        log(`Rate limit exceeded, waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
}

// take en user query, return a list of SERP queries
async function generateSerpQueries({
  query,
  numQueries = 3,
  learnings,
}: {
  query: string;
  numQueries?: number;
  learnings?: string[];
}) {
  const result = await generateObject({
    model: o3MiniModel,
    system: systemPrompt(),
    prompt: `Given the following prompt from the user, generate a list of SERP queries to research the topic. Return a maximum of ${numQueries} queries, but feel free to return less if the original prompt is clear. Make sure each query is unique and not similar to each other: <prompt>${query}</prompt>\n\n${
      learnings
        ? `Here are some learnings from previous research, use them to generate more specific queries: ${learnings.join(
            '\n',
          )}`
        : ''
    }`,
    schema: z.object({
      queries: z
        .array(
          z.object({
            query: z.string().describe('The SERP query'),
            researchGoal: z
              .string()
              .describe(
                'First talk about the goal of the research that this query is meant to accomplish, then go deeper into how to advance the research once the results are found, mention additional research directions. Be as specific as possible, especially for additional research directions.',
              ),
          }),
        )
        .describe(`List of SERP queries, max of ${numQueries}`),
    }),
  });

  log(
    `Created ${result.object.queries.length} queries`,
    result.object.queries,
  );
  return result.object.queries.slice(0, numQueries);
}

// Add new function to create extraction prompt
function createExtractionPrompt(query: string, learnings?: string[]): string {
  return `
    Research Topic: "${query}"
    ${learnings?.length ? `Previous Findings: ${learnings.join('\n')}` : ''}
    
    Extract and organize the following information:
    1. Key findings and main arguments
    2. Expert opinions with credentials when available
    3. Statistical data and metrics with context
    4. Counter-arguments and alternative viewpoints
    5. Identified research gaps or areas needing more investigation
    
    Please structure the information clearly and maintain academic rigor.
  `.trim();
}

// Update waitForExtraction to use correct types
async function waitForExtraction(
  extractResponse: ExtractResponse,
  maxAttempts = 30,
  intervalMs = 2000
): Promise<ExtractionResult> {
  let attempts = 0;
  let currentResponse = extractResponse;
  
  while (attempts < maxAttempts) {
    if (currentResponse.status === 'completed') {
      return currentResponse.data;
    }
    
    if (currentResponse.status === 'failed' || currentResponse.status === 'cancelled') {
      throw new Error(`Extraction failed with status: ${currentResponse.status}`);
    }
    
    attempts++;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    
    // Get updated status using the job ID from the response
    const statusResponse = await firecrawl.getExtractStatus(currentResponse.jobId);
    if (!statusResponse.success) {
      throw new Error('Failed to get extraction status');
    }
    currentResponse = statusResponse;
  }
  
  throw new Error('Extraction timed out');
}

// Update processSerpResult to use rate-limited functions
async function processSerpResult({
  query,
  result,
  numLearnings = 3,
  numFollowUpQuestions = 3,
}: {
  query: string;
  result: SearchResponse;
  numLearnings?: number;
  numFollowUpQuestions?: number;
}) {
  // Start with basic content extraction
  const contents = compact(result.data.map((item: { markdown?: string }) => item.markdown)).map(
    (content: string) => trimPrompt(content, 25_000),
  );
  
  if (contents.length === 0) {
    log(`No content found for query: ${query}`);
    return {
      learnings: [],
      followUpQuestions: []
    };
  }

  // Process content with our AI first to ensure we have base results
  log(`Processing ${contents.length} content items for ${query}`);
  const baseResponse = await generateObject({
    model: o3MiniModel,
    system: systemPrompt(),
    prompt: `Given the following contents from a search for <query>${query}</query>, generate key learnings. Return up to ${numLearnings} unique, detailed learnings with metrics and facts when available.\n\n<contents>${contents
      .map((content: string) => `<content>\n${content}\n</content>`)
      .join('\n')}</contents>`,
    schema: z.object({
      learnings: z.array(z.string()).describe(`Key learnings, max ${numLearnings}`),
      followUpQuestions: z.array(z.string()).describe(`Follow-up questions, max ${numFollowUpQuestions}`),
    }),
  });

  try {
    // Try extraction only for the first URL to enhance base results
    const mainUrl = result.data[0]?.url;
    if (mainUrl) {
      try {
        const extractResponse = await extractWithRateLimit([mainUrl], {
          prompt: createExtractionPrompt(query),
          enableWebSearch: true
        });

        if (extractResponse.success) {
          const extractionResult = extractResponse.data as ExtractionResult;
          
          // Combine base results with extraction results
          return {
            learnings: [
              ...baseResponse.object.learnings,
              ...extractionResult.key_findings,
              ...extractionResult.expert_opinions.map(o => `Expert ${o.expert}: ${o.opinion}`),
              ...extractionResult.statistical_data.map(s => `${s.metric}: ${s.value} (${s.context})`),
              ...extractionResult.counter_arguments,
            ].slice(0, numLearnings * 2), // Allow for more learnings when we have both sources
            followUpQuestions: [
              ...baseResponse.object.followUpQuestions,
              ...extractionResult.research_gaps
            ].slice(0, numFollowUpQuestions * 2)
          };
        }
      } catch (error) {
        log('Single URL extraction failed, using base results:', error);
      }
    }

    return baseResponse.object;
  } catch (error) {
    log('Error in enhanced processing, returning base results:', error);
    return baseResponse.object;
  }
}

export async function writeFinalReport({
  prompt,
  learnings,
  visitedUrls,
}: {
  prompt: string;
  learnings: string[];
  visitedUrls: string[];
}) {
  const learningsString = trimPrompt(
    learnings
      .map(learning => `<learning>\n${learning}\n</learning>`)
      .join('\n'),
    150_000,
  );

  const response = await generateObject({
    model: o3MiniModel,
    system: systemPrompt(),
    prompt: `Given the following prompt from the user, write a final report on the topic using the learnings from research. Make it as as detailed as possible, aim for 3 or more pages, include ALL the learnings from research:\n\n<prompt>${prompt}</prompt>\n\nHere are all the learnings from previous research:\n\n<learnings>\n${learningsString}\n</learnings>`,
    schema: z.object({
      reportMarkdown: z
        .string()
        .describe('Final report on the topic in Markdown'),
    }),
  });

  // Append the visited URLs section to the report
  const urlsSection = `\n\n## Sources\n\n${visitedUrls.map(url => `- ${url}`).join('\n')}`;
  return response.object.reportMarkdown + urlsSection;
}

// Update deepResearch to use rate-limited search
export async function deepResearch({
  query,
  breadth,
  depth,
  learnings = [],
  visitedUrls = [],
  onProgress,
}: {
  query: string;
  breadth: number;
  depth: number;
  learnings?: string[];
  visitedUrls?: string[];
  onProgress?: (progress: ResearchProgress) => void;
}): Promise<ResearchResult> {
  const progress: ResearchProgress = {
    currentDepth: depth,
    totalDepth: depth,
    currentBreadth: breadth,
    totalBreadth: breadth,
    totalQueries: 0,
    completedQueries: 0,
  };
  
  const reportProgress = (update: Partial<ResearchProgress>) => {
    Object.assign(progress, update);
    onProgress?.(progress);
  };

  const serpQueries = await generateSerpQueries({
    query,
    learnings,
    numQueries: breadth,
  });
  
  reportProgress({
    totalQueries: serpQueries.length,
    currentQuery: serpQueries[0]?.query
  });
  
  const limit = pLimit(ConcurrencyLimit);

  const results = await Promise.all(
    serpQueries.map((serpQuery: SerpQuery) =>
      limit(async () => {
        try {
          const result = await searchWithRateLimit(serpQuery.query, {
            numResults: 10,
          });

          const newLearnings = await processSerpResult({
            query: serpQuery.query,
            result,
          });

          const allLearnings = [...learnings, ...newLearnings.learnings];
          const allUrls = [
            ...visitedUrls,
            ...result.data.map((item: FirecrawlDocument) => item.url || '').filter(Boolean),
          ];

          const newBreadth = Math.max(1, Math.floor(breadth * 0.8));
          const newDepth = depth - 1;

          if (newDepth > 0) {
            log(
              `Researching deeper, breadth: ${newBreadth}, depth: ${newDepth}`,
            );

            reportProgress({
              currentDepth: newDepth,
              currentBreadth: newBreadth,
              completedQueries: progress.completedQueries + 1,
              currentQuery: serpQuery.query,
            });

            const nextQuery = `
            Previous research goal: ${serpQuery.researchGoal}
            Follow-up research directions: ${newLearnings.followUpQuestions.map((q: string) => `\n${q}`).join('')}
          `.trim();

            return deepResearch({
              query: nextQuery,
              breadth: newBreadth,
              depth: newDepth,
              learnings: allLearnings,
              visitedUrls: allUrls,
              onProgress,
            });
          } else {
            reportProgress({
              currentDepth: 0,
              completedQueries: progress.completedQueries + 1,
              currentQuery: serpQuery.query,
            });
            return {
              learnings: allLearnings,
              visitedUrls: allUrls,
            };
          }
        } catch (e: any) {
          if (e.message && e.message.includes('Timeout')) {
            log(
              `Timeout error running query: ${serpQuery.query}: `,
              e,
            );
          } else {
            log(`Error running query: ${serpQuery.query}: `, e);
          }
          return {
            learnings: [],
            visitedUrls: [],
          };
        }
      }),
    ),
  );

  return {
    learnings: [...new Set(results.flatMap(r => r.learnings))],
    visitedUrls: [...new Set(results.flatMap(r => r.visitedUrls))],
  };
}
