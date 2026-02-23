import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import MoneyDisplay from '@/components/ui-custom/MoneyDisplay';
import EmptyState from '@/components/ui-custom/EmptyState';
import KPICard from '@/components/ui-custom/KPICard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CreditCard, Plus, Pencil, Trash2, Wallet, Vault } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney } from '@/components/ui-custom/MoneyDisplay';

// ─── Contas Bancárias ────────────────────────────────────────────
function ContasBancariasTab() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    nome: '', banco: '', agencia: '', conta: '', tipo: 'corrente', saldo_inicial: '', status: 'ativo'
  });

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['contasBancarias'],
    queryFn: () => base44.entities.ContaBancaria.list()
  });

  const { data: transacoes = [] } = useQuery({
    queryKey: ['transacoesBancarias'],
    queryFn: () => base44.entities.TransacaoBancaria.list('-data', 1000)
  });

  const calcularSaldoAtual = (contaId) => {
    const saldoInicial = contas.find(c => c.id === contaId)?.saldo_inicial || 0;
    const transacoesAccount = transacoes.filter(t => t.conta_bancaria_id === contaId);
    return saldoInicial + transacoesAccount.reduce((sum, t) => {
      if (t.tipo === 'credito') return sum + (t.valor || 0);
      if (t.tipo === 'debito') return sum - Math.abs(t.valor || 0);
      return sum;
    }, 0);
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ContaBancaria.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contasBancarias'] }); setModalOpen(false); resetForm(); toast.success('Conta criada!'); },
    onError: () => toast.error('Erro ao criar')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ContaBancaria.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contasBancarias'] }); setModalOpen(false); resetForm(); toast.success('Conta atualizada!'); },
    onError: () => toast.error('Erro ao atualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContaBancaria.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contasBancarias'] })
  });

  const resetForm = () => {
    setFormData({ nome: '', banco: '', agencia: '', conta: '', tipo: 'corrente', saldo_inicial: '', status: 'ativo' });
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({ nome: item.nome || '', banco: item.banco || '', agencia: item.agencia || '', conta: item.conta || '', tipo: item.tipo || 'corrente', saldo_inicial: item.saldo_inicial || '', status: item.status || 'ativo' });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...formData, saldo_inicial: parseFloat(formData.saldo_inicial) || 0 };
    if (editingItem) updateMutation.mutate({ id: editingItem.id, data });
    else createMutation.mutate(data);
  };

  const totalSaldo = contas.reduce((sum, c) => sum + calcularSaldoAtual(c.id), 0);

  const columns = [
    {
      key: 'nome', label: 'Conta', sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-slate-800">{value}</p>
          <p className="text-xs text-slate-500">{row.banco} • {row.agencia}/{row.conta}</p>
        </div>
      )
    },
    { key: 'tipo', label: 'Tipo', render: (v) => <span className="text-sm capitalize">{v?.replace(/_/g, ' ')}</span> },
    { key: 'saldo_inicial', label: 'Saldo Inicial', render: (v) => <MoneyDisplay value={v} size="sm" /> },
    { key: 'id', label: 'Saldo Atual', render: (id) => <MoneyDisplay value={calcularSaldoAtual(id)} size="sm" colorize /> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} size="sm" /> }
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="grid grid-cols-2 gap-4 flex-1">
          <KPICard title="Saldo Total" value={formatMoney(totalSaldo)} icon={Wallet} variant="success" subtitle={`${contas.length} contas`} />
          <KPICard title="Contas Ativas" value={contas.filter(c => c.status === 'ativo').length} icon={CreditCard} variant="info" />
        </div>
        <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2 ml-4">
          <Plus className="w-4 h-4" /> Nova Conta
        </Button>
      </div>

      {contas.length === 0 && !isLoading ? (
        <EmptyState icon={CreditCard} title="Nenhuma conta" description="Cadastre suas contas bancárias." actionLabel="Criar" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable columns={columns} data={contas} loading={isLoading} searchPlaceholder="Buscar conta..." rowActions={(row) => [
          { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) },
          { label: 'Excluir', icon: Trash2, onClick: () => deleteMutation.mutate(row.id), destructive: true }
        ]} />
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? 'Editar' : 'Nova Conta'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Banco *</Label><Input value={formData.banco} onChange={e => setFormData({ ...formData, banco: e.target.value })} required /></div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={formData.tipo} onValueChange={v => setFormData({ ...formData, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                    <SelectItem value="investimento">Investimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Agência</Label><Input value={formData.agencia} onChange={e => setFormData({ ...formData, agencia: e.target.value })} /></div>
              <div className="space-y-2"><Label>Conta</Label><Input value={formData.conta} onChange={e => setFormData({ ...formData, conta: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Saldo Inicial</Label><Input type="number" step="0.01" value={formData.saldo_inicial} onChange={e => setFormData({ ...formData, saldo_inicial: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editingItem ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Cofres ──────────────────────────────────────────────────────
function CofresTab() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ nome: '', tipo: 'loja', loja_id: '', status: 'ativo' });

  const { data: cofres = [], isLoading } = useQuery({
    queryKey: ['cofres'],
    queryFn: () => base44.entities.Cofre.list()
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['movimentacoesCofre'],
    queryFn: () => base44.entities.MovimentacaoCofre.list('-created_date', 1000)
  });

  const calcularSaldoCofre = (cofreId) => {
    const cofre = cofres.find(c => c.id === cofreId);
    const saldoInicial = cofre?.saldo_inicial || 0;
    const movs = movimentacoes.filter(m => m.cofre_id === cofreId);
    return saldoInicial + movs.reduce((sum, m) => {
      if (m.tipo === 'entrada') return sum + (m.valor || 0);
      if (m.tipo === 'saida') return sum - Math.abs(m.valor || 0);
      return sum;
    }, 0);
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Cofre.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cofres'] }); setModalOpen(false); resetForm(); toast.success('Cofre criado!'); },
    onError: () => toast.error('Erro ao criar')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cofre.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cofres'] }); setModalOpen(false); resetForm(); toast.success('Cofre atualizado!'); },
    onError: () => toast.error('Erro ao atualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Cofre.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cofres'] })
  });

  const resetForm = () => { setFormData({ nome: '', tipo: 'loja', loja_id: '', status: 'ativo' }); setEditingItem(null); };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({ nome: item.nome || '', tipo: item.tipo || 'loja', loja_id: item.loja_id || '', status: item.status || 'ativo' });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingItem) updateMutation.mutate({ id: editingItem.id, data: formData });
    else createMutation.mutate(formData);
  };

  const getLojaName = (id) => lojas.find(l => l.id === id)?.nome || '-';
  const totalCofres = cofres.reduce((sum, c) => sum + calcularSaldoCofre(c.id), 0);

  const columns = [
    {
      key: 'nome', label: 'Cofre', sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-slate-800">{value}</p>
          <p className="text-xs text-slate-500">{row.tipo === 'central' ? 'Central' : getLojaName(row.loja_id)}</p>
        </div>
      )
    },
    { key: 'tipo', label: 'Tipo', render: (v) => <span className="text-sm capitalize">{v === 'central' ? 'Central' : 'Loja'}</span> },
    { key: 'id', label: 'Saldo Atual', render: (id) => <MoneyDisplay value={calcularSaldoCofre(id)} size="sm" colorize /> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} size="sm" /> }
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="grid grid-cols-2 gap-4 flex-1">
          <KPICard title="Total em Cofres" value={formatMoney(totalCofres)} icon={Vault} variant="warning" subtitle={`${cofres.length} cofres`} />
          <KPICard title="Cofres Ativos" value={cofres.filter(c => c.status === 'ativo').length} icon={Vault} variant="info" />
        </div>
        <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2 ml-4">
          <Plus className="w-4 h-4" /> Novo Cofre
        </Button>
      </div>

      {cofres.length === 0 && !isLoading ? (
        <EmptyState icon={Vault} title="Nenhum cofre" description="Cadastre seus cofres de loja e central." actionLabel="Criar" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable columns={columns} data={cofres} loading={isLoading} searchPlaceholder="Buscar cofre..." rowActions={(row) => [
          { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) },
          { label: 'Excluir', icon: Trash2, onClick: () => deleteMutation.mutate(row.id), destructive: true }
        ]} />
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? 'Editar Cofre' : 'Novo Cofre'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} required /></div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={formData.tipo} onValueChange={v => setFormData({ ...formData, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="loja">Loja</SelectItem>
                  <SelectItem value="central">Central</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.tipo === 'loja' && (
              <div className="space-y-2">
                <Label>Loja</Label>
                <Select value={formData.loja_id} onValueChange={v => setFormData({ ...formData, loja_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editingItem ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────
export default function ContasBancarias() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas Bancárias & Cofres"
        subtitle="Acompanhe saldos bancários e cofres em um só lugar"
        icon={CreditCard}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Financeiro' }, { label: 'Contas & Cofres' }]}
      />

      <Tabs defaultValue="contas">
        <TabsList>
          <TabsTrigger value="contas" className="gap-2">
            <CreditCard className="w-4 h-4" />Contas Bancárias
          </TabsTrigger>
          <TabsTrigger value="cofres" className="gap-2">
            <Vault className="w-4 h-4" />Cofres
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contas" className="mt-4">
          <ContasBancariasTab />
        </TabsContent>

        <TabsContent value="cofres" className="mt-4">
          <CofresTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}