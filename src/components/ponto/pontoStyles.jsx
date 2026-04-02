import { cn } from '@/lib/utils';

export const pontoSurface = 'rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950';
export const pontoMutedSurface = 'rounded-2xl border border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60';
export const pontoSectionTitle = 'text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100';
export const pontoSectionText = 'text-sm leading-6 text-slate-600 dark:text-slate-400';
export const pontoToolbar = 'flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:flex-row md:flex-wrap md:items-end';
export const pontoInputLabel = 'mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400';
export const pontoTabList = 'grid w-full grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-900 md:flex md:w-auto md:flex-wrap';
export const pontoTabTrigger = 'h-11 rounded-xl px-4 text-sm font-semibold text-slate-600 transition-colors data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-950 dark:data-[state=active]:text-white';

export function pontoStatCardClasses(tone = 'slate') {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60',
    emerald: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/30',
    amber: 'border-amber-200 bg-amber-50 dark:border-amber-900/70 dark:bg-amber-950/30',
    blue: 'border-blue-200 bg-blue-50 dark:border-blue-900/70 dark:bg-blue-950/30',
    red: 'border-red-200 bg-red-50 dark:border-red-900/70 dark:bg-red-950/30',
  };

  return cn('rounded-2xl border shadow-sm', tones[tone] || tones.slate);
}