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
import { Wallet, Plus, Pencil, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { format, differenceInDays, isAfter } from 'date-fns';
import { toast } from 'sonner';
import { getEmpresaAtiva } from '@/components/services/tenantService';

export default function ContasReceber() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    cliente_nome: '',
    descricao: '',
    origem: 'venda',
    categoria_dre_id: '',
    loja_id: '',
    valor_original: '',
    data_emissao: format(new Date(), 'yyyy-MM-dd'),
    data_vencimento: '',
    forma_recebimento: 'dinheiro',
    observacoes: '',
    status: 'pendente'
  });

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['contas-receber'],
    queryFn: () => base44.entities.ContaReceber.list('-data_vencimento')
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const { data: categoriasDRE = [] } = useQuery({
    queryKey: ['categorias-dre'],
    queryFn: () => base44.entities.CategoriaDRE.list()
  });

  const createMutation = useMutation({
    mutationFn: async (form) => {
      const empresa = await getEmpresaAtiva();
      return base44.entities.ContaReceber.create({
        empresa_id: empresa.id,
        cliente_nome: form.cliente_nome,
        descricao: form.descricao,
        origem: form.origem,
        categoria_dre_id: form.categoria_dre_id || null,
        loja_id: form.loja_id || null,
        valor_original: parseFloat(form.valor_original),
        data_emissao: form.data_emissao || null,
        data_vencimento: form.data_vencimento,
        forma_recebimento: form.forma_recebimento,
        observacoes: form.observacoes || null,
        status: form.status
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-receber'] });
      setModalOpen(false);
      resetForm();
      toast.success('Conta a receber criada!');
    },
    onError: () => toast.error('Erro ao criar conta')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ContaReceber.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-receber'] });
      setModalOpen(false);
      resetForm();
      toast.success('Conta atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContaReceber.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-receber'] });
      toast.success('Conta excluída!');
    }
  });

  const resetForm = () => {
    setFormData({
      cliente_nome: '',
      descricao: '',
      origem: 'venda',
      categoria_dre_id: '',
      loja_id: '',
      valor_original: '',
      data_emissao: format(new Date(), 'yyyy-MM-dd'),
      data_vencimento: '',
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
      categoria_dre_id: item.categoria_dre_id || '',
      loja_id: item.loja_id || '',
      valor_original: item.valor_original || '',
      data_emissao: item.data_emissao || '',
      data_vencimento: item.data_vencimento || '',
      forma_recebimento: item.forma_recebimento || 'dinheiro',
      observacoes: item.observacoes || '',
      status: item.status || 'pendente'
    });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const hoje = new Date();
  const pendentes = contas.filter(c => c.status === 'pendente');
  const recebidas = contas.filter(c => c.status === 'recebido');
  const vencidas = pendentes.filter(c => c.data_vencimento && isAfter(hoje, new Date(c.data_vencimento + 'T23:59:59')));
  const totalPendente = pendentes.reduce((s, c) => s + (c.valor_original || 0), 0);
  const totalRecebido = recebidas.reduce((s, c) => s + (c.valor_original || 0), 0);

  const columns = [
    {
      key: 'descricao',
      label: 'Descrição / Cliente',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-slate-800 dark:text-white">{value}</p>
          <p className="text-xs text-slate-500">{row.cliente_nome || '-'}</p>
        </div>
      )
    },
    {
      key: 'loja_id',
      label: 'Loja',
      render: (v) => lojas.find(l => l.id === v)?.nome || '-'
    },
    {
      key: 'data_vencimento',
      label: 'Vencimento',
      sortable: true,
      render: (value, row) => {
        const venc = row.status === 'pendente' && value && isAfter(hoje, new Date(value + 'T23:59:59'));
        return <span className={venc ? 'text-red-600 font-medium' : ''}>{value ? format(new Date(value + 'T12:00:00'), 'dd/MM/yyyy') : '-'}</span>;
      }
    },
    { key: 'valor_original', label: 'Valor', sortable: true, render: (v) => <MoneyDisplay value={v || 0} size="sm" /> },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value, row) => {
        const venc = value === 'pendente' && row.data_vencimento && isAfter(hoje, new Date(row.data_vencimento + 'T23:59:59'));
        return <StatusBadge status={venc ? 'vencido' : value} />;
      }
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a Receber"
        subtitle="Gerencie seus recebimentos e clientes"
        icon={Wallet}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Contas a Receber' }]}
        actions={
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Conta
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Pendente" value={formatMoney(totalPendente)} icon={Clock} variant="info" subtitle={`${pendentes.length} contas`} />
        <KPICard title="Vencidas" value={vencidas.length} icon={Clock} variant="danger" subtitle="contas atrasadas" />
        <KPICard title="Recebidas" value={formatMoney(totalRecebido)} icon={CheckCircle2} variant="success" />
        <KPICard title="Total" value={contas.length} icon={Wallet} subtitle="contas" />
      </div>

      {contas.length === 0 && !isLoading ? (
        <EmptyState icon={Wallet} title="Nenhuma conta a receber" description="Cadastre suas contas a receber." actionLabel="Nova Conta" onAction={() => setModalOpen(true)} />
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Conta' : 'Nova Conta a Receber'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Descrição *</Label>
                <Input value={formData.descricao} onChange={e => setFormData({ ...formData, descricao: e.target.value })} placeholder="Venda, Prestação..." required />
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Input value={formData.cliente_nome} onChange={e => setFormData({ ...formData, cliente_nome: e.target.value })} placeholder="Nome do cliente" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Loja</Label>
                <Select value={formData.loja_id || '__none__'} onValueChange={v => setFormData({ ...formData, loja_id: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Selecione...</SelectItem>
                    {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoria DRE</Label>
                <Select value={formData.categoria_dre_id || '__none__'} onValueChange={v => setFormData({ ...formData, categoria_dre_id: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Nenhuma —</SelectItem>
                    {categoriasDRE.filter(c => c.tipo === 'receita').map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input type="number" value={formData.valor_original} onChange={e => setFormData({ ...formData, valor_original: e.target.value })} min="0.01" step="0.01" required />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="recebido">Recebido</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Emissão</Label>
                <Input type="date" value={formData.data_emissao} onChange={e => setFormData({ ...formData, data_emissao: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Data Vencimento *</Label>
                <Input type="date" value={formData.data_vencimento} onChange={e => setFormData({ ...formData, data_vencimento: e.target.value })} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={formData.observacoes} onChange={e => setFormData({ ...formData, observacoes: e.target.value })} rows={2} />
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