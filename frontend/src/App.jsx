import { ClerkProvider, SignedIn, SignedOut, useUser } from '@clerk/clerk-react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from './layouts/DashboardLayout'
import SalesTaxBotLanding from './components/SalesTaxBotLanding'
import Dashboard from './pages/Dashboard'
import BusinessSetup from './pages/BusinessSetup'
import TransactionEntry from './pages/TransactionEntry'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPubKey) {
  throw new Error("Missing Publishable Key")
}

// Component to handle home route logic
function HomeRoute() {
  const { isSignedIn } = useUser()
  
  // If user is signed in, redirect to dashboard
  if (isSignedIn) {
    return <Navigate to="/dashboard" replace />
  }
  
  // If not signed in, show landing page
  return <SalesTaxBotLanding />
}

function App() {
  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomeRoute />} />
          <Route path="/landing" element={<SalesTaxBotLanding />} />
          
          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <SignedIn>
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              </SignedIn>
            }
          />
          <Route
            path="/business-setup"
            element={
              <SignedIn>
                <DashboardLayout>
                  <BusinessSetup />
                </DashboardLayout>
              </SignedIn>
            }
          />
          <Route
            path="/transaction-entry"
            element={
              <SignedIn>
                <DashboardLayout>
                  <TransactionEntry />
                </DashboardLayout>
              </SignedIn>
            }
          />
        </Routes>
      </Router>
    </ClerkProvider>
  )
}

export default App
