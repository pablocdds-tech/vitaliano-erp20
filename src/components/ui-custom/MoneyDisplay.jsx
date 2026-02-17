import React from 'react';
import { cn } from '@/lib/utils';

export function formatMoney(value, options = {}) {
  const { currency = 'BRL', showSign = false, compact = false } = options;
  
  const num = Number(value) || 0;
  
  if (compact && Math.abs(num) >= 1000000) {
    return `R$ ${(num / 1000000).toFixed(1)}M`;
  }
  if (compact && Math.abs(num) >= 1000) {
    return `R$ ${(num / 1000).toFixed(1)}K`;
  }
  
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency
  }).format(num);
  
  if (showSign && num > 0) {
    return `+${formatted}`;
  }
  
  return formatted;
}

export default function MoneyDisplay({ 
  value, 
  size = 'md',
  showSign = false,
  colorize = false,
  compact = false,
  className 
}) {
  const num = Number(value) || 0;
  
  const sizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-semibold',
    xl: 'text-2xl font-bold',
    '2xl': 'text-3xl font-bold'
  };
  
  const colorClass = colorize 
    ? num > 0 
      ? 'text-emerald-600 dark:text-emerald-400' 
      : num < 0 
        ? 'text-red-600 dark:text-red-400'
        : 'text-slate-600 dark:text-slate-400'
    : 'text-slate-800 dark:text-white';
  
  return (
    <span className={cn(sizes[size], colorClass, className)}>
      {formatMoney(value, { showSign, compact })}
    </span>
  );
}