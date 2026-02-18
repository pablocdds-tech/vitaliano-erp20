import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Home, ShoppingBag, BarChart3, Settings, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: Home, label: 'Início', href: 'Dashboard' },
  { icon: ShoppingBag, label: 'PDV', href: 'PDVMobile' },
  { icon: BarChart3, label: 'Relatórios', href: 'Relatorios' },
  { icon: Settings, label: 'Mais', href: null }
];

export default function MobileBottomNav({ currentPage, onMenuClick }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-30">
      <div className="grid grid-cols-4 gap-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.href;
          
          if (!item.href) {
            return (
              <button
                key={item.label}
                onClick={onMenuClick}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg transition-colors',
                  'text-slate-600 dark:text-slate-400',
                  'hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs truncate">{item.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.label}
              to={createPageUrl(item.href)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg transition-colors',
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}