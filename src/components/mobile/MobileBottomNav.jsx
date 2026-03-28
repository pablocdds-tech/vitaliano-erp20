import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, CreditCard, TrendingUp, Wallet, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: Home, label: 'Início', path: '/Dashboard' },
  { icon: CreditCard, label: 'A Pagar', path: '/ContasPagar' },
  { icon: TrendingUp, label: 'Vendas', path: '/Vendas' },
  { icon: Wallet, label: 'A Receber', path: '/ContasReceber' },
  { icon: Menu, label: 'Menu', path: null }
];

export default function MobileBottomNav({ currentPage, onMenuClick }) {
  const location = useLocation();

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg z-30 safe-area-bottom">
      <div className="grid grid-cols-5 gap-0.5 px-1 py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.path && location.pathname === item.path;
          
          if (!item.path) {
            return (
              <button
                key={item.label}
                onClick={onMenuClick}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-colors',
                  'text-slate-500 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-800'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] leading-tight">{item.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.label}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-colors',
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-800'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className={cn("text-[10px] leading-tight", isActive && "font-semibold")}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}