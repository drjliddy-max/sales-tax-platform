import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { authService } from '@/services/auth';
import { TenantProvider, useTenant } from '@/contexts/TenantContext';
import { TenantSelector } from '@/components/TenantSelector';
import Layout from '@/components/Layout';
import LandingPage from '@/pages/LandingPage';
import BusinessInsights from '@/pages/BusinessInsights';
import HelpCenter from '@/pages/HelpCenter';
import ContentCrawler from '@/pages/ContentCrawler';
import FirecrawlTest from '@/components/FirecrawlTest';
import { POSIntegrations } from './components';
import OnboardingDashboard from './components/OnboardingDashboard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import BulkOperations from './components/BulkOperations';
import TenantManagementDashboard from './components/TenantManagementDashboard';
import TenantMigrationDashboard from './components/TenantMigrationDashboard';
import { TenantSettings } from './components/TenantSettings';

// Auth callback component
function AuthCallback() {
  useEffect(() => {
    const handleAuth = async () => {
      try {
        await authService.handleRedirectCallback();
        window.location.replace('/dashboard');
      } catch (error) {
        console.error('Auth callback error:', error);
        window.location.replace('/');
      }
    };

    handleAuth();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}

// Multi-tenant route protection
function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode, requiredRole?: 'ADMIN' | 'CLIENT' }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [needsTenantSelection, setNeedsTenantSelection] = useState(false);
  const { tenant, isLoading: tenantLoading } = useTenant();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const isAuthenticated = await authService.isAuthenticated();
        if (!isAuthenticated) {
          window.location.href = '/';
          return;
        }

        const token = await authService.getToken();
        if (!token) {
          window.location.href = '/';
          return;
        }

        const response = await fetch('/api/auth/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        window.location.href = '/';
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  useEffect(() => {
    if (!loading && !tenantLoading && user && !tenant) {
      setNeedsTenantSelection(true);
    } else {
      setNeedsTenantSelection(false);
    }
  }, [loading, tenantLoading, user, tenant]);

  if (loading || tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue-600"></div>
      </div>
    );
  }

  if (!user || !user.isActive) {
    return <Navigate to="/" replace />;
  }

  if (needsTenantSelection) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="max-w-md w-full">
          <TenantSelector onTenantSelected={() => setNeedsTenantSelection(false)} />
        </div>
      </div>
    );
  }

  if (requiredRole && user.role !== requiredRole) {
    const redirectPath = user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}

// Client Dashboard Component
function ClientDashboard() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('clerk-db-jwt');
        const response = await fetch('/api/client/dashboard/overview', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setDashboardData(data);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Client Dashboard</h1>
      
      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">This Month's Transactions</h3>
          <p className="text-3xl font-bold text-blue-600">{dashboardData?.metrics?.totalTransactions || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Revenue</h3>
          <p className="text-3xl font-bold text-green-600">
            ${(dashboardData?.metrics?.totalRevenue || 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Tax Collected</h3>
          <p className="text-3xl font-bold text-purple-600">
            ${(dashboardData?.metrics?.totalTaxCollected || 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <a href="/transactions" className="btn-primary text-center">
            View Transactions
          </a>
          <a href="/bulk-operations" className="btn-secondary text-center">
            Bulk Operations
          </a>
          <a href="/analytics" className="btn-secondary text-center">
            Analytics Dashboard
          </a>
          <a href="/reports" className="btn-secondary text-center">
            Generate Reports
          </a>
          <a href="/insights" className="btn-secondary text-center">
            Business Insights
          </a>
          <a href="/pos" className="btn-secondary text-center">
            POS Integrations
          </a>
        </div>
      </div>

      {/* Recent Activity */}
      {dashboardData?.recentActivity && dashboardData.recentActivity.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dashboardData.recentActivity.slice(0, 5).map((transaction: any, index: number) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(transaction.transactionDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${transaction.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${transaction.taxAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.business?.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Admin Dashboard Component
function AdminDashboard() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('clerk-db-jwt');
        const response = await fetch('/api/admin/dashboard/overview', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setDashboardData(data);
        }
      } catch (error) {
        console.error('Error fetching admin dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>
      
      {/* Admin Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Active Clients</h3>
          <p className="text-3xl font-bold text-blue-600">{dashboardData?.activeClients || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Active Businesses</h3>
          <p className="text-3xl font-bold text-green-600">{dashboardData?.activeBusinesses || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">New Clients (Month)</h3>
          <p className="text-3xl font-bold text-purple-600">{dashboardData?.newClientsThisMonth || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Revenue (30 days)</h3>
          <p className="text-3xl font-bold text-orange-600">
            ${(dashboardData?.recentActivity?.totalRevenue || 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Admin Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Admin Controls</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <a href="/admin/clients" className="btn-primary text-center">
            Manage Clients
          </a>
          <a href="/admin/revenue" className="btn-secondary text-center">
            Revenue Analytics
          </a>
          <a href="/admin/system" className="btn-secondary text-center">
            System Stats
          </a>
          <a href="/admin/audit" className="btn-secondary text-center">
            Audit Logs
          </a>
        </div>
      </div>

      {/* System Health */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">System Health</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span>Database Status</span>
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
              {dashboardData?.systemHealth?.databaseStatus || 'Healthy'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>Total Users</span>
            <span className="font-semibold">{dashboardData?.systemHealth?.totalUsers || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Total Transactions</span>
            <span className="font-semibold">{dashboardData?.systemHealth?.totalTransactions || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Transactions() {
  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Transactions</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">Transaction management will be implemented here.</p>
      </div>
    </div>
  );
}

function Reports() {
  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Reports</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">Reports will be implemented here.</p>
      </div>
    </div>
  );
}


function Demo() {
  return (
    <Layout>
    <div className="max-w-7xl mx-auto py-6 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Interactive Demo</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Try Our Platform</h2>
        <p className="text-gray-600 mb-6">
          Experience our sales tax automation platform with real data and features.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-lg mb-3">Demo Features:</h3>
            <ul className="space-y-2 text-gray-600">
              <li>✓ Real-time tax calculations</li>
              <li>✓ Multi-jurisdiction support</li>
              <li>✓ POS integration examples</li>
              <li>✓ Compliance monitoring</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-3">Try Now:</h3>
            <a 
              href="/insights"
              className="btn-primary block text-center mb-3"
            >
              View Business Insights
            </a>
            <a 
              href="/pos/demo"
              className="btn-secondary block text-center mb-3"
            >
              POS Integrations Demo
            </a>
            <a 
              href="/"
              className="btn-outline block text-center"
            >
              Back to Home
            </a>
          </div>
        </div>
      </div>
    </div>
    </Layout>
  );
}

// POS Demo Component
function POSDemo() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-6 px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">POS Integration Demo</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Supported POS Systems</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600 mb-2">Square</div>
              <p className="text-gray-600">Full integration with real-time sync</p>
              <div className="mt-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ✓ Connected
                </span>
              </div>
            </div>
            
            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-600 mb-2">Shopify</div>
              <p className="text-gray-600">E-commerce & POS integration</p>
              <div className="mt-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ✓ Connected
                </span>
              </div>
            </div>
            
            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600 mb-2">Clover</div>
              <p className="text-gray-600">Restaurant & retail POS</p>
              <div className="mt-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  ⚡ Demo Mode
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Demo Features</h2>
          <div className="space-y-4">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
              <span>Real-time transaction sync from POS systems</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
              <span>Automatic tax calculation for all jurisdictions</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
              <span>Multi-location support with location-specific rates</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
              <span>Webhook processing for instant updates</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Ready to connect your POS system?
          </h3>
          <p className="text-blue-700 mb-4">
            Get started with our easy integration process and start automating your tax compliance today.
          </p>
          <div className="space-x-3">
            <a href="/demo" className="btn-primary">
              Back to Demo
            </a>
            <a href="/help" className="btn-secondary">
              Get Help
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await authService.init();
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <TenantProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/insights" element={<BusinessInsights />} />
          <Route path="/pos/demo" element={<POSDemo />} />
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/content-crawler" element={<ContentCrawler />} />
          <Route path="/test-firecrawl" element={<FirecrawlTest />} />
          <Route path="/callback" element={<AuthCallback />} />
          
          {/* Tenant selection route */}
          <Route path="/select-tenant" element={
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
              <div className="max-w-md w-full">
                <TenantSelector />
              </div>
            </div>
          } />
          
          {/* Client routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute requiredRole="CLIENT">
              <ClientDashboard />
            </ProtectedRoute>
          } />
          <Route path="/transactions" element={
            <ProtectedRoute requiredRole="CLIENT">
              <Transactions />
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute requiredRole="CLIENT">
              <Reports />
            </ProtectedRoute>
          } />
          <Route path="/pos" element={
            <ProtectedRoute requiredRole="CLIENT">
              <POSIntegrations className="max-w-7xl mx-auto py-6 px-4" />
            </ProtectedRoute>
          } />
          <Route path="/onboarding" element={
            <ProtectedRoute requiredRole="CLIENT">
              <OnboardingDashboard className="max-w-7xl mx-auto py-6 px-4" />
            </ProtectedRoute>
          } />
          <Route path="/analytics" element={
            <ProtectedRoute requiredRole="CLIENT">
              <AnalyticsDashboard className="max-w-7xl mx-auto py-6 px-4" />
            </ProtectedRoute>
          } />
          <Route path="/bulk-operations" element={
            <ProtectedRoute requiredRole="CLIENT">
              <BulkOperations className="max-w-7xl mx-auto py-6 px-4" />
            </ProtectedRoute>
          } />
          
          {/* Admin routes */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/tenants" element={
            <ProtectedRoute requiredRole="ADMIN">
              <TenantManagementDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/migration" element={
            <ProtectedRoute requiredRole="ADMIN">
              <TenantMigrationDashboard />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute requiredRole="CLIENT">
              <TenantSettings />
            </ProtectedRoute>
          } />
          <Route path="/admin/*" element={
            <ProtectedRoute requiredRole="ADMIN">
              <div className="max-w-7xl mx-auto py-6 px-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">Admin Feature</h1>
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-gray-600">Admin features will be implemented here.</p>
                </div>
              </div>
            </ProtectedRoute>
          } />
          
          {/* Fallback */}
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </Router>
    </TenantProvider>
  );
}

export default App;
