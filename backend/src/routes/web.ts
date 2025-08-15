import { Router, Request, Response } from 'express';
import path from 'path';

const router = Router();

// Serve the main landing page
router.get('/', (req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sales Tax Insights - Automated Tax Compliance & Revenue Analytics</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
    <style>
        /* Classic Button Styles */
        .classic-btn {
            cursor: pointer;
            border: none;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: 500;
            transition: all 0.15s ease-in-out;
            user-select: none;
            position: relative;
            overflow: hidden;
        }
        
        .classic-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .classic-btn:focus {
            outline: none;
        }
        
        .classic-btn.primary {
            background-color: #2563eb;
            color: white;
            border: 2px solid #2563eb;
        }
        
        .classic-btn.primary:hover:not(:disabled) {
            background-color: #1d4ed8;
            border-color: #1d4ed8;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
        
        .classic-btn.primary:active:not(:disabled) {
            background-color: #1e40af;
            border-color: #1e40af;
            transform: translateY(0);
            box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
        }
        
        .classic-btn.secondary {
            background-color: white;
            color: #2563eb;
            border: 2px solid #2563eb;
        }
        
        .classic-btn.secondary:hover:not(:disabled) {
            background-color: #eff6ff;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
        }
        
        .classic-btn.secondary:active:not(:disabled) {
            background-color: #dbeafe;
            transform: translateY(0);
            box-shadow: 0 2px 4px rgba(37, 99, 235, 0.15);
        }
        
        /* Button press animation */
        .classic-btn::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            transition: width 0.6s, height 0.6s;
        }
        
        .classic-btn:active::before {
            width: 300px;
            height: 300px;
        }
    </style>
</head>
<body class="bg-gray-50 min-h-screen">
    <!-- Navigation -->
    <nav class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16 items-center">
                <div class="flex items-center">
                    <i data-lucide="calculator" class="h-8 w-8 text-blue-600 mr-3"></i>
                    <span class="font-bold text-xl text-gray-900">Sales Tax Insights</span>
                </div>
                <div class="flex items-center space-x-4">
                    <button onclick="window.location.href='/login'" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition duration-150 ease-in-out">Login</button>
                    <button onclick="window.location.href='/signup'" class="classic-btn primary bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:bg-blue-800 text-sm font-medium transition duration-150 ease-in-out">Get Started</button>
                </div>
            </div>
        </div>
    </nav>

    <!-- Hero Section -->
    <div class="relative overflow-hidden bg-white">
        <div class="max-w-7xl mx-auto">
            <div class="relative z-10 pb-8 bg-white sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
                <main class="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
                    <div class="sm:text-center lg:text-left">
                        <h1 class="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                            <span class="block xl:inline">Automate Your</span>
                            <span class="block text-blue-600 xl:inline">Sales Tax & Revenue</span>
                        </h1>
                        <p class="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                            The only platform that combines automated sales tax compliance with AI-powered revenue insights. 
                            Built for SMBs who want to focus on growing their business, not managing taxes.
                        </p>
                        <div class="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                            <div class="rounded-md shadow">
                                <button onclick="window.location.href='/demo'" class="classic-btn primary w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:bg-blue-800 transition duration-150 ease-in-out md:py-4 md:text-lg md:px-10">
                                    Try Demo
                                </button>
                            </div>
                            <div class="mt-3 sm:mt-0 sm:ml-3">
                                <button onclick="window.location.href='/insights/demo'" class="classic-btn secondary w-full flex items-center justify-center px-8 py-3 border border-blue-600 text-base font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:bg-blue-100 transition duration-150 ease-in-out md:py-4 md:text-lg md:px-10">
                                    See Insights
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    </div>

    <!-- Features Section -->
    <div class="py-12 bg-gray-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="lg:text-center">
                <h2 class="text-base text-blue-600 font-semibold tracking-wide uppercase">Features</h2>
                <p class="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                    Everything you need to automate your business
                </p>
            </div>

            <div class="mt-10">
                <div class="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
                    <div class="relative">
                        <div class="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                            <i data-lucide="shield-check" class="h-6 w-6"></i>
                        </div>
                        <p class="ml-16 text-lg leading-6 font-medium text-gray-900">Automated Tax Compliance</p>
                        <p class="mt-2 ml-16 text-base text-gray-500">
                            Real-time tax calculations, rate updates, and compliance monitoring. Never worry about tax accuracy again.
                        </p>
                    </div>

                    <div class="relative">
                        <div class="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                            <i data-lucide="trending-up" class="h-6 w-6"></i>
                        </div>
                        <p class="ml-16 text-lg leading-6 font-medium text-gray-900">AI Revenue Insights</p>
                        <p class="mt-2 ml-16 text-base text-gray-500">
                            Get actionable recommendations to increase revenue, optimize pricing, and improve customer retention.
                        </p>
                    </div>

                    <div class="relative">
                        <div class="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                            <i data-lucide="zap" class="h-6 w-6"></i>
                        </div>
                        <p class="ml-16 text-lg leading-6 font-medium text-gray-900">POS Integration</p>
                        <p class="mt-2 ml-16 text-base text-gray-500">
                            Seamlessly connects with Square, Shopify, Clover, and 50+ other POS systems.
                        </p>
                    </div>

                    <div class="relative">
                        <div class="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                            <i data-lucide="bar-chart" class="h-6 w-6"></i>
                        </div>
                        <p class="ml-16 text-lg leading-6 font-medium text-gray-900">Real-time Analytics</p>
                        <p class="mt-2 ml-16 text-base text-gray-500">
                            Track revenue, customer behavior, and business performance with enterprise-grade analytics.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- CTA Section -->
    <div class="bg-blue-700">
        <div class="max-w-2xl mx-auto text-center py-16 px-4 sm:py-20 sm:px-6 lg:px-8">
            <h2 class="text-3xl font-extrabold text-white sm:text-4xl">
                <span class="block">Ready to automate your business?</span>
            </h2>
            <p class="mt-4 text-lg leading-6 text-blue-200">
                Join thousands of SMBs who've automated their tax compliance and boosted revenue with our insights.
            </p>
            <button onclick="window.location.href='/signup'" class="classic-btn primary mt-8 w-full inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:bg-blue-100 transition duration-150 ease-in-out sm:w-auto">
                Start Free Trial
            </button>
        </div>
    </div>

    <!-- Footer -->
    <footer class="bg-gray-800">
        <div class="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div class="flex justify-center space-x-6">
                <a href="/about" class="text-gray-400 hover:text-gray-300">About</a>
                <a href="/pricing" class="text-gray-400 hover:text-gray-300">Pricing</a>
                <a href="/contact" class="text-gray-400 hover:text-gray-300">Contact</a>
                <a href="/api/health" class="text-gray-400 hover:text-gray-300">API Status</a>
            </div>
            <div class="mt-8">
                <p class="text-center text-base text-gray-400">
                    &copy; 2025 Sales Tax Insights. Built for SMBs who want to focus on growth.
                </p>
            </div>
        </div>
    </footer>

    <script>
        // Initialize Lucide icons
        lucide.createIcons();
        
        // Add smooth scrolling
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelector(this.getAttribute('href')).scrollIntoView({
                    behavior: 'smooth'
                });
            });
        });
    </script>
</body>
</html>
  `);
});

// Login page
router.get('/login', (req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Sales Tax Insights</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">
    <div class="max-w-md w-full space-y-8">
        <div>
            <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Sign in to your account
            </h2>
        </div>
        <form class="mt-8 space-y-6" action="/api/auth/login" method="POST">
            <div class="space-y-4">
                <div>
                    <label for="email" class="sr-only">Email address</label>
                    <input id="email" name="email" type="email" required class="relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="Email address">
                </div>
                <div>
                    <label for="password" class="sr-only">Password</label>
                    <input id="password" name="password" type="password" required class="relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="Password">
                </div>
            </div>
            <div>
                <button type="submit" class="classic-btn primary group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 active:bg-blue-800 transition duration-150 ease-in-out">
                    Sign in
                </button>
            </div>
            <div class="text-center">
                <a href="/demo" class="font-medium text-blue-600 hover:text-blue-500">
                    Try Demo Instead
                </a>
            </div>
        </form>
    </div>
</body>
</html>
  `);
});

// Demo insights page
router.get('/insights/demo', (req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Demo Insights - Sales Tax Insights</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
</head>
<body class="bg-gray-50 min-h-screen">
    <nav class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16 items-center">
                <div class="flex items-center">
                    <a href="/" class="flex items-center">
                        <i data-lucide="calculator" class="h-8 w-8 text-blue-600 mr-3"></i>
                        <span class="font-bold text-xl text-gray-900">Sales Tax Insights</span>
                    </a>
                </div>
                <div class="flex items-center space-x-4">
                    <span class="text-sm text-gray-500">Demo Mode</span>
                    <a href="/login" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Login</a>
                </div>
            </div>
        </div>
    </nav>

    <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div class="px-4 py-6 sm:px-0">
            <h1 class="text-3xl font-bold text-gray-900 mb-6">Demo Business Insights</h1>
            
            <!-- Loading State -->
            <div id="loading" class="text-center py-8">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p class="mt-4 text-gray-600">Generating insights for demo business...</p>
            </div>

            <!-- Insights Container -->
            <div id="insights-container" class="hidden space-y-6">
                <!-- Insights will be loaded here -->
            </div>
        </div>
    </div>

    <script>
        lucide.createIcons();

        // Simulate loading and fetch insights
        setTimeout(() => {
            fetchDemoInsights();
        }, 1500);

        async function fetchDemoInsights() {
            try {
                const response = await fetch('/api/insights-simple/generate/507f1f77bcf86cd799439011', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                
                if (data.success && data.data && data.data.insights) {
                    displayInsights(data.data.insights);
                } else {
                    showError('Failed to generate insights');
                }
            } catch (error) {
                showError('Error fetching insights: ' + error.message);
            }
        }

        function displayInsights(insights) {
            const container = document.getElementById('insights-container');
            const loading = document.getElementById('loading');
            
            loading.classList.add('hidden');
            container.classList.remove('hidden');
            
            insights.forEach(insight => {
                const impactColors = {
                    high: 'bg-red-100 text-red-800',
                    medium: 'bg-yellow-100 text-yellow-800',
                    low: 'bg-green-100 text-green-800'
                };

                const insightCard = \`
                    <div class="bg-white overflow-hidden shadow rounded-lg">
                        <div class="p-6">
                            <div class="flex items-center justify-between">
                                <h3 class="text-lg font-medium text-gray-900">\${insight.title}</h3>
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium \${impactColors[insight.impact]}">
                                    \${insight.impact.toUpperCase()} IMPACT
                                </span>
                            </div>
                            <p class="mt-2 text-sm text-gray-600">\${insight.insight}</p>
                            
                            <div class="mt-4 grid grid-cols-2 gap-4">
                                <div class="text-sm">
                                    <span class="font-medium text-gray-900">Est. Value:</span>
                                    <span class="text-green-600">$\${(insight.estimated_revenue_impact || insight.estimated_savings || 0).toLocaleString()}</span>
                                </div>
                                <div class="text-sm">
                                    <span class="font-medium text-gray-900">Confidence:</span>
                                    <span class="text-blue-600">\${Math.round((insight.confidence_score || 0.5) * 100)}%</span>
                                </div>
                            </div>

                            \${insight.actionable_steps ? \`
                            <div class="mt-4">
                                <h4 class="text-sm font-medium text-gray-900">Action Steps:</h4>
                                <ul class="mt-2 list-disc list-inside text-sm text-gray-600 space-y-1">
                                    \${insight.actionable_steps.map(step => \`<li>\${step}</li>\`).join('')}
                                </ul>
                            </div>
                            \` : ''}
                        </div>
                    </div>
                \`;
                
                container.insertAdjacentHTML('beforeend', insightCard);
            });
        }

        function showError(message) {
            const container = document.getElementById('insights-container');
            const loading = document.getElementById('loading');
            
            loading.classList.add('hidden');
            container.innerHTML = \`
                <div class="bg-red-50 border border-red-200 rounded-md p-4">
                    <div class="flex">
                        <div class="ml-3">
                            <h3 class="text-sm font-medium text-red-800">Error</h3>
                            <p class="mt-2 text-sm text-red-700">\${message}</p>
                            <button onclick="location.reload()" class="mt-3 bg-red-800 text-white px-3 py-1 rounded text-sm hover:bg-red-900">
                                Try Again
                            </button>
                        </div>
                    </div>
                </div>
            \`;
            container.classList.remove('hidden');
        }
    </script>
</body>
</html>
  `);
});


// Get Started page
router.get('/signup', (req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Get Started - Sales Tax Insights</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
    <style>
        .classic-btn {
            cursor: pointer;
            border: none;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: 500;
            transition: all 0.15s ease-in-out;
            user-select: none;
            position: relative;
            overflow: hidden;
        }
        
        .classic-btn.primary {
            background-color: #2563eb;
            color: white;
            border: 2px solid #2563eb;
        }
        
        .classic-btn.primary:hover:not(:disabled) {
            background-color: #1d4ed8;
            border-color: #1d4ed8;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
        
        .classic-btn.secondary {
            background-color: white;
            color: #2563eb;
            border: 2px solid #2563eb;
        }
        
        .classic-btn.secondary:hover:not(:disabled) {
            background-color: #eff6ff;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
        }
    </style>
</head>
<body class="bg-gray-50 min-h-screen">
    <!-- Navigation -->
    <nav class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16 items-center">
                <div class="flex items-center">
                    <a href="/" class="flex items-center">
                        <i data-lucide="calculator" class="h-8 w-8 text-blue-600 mr-3"></i>
                        <span class="font-bold text-xl text-gray-900">Sales Tax Insights</span>
                    </a>
                </div>
                <div class="flex items-center space-x-4">
                    <button onclick="window.location.href='/'" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Home</button>
                    <button onclick="window.location.href='/login'" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Login</button>
                </div>
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <div class="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div class="text-center">
            <h1 class="text-4xl font-bold text-gray-900 mb-6">Get Started</h1>
            <div class="mb-8">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    Accessed via "Get Started" button
                </span>
            </div>
            
        <div class="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 class="text-2xl font-semibold mb-4">Get Started with Sales Tax Insights</h2>
          <p class="text-gray-600 mb-6">Set up your automated sales tax compliance in minutes.</p>
          <div class="space-y-6 text-left max-w-2xl mx-auto">
            <div class="flex items-start space-x-4">
              <div class="bg-blue-100 rounded-full p-2 mt-1">
                <span class="text-blue-600 font-bold">1</span>
              </div>
              <div>
                <h3 class="font-semibold">Create Your Account</h3>
                <p class="text-gray-600">Sign up with your business information</p>
              </div>
            </div>
            <div class="flex items-start space-x-4">
              <div class="bg-blue-100 rounded-full p-2 mt-1">
                <span class="text-blue-600 font-bold">2</span>
              </div>
              <div>
                <h3 class="font-semibold">Connect Your POS</h3>
                <p class="text-gray-600">Integrate with Square, Shopify, or 50+ other systems</p>
              </div>
            </div>
            <div class="flex items-start space-x-4">
              <div class="bg-blue-100 rounded-full p-2 mt-1">
                <span class="text-blue-600 font-bold">3</span>
              </div>
              <div>
                <h3 class="font-semibold">Automate Compliance</h3>
                <p class="text-gray-600">Let our system handle tax calculations and reporting</p>
              </div>
            </div>
            <div class="text-center pt-6">
              <button onclick="window.location.href='/signup'" class="classic-btn primary px-8 py-3 rounded-lg mr-4">
                Create Account
              </button>
              <button onclick="window.location.href='/'" class="classic-btn secondary px-6 py-3 rounded-lg">
                Back to Home
              </button>
            </div>
          </div>
        </div>
        </div>
    </div>

    <!-- Footer -->
    <footer class="bg-gray-800 mt-auto">
        <div class="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div class="text-center">
                <p class="text-gray-400">© 2025 Sales Tax Insights. Built for SMBs.</p>
            </div>
        </div>
    </footer>

    <script>
        lucide.createIcons();
    </script>
</body>
</html>`);
});


// Try Demo page
router.get('/demo', (req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interactive Demo - Sales Tax Insights</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
    <style>
        .classic-btn {
            cursor: pointer;
            border: none;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: 500;
            transition: all 0.15s ease-in-out;
            user-select: none;
            position: relative;
            overflow: hidden;
        }
        
        .classic-btn.primary {
            background-color: #2563eb;
            color: white;
            border: 2px solid #2563eb;
        }
        
        .classic-btn.primary:hover:not(:disabled) {
            background-color: #1d4ed8;
            border-color: #1d4ed8;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
        
        .classic-btn.secondary {
            background-color: white;
            color: #2563eb;
            border: 2px solid #2563eb;
        }
        
        .classic-btn.secondary:hover:not(:disabled) {
            background-color: #eff6ff;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
        }
    </style>
</head>
<body class="bg-gray-50 min-h-screen">
    <!-- Navigation -->
    <nav class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16 items-center">
                <div class="flex items-center">
                    <a href="/" class="flex items-center">
                        <i data-lucide="calculator" class="h-8 w-8 text-blue-600 mr-3"></i>
                        <span class="font-bold text-xl text-gray-900">Sales Tax Insights</span>
                    </a>
                </div>
                <div class="flex items-center space-x-4">
                    <button onclick="window.location.href='/'" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Home</button>
                    <button onclick="window.location.href='/login'" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Login</button>
                </div>
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <div class="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div class="text-center">
            <h1 class="text-4xl font-bold text-gray-900 mb-6">Interactive Demo</h1>
            <div class="mb-8">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    Accessed via "Try Demo" button
                </span>
            </div>
            
        <div class="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 class="text-2xl font-semibold mb-4">Interactive Demo</h2>
          <p class="text-gray-600 mb-6">Experience our sales tax automation platform with real data and features.</p>
          <div class="grid md:grid-cols-2 gap-6">
            <div class="text-left">
              <h3 class="font-semibold text-lg mb-3">Demo Features:</h3>
              <ul class="space-y-2 text-gray-600">
                <li>✓ Real-time tax calculations</li>
                <li>✓ Multi-jurisdiction support</li>
                <li>✓ POS integration examples</li>
                <li>✓ Compliance monitoring</li>
              </ul>
            </div>
            <div class="text-left">
              <h3 class="font-semibold text-lg mb-3">Try Now:</h3>
              <button onclick="window.location.href='/insights/demo'" class="classic-btn primary px-6 py-3 rounded-lg mb-3">
                View Business Insights
              </button>
              <button onclick="window.location.href='/'" class="classic-btn secondary px-6 py-3 rounded-lg block">
                Back to Home
              </button>
            </div>
          </div>
        </div>
        </div>
    </div>

    <!-- Footer -->
    <footer class="bg-gray-800 mt-auto">
        <div class="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div class="text-center">
                <p class="text-gray-400">© 2025 Sales Tax Insights. Built for SMBs.</p>
            </div>
        </div>
    </footer>

    <script>
        lucide.createIcons();
    </script>
</body>
</html>`);
});


// Start Free Trial page
router.get('/signup', (req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Start Your Free Trial - Sales Tax Insights</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
    <style>
        .classic-btn {
            cursor: pointer;
            border: none;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: 500;
            transition: all 0.15s ease-in-out;
            user-select: none;
            position: relative;
            overflow: hidden;
        }
        
        .classic-btn.primary {
            background-color: #2563eb;
            color: white;
            border: 2px solid #2563eb;
        }
        
        .classic-btn.primary:hover:not(:disabled) {
            background-color: #1d4ed8;
            border-color: #1d4ed8;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
        
        .classic-btn.secondary {
            background-color: white;
            color: #2563eb;
            border: 2px solid #2563eb;
        }
        
        .classic-btn.secondary:hover:not(:disabled) {
            background-color: #eff6ff;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
        }
    </style>
</head>
<body class="bg-gray-50 min-h-screen">
    <!-- Navigation -->
    <nav class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16 items-center">
                <div class="flex items-center">
                    <a href="/" class="flex items-center">
                        <i data-lucide="calculator" class="h-8 w-8 text-blue-600 mr-3"></i>
                        <span class="font-bold text-xl text-gray-900">Sales Tax Insights</span>
                    </a>
                </div>
                <div class="flex items-center space-x-4">
                    <button onclick="window.location.href='/'" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Home</button>
                    <button onclick="window.location.href='/login'" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Login</button>
                </div>
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <div class="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div class="text-center">
            <h1 class="text-4xl font-bold text-gray-900 mb-6">Start Your Free Trial</h1>
            <div class="mb-8">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    Accessed via "Start Free Trial" button
                </span>
            </div>
            
        <div class="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 class="text-2xl font-semibold mb-4">Start Your Free Trial</h2>
          <p class="text-gray-600 mb-6">Get full access to all features for 30 days, no credit card required.</p>
          <div class="bg-blue-50 rounded-lg p-6 mb-6">
            <h3 class="font-semibold text-lg mb-3">What's Included:</h3>
            <div class="grid md:grid-cols-2 gap-4 text-left">
              <ul class="space-y-2 text-gray-700">
                <li>✓ Unlimited transactions</li>
                <li>✓ All POS integrations</li>
                <li>✓ Multi-state compliance</li>
                <li>✓ Real-time reporting</li>
              </ul>
              <ul class="space-y-2 text-gray-700">
                <li>✓ AI-powered insights</li>
                <li>✓ Automated filing</li>
                <li>✓ Expert support</li>
                <li>✓ Mobile app access</li>
              </ul>
            </div>
          </div>
          <div class="text-center">
            <button onclick="window.location.href='/signup'" class="classic-btn primary px-8 py-4 rounded-lg text-lg mr-4">
              Start Free Trial
            </button>
            <button onclick="window.location.href='/'" class="classic-btn secondary px-6 py-3 rounded-lg">
              Back to Home
            </button>
          </div>
        </div>
        </div>
    </div>

    <!-- Footer -->
    <footer class="bg-gray-800 mt-auto">
        <div class="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div class="text-center">
                <p class="text-gray-400">© 2025 Sales Tax Insights. Built for SMBs.</p>
            </div>
        </div>
    </footer>

    <script>
        lucide.createIcons();
    </script>
</body>
</html>`);
});

export default router;