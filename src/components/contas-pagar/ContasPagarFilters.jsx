import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendente', label: 'Pendentes' },
  { value: 'vencido', label: 'Vencidas' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'pago', label: 'Pagas' },
];

export default function ContasPagarFilters({ search, onSearchChange, statusFilter, onStatusChange }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Buscar por descrição, credor..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-9 h-9 bg-white dark:bg-slate-900"
        />
        {search && (
          <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {STATUS_OPTIONS.map(opt => (
          <Button
            key={opt.value}
            variant={statusFilter === opt.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => onStatusChange(opt.value)}
            className="whitespace-nowrap text-xs h-9"
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}