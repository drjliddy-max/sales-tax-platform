import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  TrendingUp, 
  Zap, 
  BarChart, 
  CheckCircle 
} from 'lucide-react';
import Layout from '@/components/Layout';

export default function LandingPage() {
  return (
    <Layout>
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="relative z-10 pb-8 bg-white sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
            <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
              <div className="sm:text-center lg:text-left">
                <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                  <span className="block xl:inline">Automate Your</span>{' '}
                  <span className="block text-brand-blue-600 xl:inline">
                    Sales Tax & Revenue
                  </span>
                </h1>
                <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                  The only platform that combines automated sales tax compliance with AI-powered 
                  revenue insights. Built for SMBs who want to focus on growing their business, 
                  not managing taxes.
                </p>
                <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                  <div className="rounded-md shadow">
                    <Link
                      to="/demo"
                      className="classic-btn primary w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-brand-blue-600 hover:bg-brand-blue-700 md:py-4 md:text-lg md:px-10"
                    >
                      Try Demo
                    </Link>
                  </div>
                  <div className="mt-3 sm:mt-0 sm:ml-3">
                    <Link
                      to="/insights/demo"
                      className="classic-btn secondary w-full flex items-center justify-center px-8 py-3 border border-brand-blue-600 text-base font-medium rounded-md text-brand-blue-700 bg-white hover:bg-blue-50 md:py-4 md:text-lg md:px-10"
                    >
                      See Insights
                    </Link>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-brand-blue-600 font-semibold tracking-wide uppercase">
              Features
            </h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to automate your business
            </p>
          </div>

          <div className="mt-10">
            <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
              {/* Feature 1: Automated Tax Compliance */}
              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-brand-blue-500 text-white">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                  Automated Tax Compliance
                </p>
                <p className="mt-2 ml-16 text-base text-gray-500">
                  Real-time tax calculations, rate updates, and compliance monitoring. 
                  Never worry about tax accuracy again.
                </p>
              </div>

              {/* Feature 2: AI Revenue Insights */}
              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-brand-blue-500 text-white">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                  AI Revenue Insights
                </p>
                <p className="mt-2 ml-16 text-base text-gray-500">
                  Get actionable recommendations to increase revenue, optimize pricing, 
                  and improve customer retention.
                </p>
              </div>

              {/* Feature 3: POS Integration */}
              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-brand-blue-500 text-white">
                  <Zap className="h-6 w-6" />
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                  POS Integration
                </p>
                <p className="mt-2 ml-16 text-base text-gray-500">
                  Seamlessly connects with Square, Shopify, Clover, and 50+ other POS systems.
                </p>
              </div>

              {/* Feature 4: Real-time Analytics */}
              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-brand-blue-500 text-white">
                  <BarChart className="h-6 w-6" />
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                  Real-time Analytics
                </p>
                <p className="mt-2 ml-16 text-base text-gray-500">
                  Track revenue, customer behavior, and business performance with 
                  enterprise-grade analytics.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-gray-900 mb-2">$45,678</div>
              <div className="text-gray-600">Average Monthly Sales Tracked</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900 mb-2">99.9%</div>
              <div className="text-gray-600">Tax Calculation Accuracy</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900 mb-2">156</div>
              <div className="text-gray-600">Transactions Processed Daily</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600">
              Choose the plan that fits your business size and needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Starter Plan */}
            <div className="bg-white p-8 rounded-xl border border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Starter</h3>
              <div className="text-3xl font-bold text-gray-900 mb-4">
                $29<span className="text-lg text-gray-500">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  Up to 1,000 transactions/month
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  Basic reporting
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  Email support
                </li>
              </ul>
              <Link to="/demo" className="w-full bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors block text-center">
                Start Free Trial
              </Link>
            </div>

            {/* Professional Plan */}
            <div className="bg-brand-blue-600 text-white p-8 rounded-xl relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Professional</h3>
              <div className="text-3xl font-bold mb-4">
                $99<span className="text-lg text-blue-200">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-blue-200 mr-3" />
                  Up to 10,000 transactions/month
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-blue-200 mr-3" />
                  Advanced reporting & analytics
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-blue-200 mr-3" />
                  Priority support
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-blue-200 mr-3" />
                  API access
                </li>
              </ul>
              <Link to="/demo" className="w-full bg-white text-brand-blue-600 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors block text-center">
                Start Free Trial
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-white p-8 rounded-xl border border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Enterprise</h3>
              <div className="text-3xl font-bold text-gray-900 mb-4">Custom</div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  Unlimited transactions
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  Custom integrations
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  Dedicated support
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  SLA guarantee
                </li>
              </ul>
              <Link to="/help" className="w-full bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors block text-center">
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-brand-blue-700">
        <div className="max-w-2xl mx-auto text-center py-16 px-4 sm:py-20 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            <span className="block">Ready to automate your business?</span>
          </h2>
          <p className="mt-4 text-lg leading-6 text-blue-200">
            Join thousands of SMBs who've automated their tax compliance and boosted 
            revenue with our insights.
          </p>
          <Link 
            to="/demo"
            className="classic-btn primary mt-8 w-full inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-brand-blue-600 bg-white hover:bg-blue-50 sm:w-auto"
          >
            Start Free Trial
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center space-x-6">
            <a href="/about" className="text-gray-400 hover:text-gray-300">About</a>
            <a href="/pricing" className="text-gray-400 hover:text-gray-300">Pricing</a>
            <a href="/contact" className="text-gray-400 hover:text-gray-300">Contact</a>
            <a href="/api/health" className="text-gray-400 hover:text-gray-300">API Status</a>
          </div>
          <div className="mt-8">
            <p className="text-center text-base text-gray-400">
              © 2025 Sales Tax Insights. Built for SMBs who want to focus on growth.
            </p>
          </div>
        </div>
      </footer>
    </Layout>
  );
}
