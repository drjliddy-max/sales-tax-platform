import React, { useState } from 'react';
import { useTenant, useTenantRole } from '@/contexts/TenantContext';
import { TenantSelectorModal } from '@/components/TenantSelector';
import { authService } from '@/services/auth';

interface TenantAwareNavigationProps {
  className?: string;
}

export function TenantAwareNavigation({ className = '' }: TenantAwareNavigationProps) {
  const { tenant } = useTenant();
  const { userRole, isAdmin } = useTenantRole();
  const [showTenantSelector, setShowTenantSelector] = useState(false);

  const handleLogout = async () => {
    await authService.logout();
  };

  if (!tenant) {
    return null;
  }

  return (
    <>
      <nav className={`bg-white shadow-sm border-b border-gray-200 ${className}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Left side - Logo and main nav */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-900">Sales Tax Tracker</h1>
              </div>
              <div className="hidden md:ml-6 md:flex md:space-x-8">
                <a
                  href="/dashboard"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Dashboard
                </a>
                <a
                  href="/transactions"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Transactions
                </a>
                <a
                  href="/reports"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Reports
                </a>
                {isAdmin && (
                  <a
                    href="/admin/dashboard"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Admin
                  </a>
                )}
              </div>
            </div>

            {/* Right side - Tenant selector and user menu */}
            <div className="flex items-center space-x-4">
              {/* Tenant selector */}
              <div className="relative">
                <button
                  onClick={() => setShowTenantSelector(true)}
                  className="flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-md transition-colors"
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{tenant.name}</span>
                    <span className="text-xs text-gray-500 capitalize">{userRole}</span>
                  </div>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                  </svg>
                </button>
              </div>

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div className="md:hidden">
          <div className="pt-2 pb-3 space-y-1">
            <a
              href="/dashboard"
              className="bg-blue-50 border-blue-500 text-blue-700 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
            >
              Dashboard
            </a>
            <a
              href="/transactions"
              className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
            >
              Transactions
            </a>
            <a
              href="/reports"
              className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
            >
              Reports
            </a>
            {isAdmin && (
              <a
                href="/admin/dashboard"
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
              >
                Admin
              </a>
            )}
          </div>
        </div>
      </nav>

      <TenantSelectorModal
        isOpen={showTenantSelector}
        onClose={() => setShowTenantSelector(false)}
      />
    </>
  );
}