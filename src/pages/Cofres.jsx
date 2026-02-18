import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import MoneyDisplay, { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import EmptyState from '@/components/ui-custom/EmptyState';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Vault, Plus, Pencil, Trash2, ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Cofres() {
  const qc = useQueryClient();
  const [cofreModal, setCofreModal] = useState(false);
  const [movModal, setMovModal] = useState(null); // cofre selecionado
  const [editando, setEditando] = useState(null);
  const [cofreForm, setCofreForm] = useState({ nome: '', tipo: 'loja', loja_id: '', status: 'ativo' });
  const [movForm, setMovForm] = useState({ data: format(new Date(), 'yyyy-MM-dd'), tipo: 'entrada', valor: 0, motivo: '', cofre_destino_id: '' });
  const [saving, setSaving] = useState(false);

  const { data: cofres = [], isLoading } = useQuery({ queryKey: ['cofres'], queryFn: () => base44.entities.Cofre.list('nome') });
  const { data: movs = [] } = useQuery({ queryKey: ['movs-cofre'], queryFn: () => base44.entities.MovimentacaoCofre.list('-data', 500) });
  const { data: lojas = [] } = useQuery({ queryKey: ['lojas'], queryFn: () => base44.entities.Loja.list() });

  const getSaldo = (cofreId) => {
    return movs.filter(m => {
      if (m.cofre_id === cofreId) return true;
      if (m.cofre_destino_id === cofreId && m.tipo === 'transferencia') return true;
      return false;
    }).reduce((s, m) => {
      if (m.tipo === 'entrada') return s + m.valor;
      if (m.tipo === 'saida') return s - m.valor;
      if (m.tipo === 'transferencia') {
        if (m.cofre_id === cofreId) return s - m.valor;
        if (m.cofre_destino_id === cofreId) return s + m.valor;
      }
      return s;
    }, 0);
  };

  const createCofre = useMutation({ mutationFn: d => base44.entities.Cofre.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['cofres'] }); resetCofre(); toast.success('Cofre criado!'); } });
  const updateCofre = useMutation({ mutationFn: ({ id, d }) => base44.entities.Cofre.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['cofres'] }); resetCofre(); toast.success('Atualizado!'); } });
  const deleteCofre = useMutation({ mutationFn: id => base44.entities.Cofre.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['cofres'] }); toast.success('Removido!'); } });
  const createMov = useMutation({ mutationFn: d => base44.entities.MovimentacaoCofre.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['movs-cofre'] }); setMovModal(null); toast.success('Movimentação registrada!'); } });

  const resetCofre = () => { setCofreForm({ nome: '', tipo: 'loja', loja_id: '', status: 'ativo' }); setEditando(null); setCofreModal(false); };

  const handleEditCofre = (c) => { setCofreForm({ nome: c.nome, tipo: c.tipo, loja_id: c.loja_id || '', status: c.status }); setEditando(c.id); setCofreModal(true); };

  const handleSaveCofre = (e) => {
    e.preventDefault();
    editando ? updateCofre.mutate({ id: editando, d: cofreForm }) : createCofre.mutate(cofreForm);
  };

  const handleSaveMov = async (e) => {
    e.preventDefault();
    if (movForm.valor <= 0) { toast.error('Valor deve ser maior que zero.'); return; }
    setSaving(true);
    await createMov.mutateAsync({ ...movForm, cofre_id: movModal.id, valor: parseFloat(movForm.valor), referencia_tipo: 'manual' });
    setSaving(false);
    setMovForm({ data: format(new Date(), 'yyyy-MM-dd'), tipo: 'entrada', valor: 0, motivo: '', cofre_destino_id: '' });
  };

  const cofresComSaldo = cofres.map(c => ({ ...c, saldo: getSaldo(c.id) }));
  const totalGeral = cofresComSaldo.reduce((s, c) => s + c.saldo, 0);

  const getLoja = id => lojas.find(l => l.id === id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cofres"
        subtitle="Controle de cofres da loja e central com saldo calculado por movimentações"
        icon={Vault}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Cofres' }]}
        actions={<Button className="gap-2" onClick={() => { resetCofre(); setCofreModal(true); }}><Plus className="w-4 h-4" />Novo Cofre</Button>}
      />

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cofresComSaldo.map(c => (
          <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setMovModal(c); setMovForm({ data: format(new Date(), 'yyyy-MM-dd'), tipo: 'entrada', valor: 0, motivo: '', cofre_destino_id: '' }); }}>
            <CardContent className="pt-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">{c.nome}</p>
                  <p className="text-xs text-slate-500 capitalize">{c.tipo === 'central' ? '🏛️ Central' : `🏪 Loja — ${getLoja(c.loja_id)?.nome || ''}`}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <div className="mt-3">
                <p className="text-xs text-slate-400">Saldo atual</p>
                <p className={`text-xl font-bold ${c.saldo < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatMoney(c.saldo)}</p>
              </div>
              <p className="text-xs text-blue-500 mt-2">Clique para movimentar</p>
            </CardContent>
          </Card>
        ))}
        <Card className="border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <CardContent className="pt-4">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Total em Cofres</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white mt-2">{formatMoney(totalGeral)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Histórico */}
      <div>
        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3 uppercase tracking-wider">Últimas Movimentações</h3>
        {movs.length === 0 ? (
          <EmptyState icon={Vault} title="Nenhuma movimentação" description="Clique em um cofre para registrar movimentações." />
        ) : (
          <div className="space-y-2">
            {movs.slice(0, 20).map(m => {
              const cofre = cofres.find(c => c.id === m.cofre_id);
              const dest = cofres.find(c => c.id === m.cofre_destino_id);
              return (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-sm font-medium">{cofre?.nome || '—'}{dest ? ` → ${dest.nome}` : ''}</p>
                    <p className="text-xs text-slate-500">{m.motivo} • {m.data}</p>
                  </div>
                  <span className={`font-semibold ${m.tipo === 'saida' ? 'text-red-600' : 'text-emerald-600'}`}>
                    {m.tipo === 'saida' ? '-' : '+'}{formatMoney(m.valor)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal cofre */}
      <Dialog open={cofreModal} onOpenChange={() => resetCofre()}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editando ? 'Editar' : 'Novo'} Cofre</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveCofre} className="space-y-3">
            <div className="space-y-1"><Label>Nome *</Label><Input value={cofreForm.nome} onChange={e => setCofreForm({ ...cofreForm, nome: e.target.value })} required /></div>
            <div className="space-y-1"><Label>Tipo</Label>
              <Select value={cofreForm.tipo} onValueChange={v => setCofreForm({ ...cofreForm, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="loja">Loja</SelectItem><SelectItem value="central">Central</SelectItem></SelectContent>
              </Select>
            </div>
            {cofreForm.tipo === 'loja' && (
              <div className="space-y-1"><Label>Loja</Label>
                <Select value={cofreForm.loja_id} onValueChange={v => setCofreForm({ ...cofreForm, loja_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetCofre}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal movimentação */}
      <Dialog open={!!movModal} onOpenChange={() => setMovModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowLeftRight className="w-5 h-5" />Movimentar: {movModal?.nome}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveMov} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Data</Label><Input type="date" value={movForm.data} onChange={e => setMovForm({ ...movForm, data: e.target.value })} /></div>
              <div className="space-y-1"><Label>Valor</Label><Input type="number" step="0.01" min="0.01" value={movForm.valor || ''} onChange={e => setMovForm({ ...movForm, valor: e.target.value })} required /></div>
            </div>
            <div className="space-y-1"><Label>Tipo</Label>
              <Select value={movForm.tipo} onValueChange={v => setMovForm({ ...movForm, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="transferencia">Transferência para outro cofre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {movForm.tipo === 'transferencia' && (
              <div className="space-y-1"><Label>Cofre Destino</Label>
                <Select value={movForm.cofre_destino_id} onValueChange={v => setMovForm({ ...movForm, cofre_destino_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{cofres.filter(c => c.id !== movModal?.id).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1"><Label>Motivo</Label><Input value={movForm.motivo} onChange={e => setMovForm({ ...movForm, motivo: e.target.value })} placeholder="Ex: Depósito do dia, Retirada..." /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMovModal(null)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>Registrar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}