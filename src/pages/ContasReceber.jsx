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
import { DollarSign, Plus, Pencil, Trash2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import RegistrarRecebimentoModal from '@/components/contas/RegistrarRecebimentoModal';

export default function ContasReceber() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [recebimentoModal, setRecebimentoModal] = useState(null);
  const [formData, setFormData] = useState({
    cliente_nome: '',
    descricao: '',
    origem: 'venda',
    valor_original: '',
    data_vencimento: '',
    data_recebimento: '',
    valor_recebido: '',
    forma_recebimento: 'dinheiro',
    observacoes: '',
    status: 'pendente'
  });

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['contasReceber'],
    queryFn: () => base44.entities.ContaReceber.list('-data_vencimento', 50)
  });

  const { data: contasBancarias = [] } = useQuery({
    queryKey: ['contas-bancarias'],
    queryFn: () => base44.entities.ContaBancaria.filter({ status: 'ativo' })
  });

  const { data: cofres = [] } = useQuery({
    queryKey: ['cofres'],
    queryFn: () => base44.entities.Cofre.filter({ status: 'ativo' })
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ContaReceber.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contasReceber'] });
      setModalOpen(false);
      resetForm();
      toast.success('Conta a receber criada!');
    },
    onError: () => toast.error('Erro ao criar')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ContaReceber.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contasReceber'] });
      setModalOpen(false);
      resetForm();
      toast.success('Conta a receber atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContaReceber.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contasReceber'] });
      toast.success('Conta a receber excluída!');
    }
  });

  const resetForm = () => {
    setFormData({
      cliente_nome: '',
      descricao: '',
      origem: 'venda',
      valor_original: '',
      data_vencimento: '',
      data_recebimento: '',
      valor_recebido: '',
      forma_recebimento: 'dinheiro',
      observacoes: '',
      status: 'pendente'
    });
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      cliente_nome: item.cliente_nome || '',
      descricao: item.descricao || '',
      origem: item.origem || 'venda',
      valor_original: item.valor_original || '',
      data_vencimento: item.data_vencimento || '',
      data_recebimento: item.data_recebimento || '',
      valor_recebido: item.valor_recebido || '',
      forma_recebimento: item.forma_recebimento || 'dinheiro',
      observacoes: item.observacoes || '',
      status: item.status || 'pendente'
    });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      valor_original: parseFloat(formData.valor_original),
      valor_recebido: formData.valor_recebido ? parseFloat(formData.valor_recebido) : undefined
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const columns = [
    {
      key: 'cliente_nome',
      label: 'Cliente',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-slate-800 dark:text-white">{value || row.descricao}</p>
          <p className="text-xs text-slate-500">Vencimento: {format(new Date(row.data_vencimento), 'dd/MM/yyyy')}</p>
        </div>
      )
    },
    {
      key: 'valor_original',
      label: 'Valor',
      render: (v) => <MoneyDisplay value={v} size="sm" colorize />
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
        title="Contas a Receber"
        subtitle="Gerencie suas receitas pendentes"
        icon={DollarSign}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Financeiro' }, { label: 'Contas a Receber' }]}
        actions={
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nova
          </Button>
        }
      />

      {contas.length === 0 && !isLoading ? (
        <EmptyState icon={DollarSign} title="Sem contas" description="Registre suas receitas." actionLabel="Criar" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable columns={columns} data={contas} loading={isLoading} searchPlaceholder="Buscar..." rowActions={(row) => [
          ...(['pendente', 'parcial', 'vencido'].includes(row.status) ? [{ label: 'Registrar Recebimento', icon: CreditCard, onClick: () => setRecebimentoModal(row) }] : []),
          { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) },
          { label: 'Excluir', icon: Trash2, onClick: () => deleteMutation.mutate(row.id), destructive: true }
        ]} />
      )}

      {/* Modal de Recebimento */}
      <RegistrarRecebimentoModal
        open={!!recebimentoModal}
        onClose={() => setRecebimentoModal(null)}
        conta={recebimentoModal}
        contasBancarias={contasBancarias}
        cofres={cofres}
        lojas={lojas}
      />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar' : 'Nova Conta a Receber'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Input value={formData.cliente_nome} onChange={e => setFormData({ ...formData, cliente_nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input value={formData.descricao} onChange={e => setFormData({ ...formData, descricao: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Origem</Label>
                <Select value={formData.origem} onValueChange={v => setFormData({ ...formData, origem: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venda">Venda</SelectItem>
                    <SelectItem value="servico">Serviço</SelectItem>
                    <SelectItem value="aluguel">Aluguel</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="recebido">Recebido</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Original *</Label>
                <Input type="number" step="0.01" value={formData.valor_original} onChange={e => setFormData({ ...formData, valor_original: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Valor Recebido</Label>
                <Input type="number" step="0.01" value={formData.valor_recebido} onChange={e => setFormData({ ...formData, valor_recebido: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vencimento *</Label>
                <Input type="date" value={formData.data_vencimento} onChange={e => setFormData({ ...formData, data_vencimento: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Recebimento</Label>
                <Input type="date" value={formData.data_recebimento} onChange={e => setFormData({ ...formData, data_recebimento: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Forma de Recebimento</Label>
              <Select value={formData.forma_recebimento} onValueChange={v => setFormData({ ...formData, forma_recebimento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                  <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={formData.observacoes} onChange={e => setFormData({ ...formData, observacoes: e.target.value })} rows={2} />
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