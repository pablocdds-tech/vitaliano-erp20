import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Delete } from 'lucide-react';

export default function KioskPinPad({ funcPontos, funcionarios, onSuccess, onCancel }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const addDigit = (d) => {
    if (pin.length >= 4) return;
    const newPin = pin + d;
    setPin(newPin);
    setError('');
    
    if (newPin.length === 4) {
      // Try to match
      const match = funcPontos.find(fp => fp.pin_backup === newPin);
      if (match) {
        onSuccess(match.funcionario_id);
      } else {
        setError('PIN inválido. Tente novamente.');
        setTimeout(() => setPin(''), 1000);
      }
    }
  };

  const removeDigit = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  return (
    <div className="w-full max-w-xs mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Digite seu PIN</h2>
        <p className="text-slate-400 text-sm">PIN de 4 dígitos</p>
      </div>

      {/* PIN Display */}
      <div className="flex justify-center gap-4 mb-8">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
              pin.length > i
                ? error ? 'border-red-500 bg-red-500/20 text-red-400' : 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                : 'border-slate-600 bg-slate-800'
            }`}
          >
            {pin.length > i ? '●' : ''}
          </div>
        ))}
      </div>

      {error && <p className="text-red-400 text-center text-sm mb-4 animate-pulse">{error}</p>}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <button
            key={n}
            onClick={() => addDigit(String(n))}
            className="h-16 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white text-2xl font-bold transition-colors"
          >
            {n}
          </button>
        ))}
        <button onClick={onCancel} className="h-16 rounded-xl bg-slate-800 hover:bg-red-900/50 text-slate-400 flex items-center justify-center">
          <X className="w-6 h-6" />
        </button>
        <button onClick={() => addDigit('0')} className="h-16 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white text-2xl font-bold transition-colors">
          0
        </button>
        <button onClick={removeDigit} className="h-16 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center">
          <Delete className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}