import React, { useState } from 'react';
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
import { Landmark, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ContasBancarias() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    banco: '',
    agencia: '',
    conta: '',
    loja_id: '',
    tipo: 'corrente',
    saldo_inicial: '0',
    status: 'ativo'
  });

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['contas-bancarias'],
    queryFn: () => base44.entities.ContaBancaria.list('nome')
  });

  const { data: transacoes = [] } = useQuery({
    queryKey: ['transacoes-banco'],
    queryFn: () => base44.entities.TransacaoBancaria.list('-data', 1000)
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ContaBancaria.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-bancarias'] });
      setModalOpen(false);
      resetForm();
      toast.success('Conta bancária criada!');
    },
    onError: () => toast.error('Erro ao criar conta')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ContaBancaria.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-bancarias'] });
      setModalOpen(false);
      resetForm();
      toast.success('Conta atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContaBancaria.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-bancarias'] });
      toast.success('Conta excluída!');
    }
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      banco: '',
      agencia: '',
      conta: '',
      loja_id: '',
      tipo: 'corrente',
      saldo_inicial: '0',
      status: 'ativo'
    });
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      nome: item.nome || '',
      banco: item.banco || '',
      agencia: item.agencia || '',
      conta: item.conta || '',
      loja_id: item.loja_id || '',
      tipo: item.tipo || 'corrente',
      saldo_inicial: item.saldo_inicial || '0',
      status: item.status || 'ativo'
    });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      nome: formData.nome,
      banco: formData.banco,
      agencia: formData.agencia,
      conta: formData.conta,
      loja_id: formData.loja_id || null,
      tipo: formData.tipo,
      saldo_inicial: parseFloat(formData.saldo_inicial),
      status: formData.status
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getSaldoBanco = (contaId) => {
    const saldoInicial = contas.find(c => c.id === contaId)?.saldo_inicial || 0;
    const movs = transacoes.filter(t => t.conta_bancaria_id === contaId && t.status !== 'ignorado');
    return saldoInicial + movs.reduce((s, t) => s + (t.valor || 0), 0);
  };

  const columns = [
    {
      key: 'nome',
      label: 'Conta',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-slate-800 dark:text-white">{value}</p>
          <p className="text-xs text-slate-500">{row.banco} • {row.tipo.replace('_', ' ')}</p>
        </div>
      )
    },
    {
      key: 'agencia',
      label: 'Agência / Conta',
      render: (value, row) => <span className="text-sm">{value} / {row.conta}</span>
    },
    {
      key: 'loja_id',
      label: 'Loja',
      render: (v) => lojas.find(l => l.id === v)?.nome || 'Geral'
    },
    {
      key: 'id',
      label: 'Saldo',
      render: (id) => <MoneyDisplay value={getSaldoBanco(id)} colorize size="sm" />
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <StatusBadge status={v} />
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas Bancárias"
        subtitle="Gerencie suas contas e saldos bancários"
        icon={Landmark}
        breadcrumbs={[
          { label: 'Dashboard', href: 'Dashboard' },
          { label: 'Contas Bancárias' }
        ]}
        actions={
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Conta
          </Button>
        }
      />

      {contas.length === 0 && !isLoading ? (
        <EmptyState icon={Landmark} title="Nenhuma conta cadastrada" description="Cadastre suas contas bancárias." actionLabel="Nova Conta" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable
          columns={columns}
          data={contas}
          loading={isLoading}
          searchPlaceholder="Buscar contas..."
          rowActions={(row) => [
            { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) },
            { label: 'Excluir', icon: Trash2, onClick: () => deleteMutation.mutate(row.id), destructive: true }
          ]}
        />
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Conta' : 'Nova Conta Bancária'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Conta *</Label>
              <Input value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} placeholder="Conta Corrente Principal" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Banco *</Label>
                <Input value={formData.banco} onChange={e => setFormData({ ...formData, banco: e.target.value })} placeholder="Itaú" required />
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
                <Input value={formData.agencia} onChange={e => setFormData({ ...formData, agencia: e.target.value })} placeholder="0001" />
              </div>
              <div className="space-y-2">
                <Label>Conta</Label>
                <Input value={formData.conta} onChange={e => setFormData({ ...formData, conta: e.target.value })} placeholder="123456" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Loja</Label>
                <Select value={formData.loja_id || '__none__'} onValueChange={v => setFormData({ ...formData, loja_id: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Geral" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Geral</SelectItem>
                    {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Saldo Inicial (R$)</Label>
                <Input type="number" value={formData.saldo_inicial} onChange={e => setFormData({ ...formData, saldo_inicial: e.target.value })} step="0.01" />
              </div>
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
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingItem ? 'Salvar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}