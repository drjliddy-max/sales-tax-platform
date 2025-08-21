import React, { ReactNode } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import MobileNavigation from './MobileNavigation';

interface ResponsiveLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  headerActions?: ReactNode;
  className?: string;
  userRole?: 'ADMIN' | 'CLIENT';
  userName?: string;
  onLogout?: () => void;
  hideNavigation?: boolean;
}

interface ResponsiveGridProps {
  children: ReactNode;
  columns?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

interface ResponsiveCardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
}

interface ResponsiveTableProps {
  headers: string[];
  data: any[];
  renderRow: (item: any, index: number) => ReactNode;
  onRowClick?: (item: any, index: number) => void;
  emptyMessage?: string;
  className?: string;
  mobileBreakpoint?: 'sm' | 'md' | 'lg';
}

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  title,
  subtitle,
  headerActions,
  className = '',
  userRole,
  userName,
  onLogout,
  hideNavigation = false
}) => {
  const isMobile = useMediaQuery('(max-width: 1024px)');

  return (
    <div className="min-h-screen bg-gray-50">
      {!hideNavigation && isMobile && (
        <MobileNavigation
          userRole={userRole}
          userName={userName}
          onLogout={onLogout}
        />
      )}
      
      <div className={`${isMobile ? 'pt-20' : ''} ${className}`}>
        {(title || subtitle || headerActions) && (
          <div className="mb-6 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div>
                {title && (
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="mt-1 text-sm sm:text-base text-gray-600">
                    {subtitle}
                  </p>
                )}
              </div>
              
              {headerActions && (
                <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-3">
                  {headerActions}
                </div>
              )}
            </div>
          </div>
        )}
        
        <main className="px-4 sm:px-6 lg:px-8 pb-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  columns = { sm: 1, md: 2, lg: 3, xl: 4 },
  gap = 'md',
  className = ''
}) => {
  const gapClasses = {
    sm: 'gap-3',
    md: 'gap-4 sm:gap-6',
    lg: 'gap-6 sm:gap-8',
    xl: 'gap-8 sm:gap-10'
  };

  const gridClasses = `
    grid
    grid-cols-${columns.sm || 1}
    ${columns.md ? `md:grid-cols-${columns.md}` : ''}
    ${columns.lg ? `lg:grid-cols-${columns.lg}` : ''}
    ${columns.xl ? `xl:grid-cols-${columns.xl}` : ''}
    ${gapClasses[gap]}
    ${className}
  `;

  return (
    <div className={gridClasses}>
      {children}
    </div>
  );
};

export const ResponsiveCard: React.FC<ResponsiveCardProps> = ({
  children,
  title,
  subtitle,
  actions,
  className = '',
  padding = 'md',
  shadow = 'md'
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-6',
    lg: 'p-6 sm:p-8'
  };

  const shadowClasses = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow',
    lg: 'shadow-lg'
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${shadowClasses[shadow]} ${className}`}>
      {(title || subtitle || actions) && (
        <div className={`border-b border-gray-200 ${paddingClasses[padding]} pb-4`}>
          <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div>
              {title && (
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="mt-1 text-sm text-gray-600">
                  {subtitle}
                </p>
              )}
            </div>
            
            {actions && (
              <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                {actions}
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className={paddingClasses[padding]}>
        {children}
      </div>
    </div>
  );
};

export const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  headers,
  data,
  renderRow,
  onRowClick,
  emptyMessage = 'No data available',
  className = '',
  mobileBreakpoint = 'md'
}) => {
  const isMobile = useMediaQuery(`(max-width: ${mobileBreakpoint === 'sm' ? '640px' : mobileBreakpoint === 'md' ? '768px' : '1024px'})`);

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm">{emptyMessage}</p>
      </div>
    );
  }

  if (isMobile) {
    // Mobile card layout
    return (
      <div className={`space-y-3 ${className}`}>
        {data.map((item, index) => (
          <div
            key={index}
            onClick={() => onRowClick?.(item, index)}
            className={`bg-white border border-gray-200 rounded-lg p-4 ${
              onRowClick ? 'cursor-pointer hover:bg-gray-50 active:bg-gray-100' : ''
            } transition-colors touch-manipulation`}
          >
            {renderRow(item, index)}
          </div>
        ))}
      </div>
    );
  }

  // Desktop table layout
  return (
    <div className={`overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item, index) => (
              <tr
                key={index}
                onClick={() => onRowClick?.(item, index)}
                className={`${
                  onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''
                } transition-colors`}
              >
                {renderRow(item, index)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Mobile-optimized button components
interface ResponsiveButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export const ResponsiveButton: React.FC<ResponsiveButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  onClick,
  className = '',
  type = 'button'
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 touch-manipulation';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500 disabled:bg-gray-300',
    outline: 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500 disabled:text-gray-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300'
  };
  
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm min-h-[36px]',
    md: 'px-4 py-2 text-sm sm:text-base min-h-[40px] sm:min-h-[44px]',
    lg: 'px-6 py-3 text-base sm:text-lg min-h-[44px] sm:min-h-[48px]'
  };

  const widthClasses = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${widthClasses}
        ${className}
      `}
    >
      {loading && (
        <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      
      {icon && iconPosition === 'left' && !loading && (
        <span className="mr-2">{icon}</span>
      )}
      
      {children}
      
      {icon && iconPosition === 'right' && !loading && (
        <span className="ml-2">{icon}</span>
      )}
    </button>
  );
};

export default ResponsiveLayout;
