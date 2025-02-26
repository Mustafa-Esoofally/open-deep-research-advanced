import { modelRegistry } from './providers';

/**
 * Content type classification for analysis
 */
export type ContentType = 'technical' | 'scholarly' | 'general' | 'large' | 'unknown';

/**
 * Metadata about content for model selection
 */
export interface ContentMetadata {
  contentType?: ContentType;
  relevanceScore?: number;
  tokensEstimate?: number;
}

/**
 * Strategy interface for selecting appropriate models
 */
export interface ModelSelectionStrategy {
  /**
   * Select the most appropriate model for processing the given content
   */
  selectModelForContent(content: string, metadata?: ContentMetadata): string;
  
  /**
   * Detect the type of content for intelligent routing
   */
  detectContentType(content: string): ContentType;
  
  /**
   * Estimate the relevance score of content
   */
  estimateRelevance(content: string, query: string): number;
}

/**
 * Default implementation of model selection strategy
 */
export class DefaultModelSelectionStrategy implements ModelSelectionStrategy {
  /**
   * Select appropriate model based on content type and relevance
   */
  selectModelForContent(
    content: string, 
    metadata: ContentMetadata = {}
  ): string {
    // Get content type (use provided or detect)
    const contentType = metadata.contentType || this.detectContentType(content);
    
    // Get relevance score (use provided or default)
    const relevanceScore = metadata.relevanceScore || 0.5;
    
    // Estimate token count
    const tokensEstimate = metadata.tokensEstimate || this.estimateTokens(content);
    
    // High relevance content gets premium treatment
    if (relevanceScore > 0.8) {
      // Use cheaper model for very long content, even if relevance is high
      if (tokensEstimate > 100000) {
        return 'gemini-flash';
      }
      return 'claude-3.7-sonnet';
    }
    
    // Medium relevance (0.5-0.8) gets content-appropriate model
    if (relevanceScore >= 0.5) {
      if (contentType === 'technical') return 'deepseek-r1';
      if (contentType === 'scholarly') return 'claude-3.7-sonnet';
      if (contentType === 'large') return 'gemini-flash';
      return 'sonar-reasoning'; // General content
    }
    
    // Low relevance content gets fastest/cheapest model
    return 'deepseek-distill-70b';
  }
  
  /**
   * Detect content type based on text analysis
   */
  detectContentType(content: string): ContentType {
    if (!content || content.trim().length === 0) {
      return 'unknown';
    }
    
    // Check for large documents first
    if (content.length > 30000) {
      return 'large';
    }
    
    // Technical content indicators
    const technicalPatterns = [
      /```[\s\S]*?```/, // Code blocks
      /function\s+\w+\s*\(/, // Function definitions
      /<[^>]+>/, // HTML/XML tags
      /\b(algorithm|api|backend|code|compiler|css|database|docker|function|git|html|javascript|json|kubernetes|linux|method|npm|programming|python|regex|repository|sdk|sql|typescript|variable)\b/i
    ];
    
    // Scholarly content indicators
    const scholarlyPatterns = [
      /\[\d+\]/, // Citation format [1]
      /\((?:et al\.|[A-Za-z]+),\s+\d{4}\)/, // Citation format (Author, YEAR)
      /(?:figure|table|equation)\s+\d+/i, // Figure/Table references
      /\b(analysis|bibliography|citation|conclusion|dissertation|doi|findings|hypothesis|journal|literature|methodology|paper|proceedings|references|research|results|study|theory|thesis)\b/i
    ];
    
    // Count matches for each category
    const technicalMatches = technicalPatterns.reduce((count, pattern) => 
      count + (pattern.test(content) ? 1 : 0), 0);
      
    const scholarlyMatches = scholarlyPatterns.reduce((count, pattern) => 
      count + (pattern.test(content) ? 1 : 0), 0);
    
    // Determine content type based on strongest signal
    if (technicalMatches > scholarlyMatches && technicalMatches > 2) {
      return 'technical';
    } else if (scholarlyMatches > 2) {
      return 'scholarly';
    }
    
    return 'general';
  }
  
  /**
   * Estimate the relevance of content to a query
   */
  estimateRelevance(content: string, query: string): number {
    if (!content || !query) return 0;
    
    // Normalize content and query
    const normalizedContent = content.toLowerCase();
    const queryTerms = query.toLowerCase().split(/\s+/)
      .filter(term => term.length > 3) // Filter out short words
      .map(term => term.replace(/[.,;:?!]/g, '')); // Remove punctuation
    
    if (queryTerms.length === 0) return 0.5; // Default if no substantial query terms
    
    // Count occurrences of query terms in content
    const termMatches = queryTerms.map(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = normalizedContent.match(regex);
      return matches ? matches.length : 0;
    });
    
    // Calculate weighted score based on term frequency
    const totalMatches = termMatches.reduce((sum, count) => sum + count, 0);
    const matchRatio = totalMatches / (content.length / 100); // Matches per 100 chars
    
    // Calculate percentage of query terms found
    const termsFound = termMatches.filter(count => count > 0).length;
    const termCoverage = termsFound / queryTerms.length;
    
    // Combine factors for final relevance score (0-1)
    const relevance = Math.min(1, (matchRatio * 0.5) + (termCoverage * 0.5));
    
    return relevance;
  }
  
  /**
   * Estimate token count for a string
   * Uses a simple approximation of 4 chars per token
   */
  private estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }
}

/**
 * Factory function to create a model selection strategy
 */
export function createModelSelectionStrategy(): ModelSelectionStrategy {
  return new DefaultModelSelectionStrategy();
} 