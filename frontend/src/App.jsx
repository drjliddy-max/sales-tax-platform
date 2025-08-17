import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
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

function App() {
  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<SalesTaxBotLanding />} />
          
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
          
          {/* Redirect unsigned users to sign-in */}
          <Route
            path="*"
            element={
              <SignedOut>
                <RedirectToSignIn />
              </SignedOut>
            }
          />
        </Routes>
      </Router>
    </ClerkProvider>
  )
}

export default App
