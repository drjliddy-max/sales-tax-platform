import { useState, useEffect, useCallback } from 'react';
import { HelpArticle, HelpCategory } from '@/types';
import { helpContentService } from '@/services/HelpContentService';
import { helpCategories } from '@/data/helpContent';

interface UseHelpContentReturn {
  articles: HelpArticle[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refreshArticles: (categoryId: string, limit?: number) => Promise<void>;
  searchArticles: (query: string, categoryFilter?: string) => Promise<HelpArticle[]>;
  getTrendingArticles: (limit?: number) => Promise<HelpArticle[]>;
  isConfigured: boolean;
  configStatus: string;
}

export function useHelpContent(): UseHelpContentReturn {
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Get configuration status
  const configStatus = helpContentService.getConfigurationStatus();

  // Load cached articles on mount
  useEffect(() => {
    loadCachedArticles();
  }, []);

  const loadCachedArticles = () => {
    try {
      const cached = localStorage.getItem('help-articles-cache');
      if (cached) {
        const parsedData = JSON.parse(cached);
        setArticles(parsedData.articles || []);
        setLastUpdated(new Date(parsedData.timestamp));
      }
    } catch (err) {
      console.error('Failed to load cached help articles:', err);
    }
  };

  const saveCachedArticles = (newArticles: HelpArticle[]) => {
    try {
      const cacheData = {
        articles: newArticles,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem('help-articles-cache', JSON.stringify(cacheData));
    } catch (err) {
      console.error('Failed to cache help articles:', err);
    }
  };

  const refreshArticles = useCallback(async (categoryId: string, limit: number = 5) => {
    setLoading(true);
    setError(null);

    try {
      // Find the category
      const category = helpCategories.find(cat => cat.id === categoryId);
      if (!category) {
        throw new Error(`Category not found: ${categoryId}`);
      }

      // Crawl articles for the category
      const crawledArticles = await helpContentService.crawlCategoryArticles(categoryId, limit);
      
      // Convert to help article format
      const newArticles = helpContentService.convertToHelpArticles(crawledArticles, category);
      
      // Update articles (merge with existing or replace category-specific articles)
      setArticles(prevArticles => {
        // Remove existing articles from this category
        const filteredArticles = prevArticles.filter(article => article.category.id !== categoryId);
        // Add new articles
        const updatedArticles = [...filteredArticles, ...newArticles];
        
        // Save to cache
        saveCachedArticles(updatedArticles);
        
        return updatedArticles;
      });

      setLastUpdated(new Date());

    } catch (err: any) {
      setError(err.message || 'Failed to refresh articles');
      console.error('Error refreshing help articles:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchArticles = useCallback(async (query: string, categoryFilter?: string): Promise<HelpArticle[]> => {
    setLoading(true);
    setError(null);

    try {
      const crawledResults = await helpContentService.searchAllCategories(query, categoryFilter);
      
      // Convert results to help articles
      const searchResults: HelpArticle[] = [];
      
      for (const crawledArticle of crawledResults) {
        const category = helpCategories.find(cat => cat.id === crawledArticle.category);
        if (category) {
          const helpArticles = helpContentService.convertToHelpArticles([crawledArticle], category);
          searchResults.push(...helpArticles);
        }
      }

      return searchResults;

    } catch (err: any) {
      setError(err.message || 'Failed to search articles');
      console.error('Error searching help articles:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getTrendingArticles = useCallback(async (limit: number = 8): Promise<HelpArticle[]> => {
    setLoading(true);
    setError(null);

    try {
      const crawledTrending = await helpContentService.getTrendingArticles(limit);
      
      // Convert to help articles
      const trendingResults: HelpArticle[] = [];
      
      for (const crawledArticle of crawledTrending) {
        const category = helpCategories.find(cat => cat.id === crawledArticle.category);
        if (category) {
          const helpArticles = helpContentService.convertToHelpArticles([crawledArticle], category);
          trendingResults.push(...helpArticles);
        }
      }

      return trendingResults;

    } catch (err: any) {
      setError(err.message || 'Failed to get trending articles');
      console.error('Error getting trending articles:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    articles,
    loading,
    error,
    lastUpdated,
    refreshArticles,
    searchArticles,
    getTrendingArticles,
    isConfigured: configStatus.configured,
    configStatus: configStatus.message
  };
}