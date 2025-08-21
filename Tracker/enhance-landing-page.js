const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('http://localhost:3001');
  
  // Inject CSS to enhance the landing page styling
  await page.addStyleTag({
    content: `
      /* Enhanced Landing Page Styling */
      .hero-section {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      
      .hero-section h1 {
        text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
      }
      
      .feature-card {
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        border: 1px solid #e2e8f0;
      }
      
      .feature-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
      }
      
      .cta-button {
        background: linear-gradient(45deg, #4285f4, #34a853);
        box-shadow: 0 4px 15px rgba(66, 133, 244, 0.4);
        transition: all 0.3s ease;
      }
      
      .cta-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(66, 133, 244, 0.6);
      }
      
      /* Navigation improvements */
      nav {
        backdrop-filter: blur(10px);
        background: rgba(255, 255, 255, 0.95);
      }
      
      /* Feature icons */
      .feature-icon {
        background: linear-gradient(45deg, #4285f4, #34a853);
        border-radius: 12px;
        padding: 12px;
      }
      
      /* Improved typography */
      .hero-title {
        font-weight: 800;
        letter-spacing: -0.5px;
      }
      
      .feature-title {
        font-weight: 600;
        color: #1a202c;
      }
      
      /* Add subtle animations */
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .animate-in {
        animation: fadeInUp 0.8s ease-out;
      }
      
      /* Pricing section enhancement */
      .pricing-card {
        border-radius: 16px;
        border: 2px solid transparent;
        background: linear-gradient(white, white) padding-box,
                    linear-gradient(45deg, #4285f4, #34a853) border-box;
      }
      
      /* Footer improvements */
      footer {
        background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
      }
    `
  });
  
  // Add some interactive elements
  await page.evaluate(() => {
    // Add animation classes to elements as they come into view
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, observerOptions);
    
    // Observe feature cards and other elements
    document.querySelectorAll('.relative, .space-y-10 > div').forEach(el => {
      observer.observe(el);
    });
  });
  
  console.log('Landing page styling enhanced successfully!');
  console.log('The browser will stay open so you can see the changes.');
  console.log('Close the browser when you are satisfied with the styling.');
  
  // Keep the browser open for manual inspection
  await page.waitForTimeout(60000); // Wait 60 seconds
  await browser.close();
})();