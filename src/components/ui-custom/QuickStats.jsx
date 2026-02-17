import React from 'react';
import { cn } from '@/lib/utils';

export default function QuickStats({ items, className }) {
  return (
    <div className={cn('flex items-center gap-6 overflow-x-auto pb-2', className)}>
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-3 min-w-fit">
          {item.icon && (
            <div className={cn('p-2 rounded-lg', item.iconBg || 'bg-slate-100 dark:bg-slate-800')}>
              <item.icon className={cn('w-4 h-4', item.iconColor || 'text-slate-500')} />
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className="text-lg font-semibold text-slate-800 dark:text-white">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}