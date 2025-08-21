// Script to populate help categories with real Firecrawl articles
import fetch from 'node-fetch';
import fs from 'fs';

const FIRECRAWL_API_KEY = 'fc-5384a3da92064921a48599dda5b5edcb';
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/scrape';

// Category-specific URLs for real, published articles
const categoryUrls = {
  'getting-started': [
    'https://blog.taxjar.com/sales-tax-guide/',
    'https://www.avalara.com/learn/guides/sales-tax-basics/',
    'https://smallbusiness.chron.com/how-to-collect-sales-tax-for-small-business',
  ],
  'transactions': [
    'https://blog.taxjar.com/transaction-management/',
    'https://www.avalara.com/learn/guides/transaction-management/',
    'https://smallbusiness.chron.com/track-sales-transactions',
  ],
  'tax-rates': [
    'https://blog.taxjar.com/sales-tax-rates-2024/',
    'https://www.avalara.com/learn/guides/tax-rates/',
    'https://www.salestaxinstitute.com/resources/rates',
  ],
  'reports': [
    'https://blog.taxjar.com/sales-tax-reporting/',
    'https://www.avalara.com/learn/guides/tax-reporting/',
    'https://smallbusiness.chron.com/generate-tax-reports',
  ],
  'integrations': [
    'https://developer.squareup.com/blog/articles/sales-tax-integration',
    'https://help.shopify.com/en/manual/taxes',
    'https://blog.taxjar.com/pos-integration-guide/',
  ],
  'troubleshooting': [
    'https://blog.taxjar.com/troubleshooting-sales-tax/',
    'https://www.avalara.com/learn/guides/troubleshooting/',
    'https://smallbusiness.chron.com/fix-tax-calculation-errors',
  ],
  'account-management': [
    'https://blog.taxjar.com/account-setup-best-practices/',
    'https://www.avalara.com/learn/guides/account-setup/',
    'https://smallbusiness.chron.com/manage-business-tax-accounts',
  ]
};

async function crawlArticle(url) {
  console.log(`🔍 Crawling: ${url}`);
  
  try {
    const response = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url: url,
        formats: ['markdown'],
        includeTags: ['article', 'main', '.content', '.post', 'h1', 'h2', 'h3', 'p'],
        excludeTags: ['nav', 'footer', 'header', 'script', '.sidebar', '.ads', '.comments'],
      }),
    });

    if (response.ok) {
      const result = await response.json();
      
      if (result && result.data && result.data.markdown) {
        const title = result.data.metadata?.title || extractTitleFromContent(result.data.markdown) || 'Help Article';
        const description = result.data.metadata?.description || extractDescription(result.data.markdown) || 'Helpful guidance and information.';
        
        console.log(`✅ Successfully crawled: ${title}`);
        
        return {
          url,
          title: cleanTitle(title),
          content: cleanMarkdownContent(result.data.markdown).substring(0, 2000),
          description: description.substring(0, 300),
          source: extractSourceName(url),
          metadata: {
            author: result.data.metadata?.author || 'Expert Author',
            publishDate: result.data.metadata?.publishedTime || 'Recently published',
            readingTime: estimateReadingTime(result.data.markdown),
            tags: extractTags(result.data.markdown)
          },
          timestamp: new Date().toISOString()
        };
      }
    } else {
      console.error(`❌ HTTP ${response.status} for ${url}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Failed to crawl ${url}:`, error.message);
    return null;
  }
}

async function populateCategory(categoryId, urls) {
  console.log(`\n📂 Processing category: ${categoryId.toUpperCase()}`);
  const articles = [];
  
  for (const url of urls) {
    const article = await crawlArticle(url);
    if (article) {
      articles.push(article);
    }
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`📊 Category ${categoryId}: ${articles.length}/${urls.length} articles crawled successfully\n`);
  return articles;
}

async function populateAllCategories() {
  console.log('🔥 Starting Firecrawl population of help articles...\n');
  
  const allArticles = {};
  
  for (const [categoryId, urls] of Object.entries(categoryUrls)) {
    const articles = await populateCategory(categoryId, urls);
    allArticles[categoryId] = articles;
  }
  
  // Save results to JSON file
  const outputPath = './crawled-help-articles.json';
  fs.writeFileSync(outputPath, JSON.stringify(allArticles, null, 2));
  
  console.log(`\n✅ All categories processed! Results saved to: ${outputPath}`);
  console.log('\n📊 Summary:');
  
  for (const [categoryId, articles] of Object.entries(allArticles)) {
    console.log(`- ${categoryId}: ${articles.length} articles`);
  }
  
  return allArticles;
}

// Helper functions
function extractTitleFromContent(markdown) {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  return titleMatch ? titleMatch[1].trim() : null;
}

function extractDescription(markdown) {
  const lines = markdown.split('\n');
  let foundTitle = false;
  
  for (const line of lines) {
    if (line.startsWith('#')) {
      foundTitle = true;
      continue;
    }
    if (foundTitle && line.trim() && !line.startsWith('#') && !line.startsWith('*') && !line.startsWith('-')) {
      return line.trim();
    }
  }
  return 'Helpful guidance and information.';
}

function cleanMarkdownContent(markdown) {
  return markdown
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Convert links to plain text
    .replace(/#+\s*/g, '') // Remove heading markers
    .replace(/\*{1,2}([^\*]+)\*{1,2}/g, '$1') // Remove bold/italic
    .replace(/`([^`]+)`/g, '$1') // Remove code markers
    .trim();
}

function cleanTitle(title) {
  return title
    .replace(/^\d+\.\s*/, '') // Remove leading numbers
    .replace(/\s*\|\s*.+$/, '') // Remove site names after pipe
    .replace(/\s*-\s*.+$/, '') // Remove site names after dash
    .trim();
}

function extractSourceName(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '').replace('blog.', '');
    return domain.charAt(0).toUpperCase() + domain.slice(1).replace(/\.(com|org|net)$/, '');
  } catch {
    return 'Expert Source';
  }
}

function estimateReadingTime(content) {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return `${minutes} min read`;
}

function extractTags(content) {
  const tags = [];
  const keywords = ['tax', 'sales', 'business', 'compliance', 'integration', 'reporting'];
  
  keywords.forEach(keyword => {
    if (content.toLowerCase().includes(keyword)) {
      tags.push(keyword);
    }
  });
  
  return tags.length > 0 ? tags : ['general'];
}

// Run the population script
populateAllCategories().catch(console.error);

export { populateAllCategories, categoryUrls };