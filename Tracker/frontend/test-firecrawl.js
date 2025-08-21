// Quick test of Firecrawl API integration
console.log('Testing Firecrawl API...');

const testFirecrawl = async () => {
  const apiKey = 'fc-5384a3da92064921a48599dda5b5edcb';
  const testUrl = 'https://blog.taxjar.com/sales-tax-guide/';
  
  try {
    console.log(`🔍 Testing scrape of: ${testUrl}`);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: testUrl,
        formats: ['markdown'],
        includeTags: ['article', 'main', '.content', '.post', 'h1', 'h2', 'h3', 'p'],
        excludeTags: ['nav', 'footer', 'header', 'script', '.sidebar', '.ads', '.comments'],
      }),
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ API Test Result:');
      console.log('- Success:', result.success);
      console.log('- Title:', result.data?.metadata?.title);
      console.log('- Content length:', result.data?.markdown?.length);
      console.log('- First 200 chars:', result.data?.markdown?.substring(0, 200));
    } else {
      console.error('❌ API Error:', response.status, await response.text());
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Run in Node.js
if (typeof window === 'undefined' && typeof require !== 'undefined') {
  const fetch = require('node-fetch');
  testFirecrawl();
}