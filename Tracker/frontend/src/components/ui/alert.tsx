import React from 'react';

interface AlertProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({ children, className = '' }) => (
  <div className={`rounded-lg border border-gray-200 p-4 ${className}`}>
    {children}
  </div>
);

export const AlertTitle: React.FC<AlertTitleProps> = ({ children, className = '' }) => (
  <div className={`font-medium text-sm mb-1 ${className}`}>
    {children}
  </div>
);

export const AlertDescription: React.FC<AlertDescriptionProps> = ({ children, className = '' }) => (
  <div className={`text-sm text-gray-600 ${className}`}>
    {children}
  </div>
);
