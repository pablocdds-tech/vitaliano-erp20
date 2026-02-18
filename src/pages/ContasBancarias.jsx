import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import EmptyState from '@/components/ui-custom/EmptyState';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Landmark, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY = { nome: '', banco: '', agencia: '', conta: '', loja_id: '', tipo: 'corrente', saldo_inicial: 0, status: 'ativo' };

export default function ContasBancarias() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const { data: contas = [], isLoading } = useQuery({ queryKey: ['contas-bancarias'], queryFn: () => base44.entities.ContaBancaria.list('nome') });
  const { data: transacoes = [] } = useQuery({ queryKey: ['transacoes-banco'], queryFn: () => base44.entities.TransacaoBancaria.list('-data', 1000) });
  const { data: lojas = [] } = useQuery({ queryKey: ['lojas'], queryFn: () => base44.entities.Loja.list() });

  const getSaldo = (contaId) => {
    const saldoInicial = contas.find(c => c.id === contaId)?.saldo_inicial || 0;
    const movs = transacoes.filter(t => t.conta_bancaria_id === contaId && t.status !== 'ignorado');
    return saldoInicial + movs.reduce((s, t) => s + (t.valor || 0), 0);
  };

  const create = useMutation({ mutationFn: d => base44.entities.ContaBancaria.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['contas-bancarias'] }); close(); toast.success('Conta criada!'); } });
  const update = useMutation({ mutationFn: ({ id, d }) => base44.entities.ContaBancaria.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['contas-bancarias'] }); close(); toast.success('Atualizada!'); } });
  const del = useMutation({ mutationFn: id => base44.entities.ContaBancaria.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['contas-bancarias'] }); toast.success('Removida!'); } });

  const close = () => { setForm(EMPTY); setEditId(null); setOpen(false); };

  const handleEdit = (c) => { setForm({ nome: c.nome, banco: c.banco, agencia: c.agencia || '', conta: c.conta || '', loja_id: c.loja_id || '', tipo: c.tipo, saldo_inicial: c.saldo_inicial || 0, status: c.status }); setEditId(c.id); setOpen(true); };

  const handleSubmit = (e) => { e.preventDefault(); editId ? update.mutate({ id: editId, d: form }) : create.mutate(form); };

  const getLoja = id => lojas.find(l => l.id === id);
  const totalBancos = contas.reduce((s, c) => s + getSaldo(c.id), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas Bancárias"
        subtitle="Cadastre contas bancárias e visualize saldos consolidados"
        icon={Landmark}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Contas Bancárias' }]}
        actions={<Button className="gap-2" onClick={() => { setForm(EMPTY); setEditId(null); setOpen(true); }}><Plus className="w-4 h-4" />Nova Conta</Button>}
      />

      {/* Saldo total */}
      <Card className="bg-gradient-to-r from-slate-800 to-slate-900 text-white border-0">
        <CardContent className="pt-5 pb-4">
          <p className="text-sm text-slate-300">Total em Bancos</p>
          <p className="text-3xl font-bold mt-1">{formatMoney(totalBancos)}</p>
          <p className="text-xs text-slate-400 mt-1">Saldo inicial + transações importadas (não ignoradas)</p>
        </CardContent>
      </Card>

      {contas.length === 0 && !isLoading ? (
        <EmptyState icon={Landmark} title="Nenhuma conta cadastrada" description="Cadastre suas contas bancárias para importar OFX e conciliar." actionLabel="Nova Conta" onAction={() => setOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contas.map(c => {
            const saldo = getSaldo(c.id);
            const pendentes = transacoes.filter(t => t.conta_bancaria_id === c.id && t.status === 'pendente').length;
            return (
              <Card key={c.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-white">{c.nome}</p>
                      <p className="text-xs text-slate-500">{c.banco} {c.agencia ? `• Ag. ${c.agencia}` : ''} {c.conta ? `• CC ${c.conta}` : ''}</p>
                      {c.loja_id && <p className="text-xs text-slate-400">{getLoja(c.loja_id)?.nome}</p>}
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-xs text-slate-400">Saldo estimado</p>
                  <p className={`text-2xl font-bold ${saldo < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatMoney(saldo)}</p>
                  {pendentes > 0 && <p className="text-xs text-amber-600 mt-1">⚠️ {pendentes} transações pendentes de conciliação</p>}
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" className="gap-1 flex-1" onClick={() => handleEdit(c)}><Pencil className="w-3.5 h-3.5" />Editar</Button>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => { if (confirm('Excluir?')) del.mutate(c.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? 'Editar' : 'Nova'} Conta Bancária</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1"><Label>Nome / Apelido *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Bradesco PJ Principal" required /></div>
            <div className="space-y-1"><Label>Banco *</Label><Input value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })} placeholder="Ex: Bradesco, Itaú..." required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Agência</Label><Input value={form.agencia} onChange={e => setForm({ ...form, agencia: e.target.value })} /></div>
              <div className="space-y-1"><Label>Conta</Label><Input value={form.conta} onChange={e => setForm({ ...form, conta: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="corrente">Corrente</SelectItem><SelectItem value="poupanca">Poupança</SelectItem><SelectItem value="investimento">Investimento</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Loja</Label>
              <Select value={form.loja_id} onValueChange={v => setForm({ ...form, loja_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Saldo Inicial (R$)</Label><Input type="number" step="0.01" value={form.saldo_inicial} onChange={e => setForm({ ...form, saldo_inicial: parseFloat(e.target.value) || 0 })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}