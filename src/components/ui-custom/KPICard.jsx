import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function KPICard({ 
  title, 
  value, 
  subtitle,
  trend,
  trendValue,
  icon: Icon,
  variant = 'default',
  loading = false
}) {
  const variants = {
    default: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    success: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    danger: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
  };

  const iconColors = {
    default: 'text-slate-500 bg-slate-100 dark:bg-slate-700',
    success: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50',
    warning: 'text-amber-600 bg-amber-100 dark:bg-amber-900/50',
    danger: 'text-red-600 bg-red-100 dark:bg-red-900/50',
    info: 'text-blue-600 bg-blue-100 dark:bg-blue-900/50'
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-slate-500';

  if (loading) {
    return (
      <div className={cn('rounded-2xl border p-5 animate-pulse', variants.default)}>
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <div className="h-4 bg-slate-200 rounded w-24" />
            <div className="h-8 bg-slate-200 rounded w-32" />
            <div className="h-3 bg-slate-200 rounded w-20" />
          </div>
          <div className="w-10 h-10 bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-2xl border p-5 transition-all duration-200 hover:shadow-lg hover:scale-[1.02]',
      variants[variant]
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          {(subtitle || trendValue) && (
            <div className="flex items-center gap-2 mt-1">
              {trendValue && (
                <span className={cn('flex items-center gap-0.5 text-xs font-medium', trendColor)}>
                  <TrendIcon className="w-3 h-3" />
                  {trendValue}
                </span>
              )}
              {subtitle && (
                <span className="text-xs text-slate-500">{subtitle}</span>
              )}
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn('p-2.5 rounded-xl', iconColors[variant])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}