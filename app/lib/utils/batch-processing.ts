import pLimit from 'p-limit';

/**
 * Utilities for batch processing of search queries and results
 */

/**
 * Split an array into batches of a specified size
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  if (!array || !array.length) return [];
  
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  
  return result;
}

/**
 * Group search results by domain for more efficient processing
 */
export function groupResultsByDomain(results: any[]): Record<string, any[]> {
  if (!results || !results.length) return {};
  
  const domains: Record<string, any[]> = {};
  
  for (const result of results) {
    if (!result.url) continue;
    
    try {
      // Extract domain from URL
      const url = new URL(result.url);
      const domain = url.hostname;
      
      if (!domains[domain]) {
        domains[domain] = [];
      }
      
      domains[domain].push(result);
    } catch (error) {
      // Skip invalid URLs
      console.warn(`Skipping invalid URL: ${result.url}`);
    }
  }
  
  return domains;
}

/**
 * Process items in parallel with concurrency control
 * 
 * @param items Array of items to process
 * @param processor Function to process each item
 * @param concurrency Maximum number of items to process concurrently
 * @returns Promise that resolves to array of results
 */
export async function processInParallel<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency = 5
): Promise<R[]> {
  if (!items || !items.length) return [];
  
  const limit = pLimit(concurrency);
  return Promise.all(items.map(item => limit(() => processor(item))));
}

/**
 * Process items in parallel and update progress
 * 
 * @param items Array of items to process
 * @param processor Function to process each item
 * @param progressCallback Callback to report progress
 * @param concurrency Maximum number of items to process concurrently
 * @returns Promise that resolves to array of results
 */
export async function processWithProgress<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  progressCallback: (progress: number, index: number, total: number) => void,
  concurrency = 5
): Promise<R[]> {
  if (!items || !items.length) return [];
  
  const limit = pLimit(concurrency);
  let completed = 0;
  const total = items.length;
  
  return Promise.all(
    items.map((item, index) => 
      limit(async () => {
        const result = await processor(item, index);
        
        completed++;
        const progress = (completed / total) * 100;
        progressCallback(progress, index, total);
        
        return result;
      })
    )
  );
}

// Types for batch processing updates
interface BatchInfo {
  type: 'batch_info';
  totalBatches: number;
  totalItems: number;
  batchSize: number;
}

interface BatchStart {
  type: 'batch_start';
  batchIndex: number;
  batchNumber: number;
  totalBatches: number;
  itemCount: number;
}

interface BatchComplete {
  type: 'batch_complete';
  batchIndex: number;
  batchNumber: number;
  totalBatches: number;
  progress: number;
}

interface AllBatchesComplete {
  type: 'all_batches_complete';
  totalProcessed: number;
}

type BatchUpdate = BatchInfo | BatchStart | BatchComplete | AllBatchesComplete;

/**
 * Process batches sequentially and report progress
 * 
 * @param items Array of items to process
 * @param processor Function to process each batch
 * @param batchSize Size of each batch
 * @returns Array of batch results
 */
export async function processBatchesSequentially<T, R>(
  items: T[],
  processor: (batch: T[], batchIndex: number) => Promise<R>,
  progressCallback: (update: BatchUpdate) => void,
  batchSize = 25
): Promise<R[]> {
  if (!items || !items.length) {
    return [];
  }
  
  const batches = chunkArray(items, batchSize);
  const results: R[] = [];
  
  // Report initial batch info
  progressCallback({
    type: 'batch_info',
    totalBatches: batches.length,
    totalItems: items.length,
    batchSize
  });
  
  // Process each batch sequentially
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    
    // Signal batch start
    progressCallback({
      type: 'batch_start',
      batchIndex,
      batchNumber: batchIndex + 1,
      totalBatches: batches.length,
      itemCount: batch.length
    });
    
    // Process the batch
    const batchResult = await processor(batch, batchIndex);
    results.push(batchResult);
    
    // Signal batch completion
    progressCallback({
      type: 'batch_complete',
      batchIndex,
      batchNumber: batchIndex + 1,
      totalBatches: batches.length,
      progress: ((batchIndex + 1) / batches.length) * 100
    });
  }
  
  // Signal all batches complete
  progressCallback({
    type: 'all_batches_complete',
    totalProcessed: items.length
  });
  
  return results;
}

/**
 * Process items with retries for robustness
 * 
 * @param items Array of items to process
 * @param processor Function to process each item
 * @param maxRetries Maximum number of retries per item
 * @param retryDelay Delay between retries in ms
 * @returns Promise that resolves to array of results or errors
 */
export async function processWithRetries<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  maxRetries = 3,
  retryDelay = 1000
): Promise<Array<R | Error>> {
  return Promise.all(
    items.map(async (item) => {
      let attempts = 0;
      
      while (attempts <= maxRetries) {
        try {
          return await processor(item);
        } catch (error) {
          attempts++;
          
          if (attempts > maxRetries) {
            return error instanceof Error 
              ? error 
              : new Error(`Failed to process item after ${maxRetries} attempts`);
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
      
      // This shouldn't happen but TypeScript needs a return
      return new Error('Unexpected error in retry logic');
    })
  );
} 