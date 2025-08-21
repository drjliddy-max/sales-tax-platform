import { ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Calculator, Menu, X, User, LogOut, HelpCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { authService } from '@/services/auth';
import { AuthUser } from '@/types';
import HelpWidget from '@/components/help/HelpWidget';

interface LayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export default function Layout({ children, showNav = true }: LayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      // Skip auth check for demo pages
      if (location.pathname.startsWith('/insights/demo') || location.pathname.startsWith('/demo')) {
        setIsAuthenticated(false);
        setUser(null);
        return;
      }

      try {
        const authenticated = await authService.isAuthenticated();
        setIsAuthenticated(authenticated);
        
        if (authenticated) {
          const userData = await authService.getUser();
          setUser(userData as AuthUser);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthenticated(false);
        setUser(null);
      }
    };

    checkAuth();
  }, [location.pathname]);

  const handleLogin = () => {
    authService.login();
  };

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
    navigate('/');
  };

  if (!showNav) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo and brand */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <Calculator className="h-8 w-8 text-brand-blue-600" />
                <span className="font-bold text-xl text-gray-900">
                  Sales Tax Insights
                </span>
              </Link>
            </div>

            {/* Desktop navigation */}
            <div className="hidden md:flex md:items-center md:space-x-8">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/dashboard"
                    className="text-gray-600 hover:text-brand-blue-600 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/transactions"
                    className="text-gray-600 hover:text-brand-blue-600 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    Transactions
                  </Link>
                  <Link
                    to="/reports"
                    className="text-gray-600 hover:text-brand-blue-600 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    Reports
                  </Link>
                  <Link
                    to="/insights"
                    className="text-gray-600 hover:text-brand-blue-600 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    Insights
                  </Link>
                  <Link
                    to="/help"
                    className="text-gray-600 hover:text-brand-blue-600 px-3 py-2 text-sm font-medium transition-colors flex items-center space-x-1"
                  >
                    <HelpCircle className="h-4 w-4" />
                    <span>Help</span>
                  </Link>
                  
                  {/* User menu */}
                  <div className="flex items-center space-x-3">
                    {user?.picture ? (
                      <img
                        src={user.picture}
                        alt={user.name || user.email}
                        className="h-8 w-8 rounded-full"
                      />
                    ) : (
                      <div className="h-8 w-8 bg-brand-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-brand-blue-600" />
                      </div>
                    )}
                    <span className="text-sm text-gray-700">
                      {user?.name || user?.email}
                    </span>
                    <button
                      onClick={handleLogout}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      title="Logout"
                    >
                      <LogOut className="h-5 w-5" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Link
                    to="/demo"
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    Demo
                  </Link>
                  <Link
                    to="/insights"
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    Business Insights
                  </Link>
                  <button
                    onClick={handleLogin}
                    className="classic-btn primary px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Login
                  </button>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-gray-600 hover:text-gray-900 focus:outline-none focus:text-gray-900"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-gray-200">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/dashboard"
                    className="block text-gray-600 hover:text-brand-blue-600 px-3 py-2 text-sm font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/transactions"
                    className="block text-gray-600 hover:text-brand-blue-600 px-3 py-2 text-sm font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Transactions
                  </Link>
                  <Link
                    to="/reports"
                    className="block text-gray-600 hover:text-brand-blue-600 px-3 py-2 text-sm font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Reports
                  </Link>
                  <Link
                    to="/insights"
                    className="block text-gray-600 hover:text-brand-blue-600 px-3 py-2 text-sm font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Insights
                  </Link>
                  <Link
                    to="/help"
                    className="block text-gray-600 hover:text-brand-blue-600 px-3 py-2 text-sm font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Help
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left text-red-600 hover:text-red-800 px-3 py-2 text-sm font-medium"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/demo"
                    className="block text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Demo
                  </Link>
                  <Link
                    to="/insights"
                    className="block text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Business Insights
                  </Link>
                  <button
                    onClick={handleLogin}
                    className="block w-full text-left classic-btn primary px-3 py-2 rounded-lg text-sm font-medium mt-2"
                  >
                    Login
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Main content */}
      <main>{children}</main>
      
      {/* Help Widget - only show when not on help pages */}
      {showNav && !location.pathname.includes('/help') && (
        <HelpWidget 
          context={{
            userRole: isAuthenticated ? (user?.email?.includes('admin') ? 'ADMIN' : 'CLIENT') : undefined,
            additionalInfo: { user }
          }}
        />
      )}
    </div>
  );
}
