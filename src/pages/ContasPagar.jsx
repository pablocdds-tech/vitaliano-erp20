import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import MoneyDisplay, { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import KPICard from '@/components/ui-custom/KPICard';
import EmptyState from '@/components/ui-custom/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { CreditCard, Plus, Pencil, CheckCircle2, Trash2, Clock, AlertTriangle, Wallet } from 'lucide-react';
import { format, differenceInDays, isAfter } from 'date-fns';
import { toast } from 'sonner';

export default function ContasPagar() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [payModal, setPayModal] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    descricao: '',
    fornecedor_id: '',
    documento_numero: '',
    data_emissao: '',
    data_vencimento: '',
    valor_original: 0,
    forma_pagamento: 'boleto',
    observacoes: '',
    status: 'pendente'
  });

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['contas-pagar'],
    queryFn: () => base44.entities.ContaPagar.list('-data_vencimento')
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Fornecedor.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ContaPagar.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      setModalOpen(false);
      resetForm();
      toast.success('Conta cadastrada!');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ContaPagar.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      setModalOpen(false);
      setPayModal(null);
      resetForm();
      toast.success('Conta atualizada!');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContaPagar.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      toast.success('Conta excluída!');
    }
  });

  const resetForm = () => {
    setFormData({
      descricao: '',
      fornecedor_id: '',
      documento_numero: '',
      data_emissao: '',
      data_vencimento: '',
      valor_original: 0,
      forma_pagamento: 'boleto',
      observacoes: '',
      status: 'pendente'
    });
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      descricao: item.descricao || '',
      fornecedor_id: item.fornecedor_id || '',
      documento_numero: item.documento_numero || '',
      data_emissao: item.data_emissao || '',
      data_vencimento: item.data_vencimento || '',
      valor_original: item.valor_original || 0,
      forma_pagamento: item.forma_pagamento || 'boleto',
      observacoes: item.observacoes || '',
      status: item.status || 'pendente'
    });
    setModalOpen(true);
  };

  const handlePay = (conta) => {
    updateMutation.mutate({
      id: conta.id,
      data: {
        status: 'pago',
        data_pagamento: format(new Date(), 'yyyy-MM-dd'),
        valor_pago: conta.valor_original
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const loja = lojas[0];
    const data = { ...formData, loja_id: loja?.id };
    
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Cálculos
  const hoje = new Date();
  const pendentes = contas.filter(c => c.status === 'pendente');
  const vencidas = pendentes.filter(c => isAfter(hoje, new Date(c.data_vencimento)));
  const vencendoHoje = pendentes.filter(c => {
    const diff = differenceInDays(new Date(c.data_vencimento), hoje);
    return diff >= 0 && diff <= 7;
  });
  
  const totalPendente = pendentes.reduce((sum, c) => sum + (c.valor_original || 0), 0);
  const totalVencido = vencidas.reduce((sum, c) => sum + (c.valor_original || 0), 0);

  const getFornecedor = (id) => fornecedores.find(f => f.id === id);

  const columns = [
    {
      key: 'descricao',
      label: 'Descrição',
      sortable: true,
      render: (value, row) => {
        const forn = getFornecedor(row.fornecedor_id);
        const vencida = row.status === 'pendente' && isAfter(hoje, new Date(row.data_vencimento));
        return (
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              vencida ? 'bg-red-100 dark:bg-red-900/30' : 
              row.status === 'pago' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 
              'bg-amber-100 dark:bg-amber-900/30'
            }`}>
              {vencida ? (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              ) : row.status === 'pago' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <Clock className="w-4 h-4 text-amber-600" />
              )}
            </div>
            <div>
              <p className="font-medium text-slate-800 dark:text-white">{value}</p>
              <p className="text-xs text-slate-500">{forn?.nome_fantasia || forn?.razao_social || '-'}</p>
            </div>
          </div>
        );
      }
    },
    {
      key: 'data_vencimento',
      label: 'Vencimento',
      sortable: true,
      render: (value, row) => {
        const vencida = row.status === 'pendente' && isAfter(hoje, new Date(value));
        return (
          <span className={vencida ? 'text-red-600 font-medium' : ''}>
            {value ? format(new Date(value), 'dd/MM/yyyy') : '-'}
          </span>
        );
      }
    },
    {
      key: 'valor_original',
      label: 'Valor',
      sortable: true,
      render: (value) => <MoneyDisplay value={value || 0} size="sm" />
    },
    {
      key: 'forma_pagamento',
      label: 'Forma',
      render: (value) => (
        <span className="text-sm capitalize">{value?.replace(/_/g, ' ')}</span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value, row) => {
        const vencida = value === 'pendente' && isAfter(hoje, new Date(row.data_vencimento));
        return <StatusBadge status={vencida ? 'vencido' : value} />;
      }
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a Pagar"
        subtitle="Gerencie suas despesas e pagamentos"
        icon={CreditCard}
        breadcrumbs={[
          { label: 'Dashboard', href: 'Dashboard' },
          { label: 'Contas a Pagar' }
        ]}
        actions={
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Conta
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Total Pendente"
          value={formatMoney(totalPendente)}
          icon={Wallet}
          variant="warning"
          subtitle={`${pendentes.length} contas`}
        />
        <KPICard
          title="Vencidas"
          value={formatMoney(totalVencido)}
          icon={AlertTriangle}
          variant="danger"
          subtitle={`${vencidas.length} contas`}
        />
        <KPICard
          title="Vence em 7 dias"
          value={vencendoHoje.length}
          icon={Clock}
          variant="info"
          subtitle="contas próximas"
        />
        <KPICard
          title="Pagas este mês"
          value={contas.filter(c => c.status === 'pago').length}
          icon={CheckCircle2}
          variant="success"
        />
      </div>

      {contas.length === 0 && !isLoading ? (
        <EmptyState
          icon={CreditCard}
          title="Nenhuma conta cadastrada"
          description="Cadastre suas contas a pagar."
          actionLabel="Nova Conta"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={contas}
          loading={isLoading}
          searchPlaceholder="Buscar contas..."
          emptyIcon={CreditCard}
          emptyTitle="Nenhuma conta encontrada"
          rowActions={(row) => [
            ...(row.status === 'pendente' ? [
              { label: 'Pagar', icon: CheckCircle2, onClick: () => handlePay(row) }
            ] : []),
            { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) },
            { label: 'Excluir', icon: Trash2, onClick: () => deleteMutation.mutate(row.id), destructive: true }
          ]}
        />
      )}

      {/* Modal de Cadastro */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Conta' : 'Nova Conta a Pagar'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Ex: Aluguel Janeiro"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Select 
                value={formData.fornecedor_id} 
                onValueChange={(v) => setFormData({ ...formData, fornecedor_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome_fantasia || f.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Emissão</Label>
                <Input
                  type="date"
                  value={formData.data_emissao}
                  onChange={(e) => setFormData({ ...formData, data_emissao: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Vencimento *</Label>
                <Input
                  type="date"
                  value={formData.data_vencimento}
                  onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input
                  type="number"
                  value={formData.valor_original}
                  onChange={(e) => setFormData({ ...formData, valor_original: parseFloat(e.target.value) || 0 })}
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select 
                  value={formData.forma_pagamento} 
                  onValueChange={(v) => setFormData({ ...formData, forma_pagamento: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
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