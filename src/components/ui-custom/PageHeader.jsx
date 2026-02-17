import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PageHeader({ 
  title, 
  subtitle, 
  breadcrumbs = [],
  actions,
  icon: Icon
}) {
  return (
    <div className="mb-6 lg:mb-8">
      {breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-sm text-slate-500 mb-3">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight className="w-4 h-4" />}
              {crumb.href ? (
                <Link 
                  to={createPageUrl(crumb.href)}
                  className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-slate-800 dark:text-slate-200 font-medium">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
              <Icon className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </div>
          )}
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}