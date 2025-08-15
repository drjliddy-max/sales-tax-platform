import { SignIn, SignUp, useUser } from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'
import { useState } from 'react'

export default function Landing() {
  const { isSignedIn, user } = useUser()
  const [showSignUp, setShowSignUp] = useState(false)

  // Redirect to dashboard if already signed in
  if (isSignedIn) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Sales Tax Platform</h1>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowSignUp(false)}
                className={`px-4 py-2 rounded-md ${!showSignUp ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Sign In
              </button>
              <button
                onClick={() => setShowSignUp(true)}
                className={`px-4 py-2 rounded-md ${showSignUp ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Column - Marketing Content */}
          <div>
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Automate Your Sales Tax Compliance
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Streamline tax collection, calculation, and reporting for your business. 
              Integrate with your POS system and never worry about tax compliance again.
            </p>
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-gray-700">Multi-jurisdiction tax calculations</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-gray-700">Real-time POS integration</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-gray-700">Automated compliance reports</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-gray-700">Audit trail and documentation</span>
              </div>
            </div>
          </div>

          {/* Right Column - Authentication */}
          <div className="bg-white rounded-lg shadow-xl p-8">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-semibold text-gray-900">
                {showSignUp ? 'Create Account' : 'Welcome Back'}
              </h3>
              <p className="text-gray-600 mt-2">
                {showSignUp 
                  ? 'Start managing your sales tax today' 
                  : 'Sign in to your account'
                }
              </p>
            </div>
            
            <div className="clerk-auth-container">
              {showSignUp ? (
                <SignUp 
                  routing="hash"
                  signInUrl="#/sign-in"
                  afterSignUpUrl="/dashboard"
                  appearance={{
                    elements: {
                      formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white",
                      card: "shadow-none border-0"
                    }
                  }}
                />
              ) : (
                <SignIn 
                  routing="hash"
                  signUpUrl="#/sign-up"
                  afterSignInUrl="/dashboard"
                  appearance={{
                    elements: {
                      formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white",
                      card: "shadow-none border-0"
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              Everything You Need for Tax Compliance
            </h3>
            <p className="text-xl text-gray-600">
              Built for businesses of all sizes, from startups to enterprises
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">Real-time Analytics</h4>
              <p className="text-gray-600">
                Monitor your tax obligations with live dashboards and detailed reports
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔗</span>
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">POS Integration</h4>
              <p className="text-gray-600">
                Connect with Square, Shopify, Clover, and other popular systems
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚡</span>
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">Automated Filing</h4>
              <p className="text-gray-600">
                Generate and file tax returns automatically across all jurisdictions
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}