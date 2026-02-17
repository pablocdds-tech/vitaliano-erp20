import React from 'react';

export default function Logo({ size = 'md', showText = true }) {
  const sizes = {
    sm: { icon: 24, text: 'text-sm' },
    md: { icon: 32, text: 'text-lg' },
    lg: { icon: 40, text: 'text-xl' }
  };

  const { icon, text } = sizes[size];

  return (
    <div className="flex items-center gap-2">
      <div 
        className="relative flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg"
        style={{ width: icon, height: icon }}
      >
        <span className="text-white font-bold" style={{ fontSize: icon * 0.4 }}>V</span>
        <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full" />
      </div>
      {showText && (
        <span className={`font-semibold tracking-tight text-slate-800 dark:text-white ${text}`}>
          Vitaliano
        </span>
      )}
    </div>
  );
}