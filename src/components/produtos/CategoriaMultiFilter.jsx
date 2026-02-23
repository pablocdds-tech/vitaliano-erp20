import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tags, ChevronDown, X } from 'lucide-react';

export default function CategoriaMultiFilter({ categorias, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (id) => {
    const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
    onChange(next);
  };

  const label = selected.length === 0
    ? 'Categorias'
    : selected.length === 1
      ? (selected[0] === '__sem__' ? 'Sem Categoria' : categorias.find(c => c.id === selected[0])?.nome || '1 selecionada')
      : `${selected.length} categorias`;

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        size="sm"
        className="h-9 text-xs gap-1.5 min-w-[140px] justify-between"
        onClick={() => setOpen(!open)}
      >
        <Tags className="w-3.5 h-3.5 text-slate-400" />
        <span className="truncate">{label}</span>
        {selected.length > 0 ? (
          <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" onClick={(e) => { e.stopPropagation(); onChange([]); }} />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        )}
      </Button>

      {open && (
        <div className="absolute z-50 mt-1 w-56 bg-white dark:bg-slate-900 border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border-b">
            <Checkbox checked={selected.includes('__sem__')} onCheckedChange={() => toggle('__sem__')} />
            <span className="text-sm italic text-slate-500">Sem Categoria</span>
          </label>
          {categorias.map(c => (
            <label key={c.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
              <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
              <span className="text-sm">{c.nome}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}