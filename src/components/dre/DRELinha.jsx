import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import MoneyDisplay from '@/components/ui-custom/MoneyDisplay';

export function DRELinha({ label, valor, totalReceita, indent = false, destaque = false, tipo, collapsible, expanded, onToggle, children }) {
  const pct = totalReceita > 0 ? ((Math.abs(valor) / totalReceita) * 100).toFixed(1) : '0.0';
  const cor = tipo === 'receita' ? 'text-emerald-600 dark:text-emerald-400'
    : tipo === 'despesa' ? 'text-red-600 dark:text-red-400'
    : 'text-slate-800 dark:text-white';

  return (
    <>
      <div
        className={`flex items-center justify-between py-2
          ${indent ? 'pl-6' : ''}
          ${destaque ? 'border-t-2 border-slate-200 dark:border-slate-700 mt-1 pt-3' : 'border-b border-slate-100 dark:border-slate-800'}
          ${collapsible ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-md px-1' : ''}
        `}
        onClick={collapsible ? onToggle : undefined}
      >
        <div className="flex items-center gap-2">
          {collapsible && (expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />)}
          {!collapsible && indent && <ChevronRight className="w-3 h-3 text-slate-400" />}
          <span className={`text-sm ${destaque ? 'font-bold' : indent ? 'text-slate-600 dark:text-slate-400' : 'font-medium text-slate-800 dark:text-white'}`}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {!destaque && totalReceita > 0 && (
            <span className="text-xs text-slate-400 w-12 text-right">{pct}%</span>
          )}
          {destaque && totalReceita > 0 && (
            <span className={`text-xs font-semibold w-12 text-right ${cor}`}>{pct}%</span>
          )}
          <div className={`w-28 text-right ${destaque ? 'text-base font-bold ' + cor : ''}`}>
            {destaque
              ? <MoneyDisplay value={valor} size="md" colorize />
              : <MoneyDisplay value={valor} size="sm" colorize />}
          </div>
        </div>
      </div>
      {collapsible && expanded && children && (
        <div className="bg-slate-50/50 dark:bg-slate-800/20 rounded-md mb-1">
          {children}
        </div>
      )}
    </>
  );
}

export function DRESecao({ titulo }) {
  return (
    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-6 mb-2 px-1">{titulo}</p>
  );
}

export function DREResultado({ label, valor, margem }) {
  const positivo = valor >= 0;
  return (
    <div className={`mt-6 p-4 rounded-xl ${positivo ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
      <div className="flex items-center justify-between">
        <span className="text-base font-bold text-slate-800 dark:text-white">{label}</span>
        <MoneyDisplay value={valor} size="xl" colorize />
      </div>
      {margem !== undefined && (
        <p className={`text-xs mt-1 ${positivo ? 'text-emerald-600' : 'text-red-600'}`}>
          Margem: {margem.toFixed(2)}%
        </p>
      )}
    </div>
  );
}