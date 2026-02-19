import React, { useState } from 'react';
import withPermissao from '@/components/rbac/withPermissao';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import MoneyDisplay from '@/components/ui-custom/MoneyDisplay';
import EmptyState from '@/components/ui-custom/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard, Plus, Pencil, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import KPICard from '@/components/ui-custom/KPICard';

function ContasBancarias() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    banco: '',
    agencia: '',
    conta: '',
    tipo: 'corrente',
    saldo_inicial: '',
    status: 'ativo'
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
    const totalMovimentado = transacoesAccount.reduce((sum, t) => {
      if (t.tipo === 'credito') return sum + (t.valor || 0);
      if (t.tipo === 'debito') return sum - Math.abs(t.valor || 0);
      return sum;
    }, 0);
    return saldoInicial + totalMovimentado;
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ContaBancaria.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contasBancarias'] });
      setModalOpen(false);
      resetForm();
      toast.success('Conta criada!');
    },
    onError: () => toast.error('Erro ao criar')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ContaBancaria.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contasBancarias'] });
      setModalOpen(false);
      resetForm();
      toast.success('Conta atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContaBancaria.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contasBancarias'] });
      toast.success('Conta excluída!');
    }
  });

  const resetForm = () => {
    setFormData({ nome: '', banco: '', agencia: '', conta: '', tipo: 'corrente', saldo_inicial: '', status: 'ativo' });
    setEditingItem(null);
  };

  const totalSaldoAtual = contas.reduce((sum, c) => sum + calcularSaldoAtual(c.id), 0);

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      nome: item.nome || '',
      banco: item.banco || '',
      agencia: item.agencia || '',
      conta: item.conta || '',
      tipo: item.tipo || 'corrente',
      saldo_inicial: item.saldo_inicial || '',
      status: item.status || 'ativo'
    });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...formData, saldo_inicial: parseFloat(formData.saldo_inicial) || 0 };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const columns = [
    {
      key: 'nome',
      label: 'Conta',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-slate-800 dark:text-white">{value}</p>
          <p className="text-xs text-slate-500">{row.banco} • {row.agencia}/{row.conta}</p>
        </div>
      )
    },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (v) => <span className="text-sm capitalize">{v?.replace(/_/g, ' ')}</span>
    },
    {
      key: 'saldo_inicial',
      label: 'Saldo Inicial',
      render: (v) => <MoneyDisplay value={v} size="sm" />
    },
    {
      key: 'id',
      label: 'Saldo Atual',
      render: (id) => <MoneyDisplay value={calcularSaldoAtual(id)} size="sm" colorize />
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <StatusBadge status={v} size="sm" />
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas Bancárias"
        subtitle="Gerencie suas contas bancárias"
        icon={CreditCard}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Contas Bancárias' }]}
        actions={
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4" /> Nova
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KPICard title="Saldo Total Atual" value={formatMoney(totalSaldoAtual)} icon={Wallet} variant="success" subtitle={`${contas.length} contas`} />
        <KPICard title="Contas Ativas" value={contas.filter(c => c.status === 'ativo').length} icon={CreditCard} variant="info" />
      </div>

      {contas.length === 0 && !isLoading ? (
        <EmptyState icon={CreditCard} title="Nenhuma conta" description="Cadastre suas contas bancárias." actionLabel="Criar" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable columns={columns} data={contas} loading={isLoading} searchPlaceholder="Buscar..." rowActions={(row) => [
          { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) },
          { label: 'Excluir', icon: Trash2, onClick: () => deleteMutation.mutate(row.id), destructive: true }
        ]} />
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar' : 'Nova Conta'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Banco *</Label>
                <Input value={formData.banco} onChange={e => setFormData({ ...formData, banco: e.target.value })} required />
              </div>
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
              <div className="space-y-2">
                <Label>Agência</Label>
                <Input value={formData.agencia} onChange={e => setFormData({ ...formData, agencia: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Conta</Label>
                <Input value={formData.conta} onChange={e => setFormData({ ...formData, conta: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Saldo Inicial</Label>
              <Input type="number" step="0.01" value={formData.saldo_inicial} onChange={e => setFormData({ ...formData, saldo_inicial: e.target.value })} />
            </div>
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

export default withPermissao(ContasBancarias, 'bancos');