import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const TIPOS = [
  { value: 'deposito', label: 'Depósito', icon: ArrowDownToLine, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  { value: 'saque', label: 'Saque', icon: ArrowUpFromLine, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  { value: 'transferencia', label: 'Transferência', icon: ArrowRightLeft, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
];

export default function OperacaoContaModal({ open, onClose, contas }) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState('deposito');
  const [form, setForm] = useState({ conta_origem_id: '', conta_destino_id: '', valor: '', data: new Date().toISOString().split('T')[0], descricao: '' });

  const mutation = useMutation({
    mutationFn: async (data) => {
      const today = data.data;
      if (data.tipo === 'transferencia') {
        // Debita da origem
        await base44.entities.TransacaoBancaria.create({
          conta_bancaria_id: data.conta_origem_id,
          tipo: 'debito',
          valor: parseFloat(data.valor),
          data: today,
          descricao: `Transferência para ${contas.find(c => c.id === data.conta_destino_id)?.nome || ''}${data.descricao ? ' — ' + data.descricao : ''}`,
          status: 'conciliado',
          categoria: 'transferencia'
        });
        // Credita no destino
        await base44.entities.TransacaoBancaria.create({
          conta_bancaria_id: data.conta_destino_id,
          tipo: 'credito',
          valor: parseFloat(data.valor),
          data: today,
          descricao: `Transferência de ${contas.find(c => c.id === data.conta_origem_id)?.nome || ''}${data.descricao ? ' — ' + data.descricao : ''}`,
          status: 'conciliado',
          categoria: 'transferencia'
        });
      } else {
        await base44.entities.TransacaoBancaria.create({
          conta_bancaria_id: data.conta_origem_id,
          tipo: data.tipo === 'deposito' ? 'credito' : 'debito',
          valor: parseFloat(data.valor),
          data: today,
          descricao: data.descricao || (data.tipo === 'deposito' ? 'Depósito' : 'Saque'),
          status: 'conciliado',
          categoria: data.tipo
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transacoesBancarias'] });
      toast.success('Operação registrada!');
      handleClose();
    },
    onError: () => toast.error('Erro ao registrar operação')
  });

  const handleClose = () => {
    setForm({ conta_origem_id: '', conta_destino_id: '', valor: '', data: new Date().toISOString().split('T')[0], descricao: '' });
    setTipo('deposito');
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.conta_origem_id || !form.valor) return;
    if (tipo === 'transferencia' && !form.conta_destino_id) return;
    if (tipo === 'transferencia' && form.conta_origem_id === form.conta_destino_id) {
      toast.error('Origem e destino devem ser diferentes');
      return;
    }
    mutation.mutate({ ...form, tipo });
  };

  const tipoAtual = TIPOS.find(t => t.value === tipo);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-[95vw]">
        <DialogHeader>
          <DialogTitle>Nova Operação</DialogTitle>
        </DialogHeader>

        {/* Seletor de tipo */}
        <div className="grid grid-cols-3 gap-2">
          {TIPOS.map(t => {
            const Icon = t.icon;
            const active = tipo === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-sm font-medium
                  ${active ? `${t.bg} ${t.color} border-current` : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              >
                <Icon className="w-5 h-5" />
                {t.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>{tipo === 'transferencia' ? 'Conta Origem *' : 'Conta *'}</Label>
            <Select value={form.conta_origem_id} onValueChange={v => setForm({ ...form, conta_origem_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
              <SelectContent>
                {contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome} — {c.banco}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {tipo === 'transferencia' && (
            <div className="space-y-2">
              <Label>Conta Destino *</Label>
              <Select value={form.conta_destino_id} onValueChange={v => setForm({ ...form, conta_destino_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta destino..." /></SelectTrigger>
                <SelectContent>
                  {contas.filter(c => c.id !== form.conta_origem_id).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome} — {c.banco}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor *</Label>
              <Input type="number" step="0.01" min="0.01" placeholder="0,00" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea rows={2} placeholder="Observação opcional..." value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending} className={`gap-2 ${tipoAtual?.value === 'saque' ? 'bg-red-600 hover:bg-red-700' : tipoAtual?.value === 'transferencia' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}>
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Confirmar {tipoAtual?.label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}