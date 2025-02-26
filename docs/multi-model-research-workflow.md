# Multi-Model Deep Research Workflow

## Overview

This document provides implementation details for a multi-model deep research workflow designed to efficiently analyze 100-200 web searches while keeping costs and time spent as low as possible. The approach uses multiple models from Open Router for different parts of the research process, with a focus on streaming results for real-time UI updates.

## Key Principles

1. **Task Specialization**: Assign different models to different tasks based on their strengths
2. **Batched Processing**: Process searches in manageable batches (20-30 at a time)
3. **Progressive Streaming**: Continuously update the UI with incremental results
4. **Cost Optimization**: Use cheaper models for initial filtering, premium models for synthesis
5. **Parallel Execution**: Run independent tasks concurrently when possible

## Implementation Guide

### 1. Extend UnifiedResearchAgent

```typescript
// Add this to unified-research-agent.ts

interface ModelSelectionStrategy {
  selectModelForContent(content: string, metadata: {
    contentType?: 'technical' | 'scholarly' | 'general' | 'large';
    relevanceScore?: number;
  }): string;
}

class DefaultModelSelectionStrategy implements ModelSelectionStrategy {
  selectModelForContent(content: string, metadata: {
    contentType?: 'technical' | 'scholarly' | 'general' | 'large';
    relevanceScore?: number;
  }): string {
    // Select model based on content type
    const contentType = metadata.contentType || this.detectContentType(content);
    const relevanceScore = metadata.relevanceScore || 0.5;
    
    // Use relevance score to determine analysis depth
    if (relevanceScore > 0.8) {
      return 'claude-3.7-sonnet'; // High relevance deserves best model
    }
    
    // Content-type based selection for medium relevance
    if (contentType === 'technical') return 'deepseek-r1';
    if (contentType === 'scholarly') return 'claude-3.7-sonnet';
    if (contentType === 'large') return 'gemini-flash';
    
    // Default for general content with medium relevance
    return 'sonar-reasoning';
  }
  
  private detectContentType(content: string): 'technical' | 'scholarly' | 'general' | 'large' {
    // Simple heuristic detection
    if (content.length > 10000) return 'large';
    
    // Count technical indicators (code blocks, technical terms)
    const technicalTerms = ['function', 'code', 'algorithm', 'programming', 'database', 'API'];
    const technicalCount = technicalTerms.filter(term => 
      content.toLowerCase().includes(term)).length;
      
    // Count scholarly indicators (citations, academic terms)
    const scholarlyTerms = ['research', 'study', 'paper', 'journal', 'analysis', 'findings'];
    const scholarlyCount = scholarlyTerms.filter(term => 
      content.toLowerCase().includes(term)).length;
    
    if (technicalCount > scholarlyCount) return 'technical';
    if (scholarlyCount > 2) return 'scholarly';
    return 'general';
  }
}
```

### 2. Add Parallel Processing With Worker Pools

```typescript
// Add this to unified-research-agent.ts

/**
 * Process items in parallel with a concurrency limit
 */
private async processInParallel<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency = 5
): Promise<R[]> {
  const limit = pLimit(concurrency);
  return Promise.all(items.map(item => limit(() => processor(item))));
}

/**
 * Generate and process search queries in batches
 */
private async processBatches(
  query: string, 
  options: { depth: number; breadth: number }
): AsyncGenerator<string> {
  // Generate all queries for all depth levels
  const allQueries = await this.generateAllQueries(query, options);
  
  // Split into batches of 20-30 queries
  const batches = this.chunkArray(allQueries, 25);
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    // Report batch progress
    yield JSON.stringify({
      type: 'batch_start',
      batchNumber: i + 1,
      totalBatches: batches.length
    });
    
    // Process each batch in parallel
    const batchResults = await this.processInParallel(
      batch,
      async (q) => {
        const searchResults = await this.searchWeb(q.query);
        
        // Report search completion
        yield JSON.stringify({
          type: 'search_complete',
          query: q.query,
          resultCount: searchResults.results.length
        });
        
        const analysisResults = await this.analyzeSearchResults(
          searchResults, 
          this.modelSelectionStrategy
        );
        
        return {
          query: q.query,
          searchResults,
          analysisResults
        };
      },
      CONCURRENCY_LIMIT
    );
    
    // Process batch results and yield
    const batchSummary = await this.aggregateBatchResults(batchResults);
    
    yield JSON.stringify({
      type: 'batch_complete',
      batchNumber: i + 1,
      totalBatches: batches.length,
      batchSummary
    });
  }
}
```

### 3. Enhanced Streaming Response Format

```typescript
// Modify processQueryStream in unified-research-agent.ts

async *processQueryStream(query: string, options = { depth: 2, breadth: 5 }): AsyncGenerator<string> {
  // Initialize query processing
  const startTime = Date.now();
  
  // Stream initial acknowledgment
  yield JSON.stringify({ 
    type: 'start', 
    query,
    options,
    timestamp: new Date().toISOString()
  });
  
  try {
    // Process in batches with enhanced streaming
    for await (const update of this.processBatches(query, options)) {
      yield update;
    }
    
    // Generate final synthesis
    const finalSynthesis = await this.generateFinalSynthesis(query);
    
    // Stream final result
    yield JSON.stringify({
      type: 'complete',
      research: finalSynthesis.research,
      analysis: finalSynthesis.analysis,
      sources: finalSynthesis.sources,
      metrics: {
        totalTime: (Date.now() - startTime) / 1000,
        modelsUsed: this.modelsUsed
      }
    });
  } catch (error) {
    yield JSON.stringify({
      type: 'error',
      message: error.message || 'An error occurred during research',
      timestamp: new Date().toISOString()
    });
  }
}
```

### 4. Adaptive Content Analysis

```typescript
/**
 * Analyze search results with appropriate models
 */
private async analyzeSearchResults(
  searchResults: { results: any[], sources: Source[] },
  modelSelectionStrategy: ModelSelectionStrategy
): Promise<any> {
  if (!searchResults.results.length) {
    return { analysis: "No results found", sources: [] };
  }
  
  // Group results by domain for efficient processing
  const resultsByDomain = this.groupResultsByDomain(searchResults.results);
  
  // Process each domain group with appropriate model
  const domainAnalyses = await this.processInParallel(
    Object.entries(resultsByDomain),
    async ([domain, results]) => {
      // Combine content for domain
      const combinedContent = results
        .map(r => `TITLE: ${r.title}\nCONTENT: ${r.snippet || ''}\nURL: ${r.url}`)
        .join('\n\n');
      
      // Calculate relevance score based on result rankings
      const relevanceScore = results.reduce((score, result, idx) => 
        score + (1 / (idx + 1)), 0) / results.length;
      
      // Detect content type
      const contentType = this.detectContentType(combinedContent);
      
      // Select appropriate model
      const modelKey = modelSelectionStrategy.selectModelForContent(
        combinedContent, 
        { contentType, relevanceScore }
      );
      
      // Track models used for reporting
      this.modelsUsed.add(modelKey);
      
      // Analyze with selected model
      const analysis = await this.analyzeWithModel(combinedContent, modelKey);
      
      return {
        domain,
        analysis,
        sources: results.map(r => ({
          title: r.title,
          url: r.url,
          relevance: relevanceScore
        }))
      };
    },
    CONCURRENCY_LIMIT
  );
  
  return {
    domainAnalyses,
    sources: searchResults.sources
  };
}
```

### 5. Final Implementation Plan

1. **Phase 1: Infrastructure Setup**
   - Extend the agent with model selection strategy
   - Implement parallel processing utilities
   - Add batched processing capabilities

2. **Phase 2: Model Integration**
   - Configure all available models in model registry
   - Implement content type detection
   - Create model selection strategy

3. **Phase 3: Enhanced Streaming**
   - Improve the streaming response format
   - Implement real-time progress updates
   - Add batch progress reporting

4. **Phase 4: UI Integration**
   - Update frontend to consume enhanced stream format
   - Implement progressive UI updates
   - Add visualization of model selection

5. **Phase 5: Testing & Optimization**
   - Benchmark performance on large query sets
   - Optimize cost by fine-tuning model selection
   - Implement caching for repeated queries

## Cost Optimization Strategies

1. **Tiered Model Approach**:
   - Use cheaper models for initial filtering
   - Use premium models only for highly relevant content
   - Reserve Claude 3.7 Sonnet for final synthesis only

2. **Content Chunking**:
   - Split large documents to process with smaller context models
   - Use models with large context windows only when necessary

3. **Caching**:
   - Cache model outputs for similar queries
   - Store intermediate results to avoid redundant processing

4. **Relevance Filtering**:
   - Process only the most relevant search results deeply
   - Use lightweight analysis for low-relevance content

## Performance Metrics

Track the following metrics for each research session:

- **Total Processing Time**: End-to-end research time
- **Models Used**: Which models were selected and why
- **Cost Per Query**: Estimated token usage and cost
- **Relevance Score**: Quality of final synthesis
- **Search Efficiency**: Number of useful results per query

## Next Steps

1. Implement the core components of this architecture
2. Create a test suite for benchmarking
3. Build monitoring tools for cost and performance
4. Develop advanced content type detection using ML techniques 