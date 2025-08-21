import React, { useState, useRef, useEffect } from 'react';
import { 
  Menu, 
  X, 
  Home, 
  BarChart3, 
  FileText, 
  Settings, 
  HelpCircle, 
  User,
  LogOut,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  href?: string;
  children?: NavItem[];
  badge?: string;
}

interface MobileNavigationProps {
  userRole?: 'ADMIN' | 'CLIENT';
  userName?: string;
  onLogout?: () => void;
}

const navigationItems: Record<string, NavItem[]> = {
  CLIENT: [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      href: '/dashboard'
    },
    {
      id: 'transactions',
      label: 'Transactions',
      icon: FileText,
      href: '/transactions'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      href: '/analytics'
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: FileText,
      children: [
        { id: 'generate-reports', label: 'Generate Reports', icon: FileText, href: '/reports' },
        { id: 'report-history', label: 'Report History', icon: FileText, href: '/reports/history' }
      ]
    },
    {
      id: 'integrations',
      label: 'Integrations',
      icon: Settings,
      children: [
        { id: 'pos-integrations', label: 'POS Systems', icon: Settings, href: '/pos' },
        { id: 'api-settings', label: 'API Settings', icon: Settings, href: '/settings/api' }
      ]
    },
    {
      id: 'onboarding',
      label: 'Getting Started',
      icon: HelpCircle,
      href: '/onboarding',
      badge: 'New'
    }
  ],
  ADMIN: [
    {
      id: 'admin-dashboard',
      label: 'Admin Dashboard',
      icon: Home,
      href: '/admin/dashboard'
    },
    {
      id: 'clients',
      label: 'Manage Clients',
      icon: User,
      href: '/admin/clients'
    },
    {
      id: 'system',
      label: 'System',
      icon: Settings,
      children: [
        { id: 'system-stats', label: 'System Stats', icon: BarChart3, href: '/admin/system' },
        { id: 'audit-logs', label: 'Audit Logs', icon: FileText, href: '/admin/audit' }
      ]
    }
  ]
};

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  userRole = 'CLIENT',
  userName = 'User',
  onLogout
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const location = useLocation();
  const navRef = useRef<HTMLDivElement>(null);
  
  const items = navigationItems[userRole] || [];

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const isActive = (href: string) => {
    return location.pathname === href;
  };

  const isParentActive = (item: NavItem) => {
    if (item.href && isActive(item.href)) return true;
    if (item.children) {
      return item.children.some(child => child.href && isActive(child.href));
    }
    return false;
  };

  const renderNavItem = (item: NavItem, depth = 0) => {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    const active = item.href ? isActive(item.href) : isParentActive(item);

    const baseClasses = `
      flex items-center justify-between w-full px-4 py-3 text-left rounded-lg
      transition-colors duration-200 touch-manipulation
      ${depth > 0 ? 'ml-4 pl-8' : ''}
      ${active 
        ? 'bg-blue-100 text-blue-700 font-medium' 
        : 'text-gray-700 hover:bg-gray-100'
      }
    `;

    const content = (
      <>
        <div className="flex items-center">
          <Icon className="w-5 h-5 mr-3" />
          <span className="font-medium">{item.label}</span>
          {item.badge && (
            <span className="ml-2 px-2 py-0.5 text-xs font-medium text-white bg-blue-500 rounded-full">
              {item.badge}
            </span>
          )}
        </div>
        {hasChildren && (
          <div className="ml-2">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </div>
        )}
      </>
    );

    return (
      <div key={item.id}>
        {item.href && !hasChildren ? (
          <Link to={item.href} className={baseClasses}>
            {content}
          </Link>
        ) : (
          <button
            onClick={() => hasChildren && toggleExpanded(item.id)}
            className={baseClasses}
          >
            {content}
          </button>
        )}
        
        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {item.children!.map(child => renderNavItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-center w-12 h-12 bg-white rounded-lg shadow-lg border border-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50 transition-opacity" />
      )}

      {/* Slide-out Navigation */}
      <div
        ref={navRef}
        className={`
          lg:hidden fixed left-0 top-0 bottom-0 z-50 w-80 bg-white shadow-xl transform transition-transform duration-300 ease-in-out overflow-y-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Sales Tax Tracker</h2>
            <p className="text-sm text-gray-600">{userRole} Dashboard</p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">{userName}</p>
              <p className="text-xs text-gray-500">{userRole.toLowerCase()} account</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="px-4 py-6 space-y-2">
          {items.map(item => renderNavItem(item))}
        </nav>

        {/* Footer Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
          <div className="space-y-2">
            <Link
              to="/help"
              className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <HelpCircle className="w-5 h-5 mr-3" />
              <span>Help & Support</span>
            </Link>
            
            <button
              onClick={onLogout}
              className="flex items-center w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileNavigation;
