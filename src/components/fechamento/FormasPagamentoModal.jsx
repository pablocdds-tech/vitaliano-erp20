import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, CreditCard, Check, X } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY = {
  nome: '', taxa_percentual: 0, regra_recebimento: 'D1',
  dia_semana_pagamento: 3, agrupa_semana: false, conta_bancaria: '', status: 'ativo'
};

const REGRAS = [
  { value: 'D0', label: 'D0 — Mesmo dia' },
  { value: 'D1', label: 'D1 — Dia seguinte' },
  { value: 'D1_util', label: 'D+1 útil' },
  { value: 'D2', label: 'D2 — 2 dias' },
  { value: 'D15', label: 'D15 — 15 dias' },
  { value: 'D30', label: 'D30 — 30 dias' },
  { value: 'semanal', label: 'Semanal (dia fixo)' },
];

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function FormasPagamentoModal({ open, onClose }) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);

  const { data: formas = [] } = useQuery({
    queryKey: ['formas-pagamento'],
    queryFn: () => base44.entities.FormaPagamento.list('nome')
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.FormaPagamento.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['formas-pagamento'] }); reset(); toast.success('Criada!'); }
  });
  const updateMut = useMutation({
    mutationFn: ({ id, d }) => base44.entities.FormaPagamento.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['formas-pagamento'] }); reset(); toast.success('Atualizada!'); }
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.FormaPagamento.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['formas-pagamento'] }); toast.success('Removida!'); }
  });

  const reset = () => { setForm(EMPTY); setEditingId(null); setShowForm(false); };

  const handleEdit = (fp) => {
    setForm({ ...EMPTY, ...fp });
    setEditingId(fp.id);
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    editingId ? updateMut.mutate({ id: editingId, d: form }) : createMut.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Formas de Pagamento
          </DialogTitle>
        </DialogHeader>

        {/* Lista */}
        <div className="space-y-2">
          {formas.map(fp => (
            <div key={fp.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div>
                <p className="font-medium text-sm text-slate-800 dark:text-white">{fp.nome}</p>
                <p className="text-xs text-slate-500">
                  Taxa: {fp.taxa_percentual || 0}% &bull; Prazo: {REGRAS.find(r => r.value === fp.regra_recebimento)?.label || fp.regra_recebimento}
                  {fp.regra_recebimento === 'semanal' && ` (${DIAS[fp.dia_semana_pagamento ?? 3]})`}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(fp)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => deleteMut.mutate(fp.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}

          {formas.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">Nenhuma forma cadastrada ainda.</p>
          )}
        </div>

        {/* Botão adicionar */}
        {!showForm && (
          <Button variant="outline" className="w-full gap-2 mt-2" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />Nova Forma de Pagamento
          </Button>
        )}

        {/* Formulário inline */}
        {showForm && (
          <form onSubmit={handleSubmit} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4 mt-2 bg-white dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{editingId ? 'Editar' : 'Nova'} Forma</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Crédito Visa, PIX, iFood" required />
              </div>
              <div className="space-y-1">
                <Label>Taxa (%)</Label>
                <Input type="number" step="0.01" min="0" max="100" value={form.taxa_percentual} onChange={e => setForm({ ...form, taxa_percentual: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label>Prazo de Recebimento</Label>
                <Select value={form.regra_recebimento} onValueChange={v => setForm({ ...form, regra_recebimento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REGRAS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.regra_recebimento === 'semanal' && (
                <div className="space-y-1">
                  <Label>Dia do pagamento</Label>
                  <Select value={String(form.dia_semana_pagamento ?? 3)} onValueChange={v => setForm({ ...form, dia_semana_pagamento: parseInt(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DIAS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label>Conta Bancária Destino</Label>
                <Input value={form.conta_bancaria} onChange={e => setForm({ ...form, conta_bancaria: e.target.value })} placeholder="Ex: Bradesco PJ" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={reset}><X className="w-4 h-4 mr-1" />Cancelar</Button>
              <Button type="submit" size="sm" disabled={createMut.isPending || updateMut.isPending}><Check className="w-4 h-4 mr-1" />Salvar</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}