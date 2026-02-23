import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';

// Tipos de operação disponíveis
const TIPOS = [
  { value: 'deposito',      label: 'Depósito',       icon: ArrowDownToLine, color: 'text-green-600', bg: 'bg-green-50 border-green-300', desc: 'Entrada de dinheiro na conta bancária' },
  { value: 'saque',         label: 'Saque',           icon: ArrowUpFromLine, color: 'text-red-600',   bg: 'bg-red-50 border-red-300',     desc: 'Retirada de dinheiro da conta bancária' },
  { value: 'transferencia', label: 'Transferência',   icon: ArrowRightLeft,  color: 'text-blue-600',  bg: 'bg-blue-50 border-blue-300',   desc: 'Entre contas do mesmo CNPJ' },
  { value: 'trans_cofre',   label: 'Transf. via Cofre', icon: ArrowRightLeft, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-300', desc: 'Saca de uma conta, deposita em cofre e depois em outra conta (CNPJs diferentes)' },
];

export default function OperacaoContaModal({ open, onClose, contas, cofres }) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState('deposito');
  const [form, setForm] = useState({
    conta_origem_id: '',
    conta_destino_id: '',
    cofre_intermediario_id: '',
    cofre_id: '',   // para saque/depósito vinculado a cofre
    valor: '',
    data: new Date().toISOString().split('T')[0],
    descricao: ''
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      const valor = parseFloat(data.valor);
      const today = data.data;

      if (tipo === 'transferencia') {
        // Simples: débito na origem, crédito no destino
        const nomeOrigem = contas.find(c => c.id === data.conta_origem_id)?.nome || '';
        const nomeDestino = contas.find(c => c.id === data.conta_destino_id)?.nome || '';
        await base44.entities.TransacaoBancaria.create({
          conta_bancaria_id: data.conta_origem_id, tipo: 'debito', valor, data: today,
          descricao: `Transferência para ${nomeDestino}${data.descricao ? ' — ' + data.descricao : ''}`,
          status: 'conciliado', categoria: 'transferencia'
        });
        await base44.entities.TransacaoBancaria.create({
          conta_bancaria_id: data.conta_destino_id, tipo: 'credito', valor, data: today,
          descricao: `Transferência de ${nomeOrigem}${data.descricao ? ' — ' + data.descricao : ''}`,
          status: 'conciliado', categoria: 'transferencia'
        });

      } else if (tipo === 'trans_cofre') {
        // Transferência via cofre intermediário (CNPJs diferentes)
        const nomeOrigem = contas.find(c => c.id === data.conta_origem_id)?.nome || '';
        const nomeDestino = contas.find(c => c.id === data.conta_destino_id)?.nome || '';
        const nomeCofre = cofres.find(c => c.id === data.cofre_intermediario_id)?.nome || 'cofre';
        const obs = data.descricao ? ' — ' + data.descricao : '';

        // 1) Débito (saque) na conta origem
        await base44.entities.TransacaoBancaria.create({
          conta_bancaria_id: data.conta_origem_id, tipo: 'debito', valor, data: today,
          descricao: `Saque para ${nomeCofre} (transf. para ${nomeDestino})${obs}`,
          status: 'conciliado', categoria: 'saque'
        });
        // 2) Entrada no cofre intermediário (saque da conta)
        await base44.entities.MovimentacaoCofre.create({
          cofre_id: data.cofre_intermediario_id, tipo: 'entrada', valor, data: today,
          motivo: `Saque de ${nomeOrigem} para transf. a ${nomeDestino}${obs}`,
          referencia_tipo: 'banco'
        });
        // 3) Saída do cofre intermediário (depósito na conta destino)
        await base44.entities.MovimentacaoCofre.create({
          cofre_id: data.cofre_intermediario_id, tipo: 'saida', valor, data: today,
          motivo: `Depósito em ${nomeDestino}${obs}`,
          referencia_tipo: 'banco'
        });
        // 4) Crédito (depósito) na conta destino
        await base44.entities.TransacaoBancaria.create({
          conta_bancaria_id: data.conta_destino_id, tipo: 'credito', valor, data: today,
          descricao: `Depósito de ${nomeCofre} (de ${nomeOrigem})${obs}`,
          status: 'conciliado', categoria: 'deposito'
        });

      } else if (tipo === 'saque') {
        // Saque: débito na conta → entrada no cofre (se informado)
        const nomeCofre = cofres.find(c => c.id === data.cofre_id)?.nome || '';
        await base44.entities.TransacaoBancaria.create({
          conta_bancaria_id: data.conta_origem_id, tipo: 'debito', valor, data: today,
          descricao: data.descricao || `Saque${nomeCofre ? ' para ' + nomeCofre : ''}`,
          status: 'conciliado', categoria: 'saque'
        });
        if (data.cofre_id) {
          await base44.entities.MovimentacaoCofre.create({
            cofre_id: data.cofre_id, tipo: 'entrada', valor, data: today,
            motivo: data.descricao || `Saque de ${contas.find(c => c.id === data.conta_origem_id)?.nome || ''}`,
            referencia_tipo: 'banco'
          });
        }

      } else if (tipo === 'deposito') {
        // Depósito: saída do cofre (se informado) → crédito na conta
        const nomeCofre = cofres.find(c => c.id === data.cofre_id)?.nome || '';
        await base44.entities.TransacaoBancaria.create({
          conta_bancaria_id: data.conta_origem_id, tipo: 'credito', valor, data: today,
          descricao: data.descricao || `Depósito${nomeCofre ? ' de ' + nomeCofre : ''}`,
          status: 'conciliado', categoria: 'deposito'
        });
        if (data.cofre_id) {
          await base44.entities.MovimentacaoCofre.create({
            cofre_id: data.cofre_id, tipo: 'saida', valor, data: today,
            motivo: data.descricao || `Depósito em ${contas.find(c => c.id === data.conta_origem_id)?.nome || ''}`,
            referencia_tipo: 'banco'
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transacoesBancarias'] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoesCofre'] });
      toast.success('Operação registrada!');
      handleClose();
    },
    onError: () => toast.error('Erro ao registrar operação')
  });

  const handleClose = () => {
    setForm({ conta_origem_id: '', conta_destino_id: '', cofre_intermediario_id: '', cofre_id: '', valor: '', data: new Date().toISOString().split('T')[0], descricao: '' });
    setTipo('deposito');
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.conta_origem_id || !form.valor) { toast.error('Preencha conta e valor'); return; }
    if ((tipo === 'transferencia' || tipo === 'trans_cofre') && !form.conta_destino_id) { toast.error('Informe a conta destino'); return; }
    if (tipo === 'trans_cofre' && !form.cofre_intermediario_id) { toast.error('Informe o cofre intermediário'); return; }
    if (tipo === 'transferencia' && form.conta_origem_id === form.conta_destino_id) { toast.error('Origem e destino devem ser diferentes'); return; }
    mutation.mutate(form);
  };

  const tipoAtual = TIPOS.find(t => t.value === tipo);

  const btnColor = {
    deposito: 'bg-green-600 hover:bg-green-700',
    saque: 'bg-red-600 hover:bg-red-700',
    transferencia: 'bg-blue-600 hover:bg-blue-700',
    trans_cofre: 'bg-purple-600 hover:bg-purple-700',
  }[tipo];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Operação Bancária</DialogTitle>
        </DialogHeader>

        {/* Seletor de tipo */}
        <div className="grid grid-cols-2 gap-2">
          {TIPOS.map(t => {
            const Icon = t.icon;
            const active = tipo === t.value;
            return (
              <button key={t.value} type="button" onClick={() => setTipo(t.value)}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-xs font-medium
                  ${active ? `${t.bg} ${t.color} border-current` : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Info da operação */}
        {tipoAtual && (
          <div className="flex items-start gap-2 bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-500 border">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{tipoAtual.desc}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Conta principal */}
          <div className="space-y-2">
            <Label>{tipo === 'deposito' ? 'Conta que recebe *' : 'Conta origem *'}</Label>
            <Select value={form.conta_origem_id} onValueChange={v => setForm({ ...form, conta_origem_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
              <SelectContent>
                {contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome} — {c.banco}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Cofre vinculado (saque/depósito) */}
          {(tipo === 'saque' || tipo === 'deposito') && (
            <div className="space-y-2">
              <Label>{tipo === 'saque' ? 'Destino no cofre (opcional)' : 'Cofre de origem (opcional)'}</Label>
              <Select value={form.cofre_id} onValueChange={v => setForm({ ...form, cofre_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o cofre..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>— Sem cofre —</SelectItem>
                  {cofres.filter(c => c.status === 'ativo').map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Conta destino (transferências) */}
          {(tipo === 'transferencia' || tipo === 'trans_cofre') && (
            <div className="space-y-2">
              <Label>Conta destino *</Label>
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

          {/* Cofre intermediário (trans via cofre) */}
          {tipo === 'trans_cofre' && (
            <div className="space-y-2">
              <Label>Cofre intermediário *</Label>
              <Select value={form.cofre_intermediario_id} onValueChange={v => setForm({ ...form, cofre_intermediario_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o cofre..." /></SelectTrigger>
                <SelectContent>
                  {cofres.filter(c => c.status === 'ativo').map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">O dinheiro passará por este cofre como comprovante físico da movimentação entre CNPJs distintos.</p>
            </div>
          )}

          {/* Valor + Data */}
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
            <Button type="submit" disabled={mutation.isPending} className={`gap-2 ${btnColor}`}>
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar {tipoAtual?.label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}