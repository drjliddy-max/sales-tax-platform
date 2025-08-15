import { ClerkProvider } from '@clerk/clerk-react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import BusinessSetup from './pages/BusinessSetup'
import TransactionEntry from './pages/TransactionEntry'
import DashboardLayout from './layouts/DashboardLayout'

// Import your Clerk publishable key
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_aHVtYW5lLW1hc3RvZG9uLTc1LmNsZXJrLmFjY291bnRzLmRldiQ'

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

// Placeholder components for other routes
const Transactions = () => <div className="p-8"><h2 className="text-2xl font-bold">Transactions</h2><p>Transaction management coming soon...</p></div>
const Reports = () => <div className="p-8"><h2 className="text-2xl font-bold">Tax Reports</h2><p>Report generation coming soon...</p></div>
const Integrations = () => <div className="p-8"><h2 className="text-2xl font-bold">Integrations</h2><p>POS and accounting integrations coming soon...</p></div>
const Settings = () => <div className="p-8"><h2 className="text-2xl font-bold">Settings</h2><p>Account settings coming soon...</p></div>

function App() {
  return (
    <ClerkProvider 
      publishableKey={CLERK_PUBLISHABLE_KEY}
      afterSignOutUrl="/"
    >
      <BrowserRouter>
        <div className="App">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            
            {/* Protected dashboard routes */}
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="/dashboard/transactions" element={<Navigate to="/transactions" replace />} />
            </Route>
            
            <Route path="/transactions" element={<DashboardLayout />}>
              <Route index element={<Transactions />} />
            </Route>
            
            <Route path="/reports" element={<DashboardLayout />}>
              <Route index element={<Reports />} />
            </Route>
            
            <Route path="/integrations" element={<DashboardLayout />}>
              <Route index element={<Integrations />} />
            </Route>
            
            <Route path="/business-setup" element={<DashboardLayout />}>
              <Route index element={<BusinessSetup />} />
            </Route>
            
            <Route path="/transaction-entry" element={<DashboardLayout />}>
              <Route index element={<TransactionEntry />} />
            </Route>
            
            <Route path="/settings" element={<DashboardLayout />}>
              <Route index element={<Settings />} />
            </Route>

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ClerkProvider>
  )
}

export default App
