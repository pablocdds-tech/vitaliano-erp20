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
import { ArrowRightLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function MovimentacoesBancarias() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    conta_bancaria_id: '',
    data: '',
    valor: '',
    tipo: 'credito',
    descricao: '',
    memo: '',
    status: 'pendente'
  });

  const { data: transacoes = [], isLoading } = useQuery({
    queryKey: ['transacoesBancarias'],
    queryFn: () => base44.entities.TransacaoBancaria.list('-data', 100)
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['contasBancarias'],
    queryFn: () => base44.entities.ContaBancaria.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TransacaoBancaria.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transacoesBancarias'] });
      setModalOpen(false);
      resetForm();
      toast.success('Transação registrada!');
    },
    onError: () => toast.error('Erro ao registrar')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TransacaoBancaria.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transacoesBancarias'] });
      setModalOpen(false);
      resetForm();
      toast.success('Transação atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TransacaoBancaria.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transacoesBancarias'] });
      toast.success('Transação excluída!');
    }
  });

  const resetForm = () => {
    setFormData({ conta_bancaria_id: '', data: '', valor: '', tipo: 'credito', descricao: '', memo: '', status: 'pendente' });
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      conta_bancaria_id: item.conta_bancaria_id || '',
      data: item.data || '',
      valor: item.valor || '',
      tipo: item.tipo || 'credito',
      descricao: item.descricao || '',
      memo: item.memo || '',
      status: item.status || 'pendente'
    });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...formData, valor: parseFloat(formData.valor) };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getContaNome = (id) => {
    const conta = contas.find(c => c.id === id);
    return conta?.nome || id || '-';
  };

  const columns = [
    {
      key: 'data',
      label: 'Data',
      sortable: true,
      render: (v) => <span className="text-sm">{format(new Date(v), 'dd/MM/yyyy')}</span>
    },
    {
      key: 'descricao',
      label: 'Descrição',
      sortable: true,
      render: (v) => <span className="text-sm text-slate-600">{v || '-'}</span>
    },
    {
      key: 'valor',
      label: 'Valor',
      render: (v, row) => <MoneyDisplay value={row.tipo === 'debito' ? -v : v} size="sm" colorize />
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
        title="Movimentações Bancárias"
        subtitle="Registre e concilie transações bancárias"
        icon={ArrowRightLeft}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Financeiro' }, { label: 'Movimentações' }]}
        actions={
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nova
          </Button>
        }
      />

      {transacoes.length === 0 && !isLoading ? (
        <EmptyState icon={ArrowRightLeft} title="Sem transações" description="Registre suas movimentações." actionLabel="Criar" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable columns={columns} data={transacoes} loading={isLoading} searchPlaceholder="Buscar..." rowActions={(row) => [
          { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) },
          { label: 'Excluir', icon: Trash2, onClick: () => deleteMutation.mutate(row.id), destructive: true }
        ]} />
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar' : 'Nova Movimentação'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Conta Bancária *</Label>
              <Select value={formData.conta_bancaria_id} onValueChange={v => setFormData({ ...formData, conta_bancaria_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={formData.data} onChange={e => setFormData({ ...formData, data: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={formData.tipo} onValueChange={v => setFormData({ ...formData, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credito">Crédito</SelectItem>
                    <SelectItem value="debito">Débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Valor *</Label>
              <Input type="number" step="0.01" value={formData.valor} onChange={e => setFormData({ ...formData, valor: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input value={formData.descricao} onChange={e => setFormData({ ...formData, descricao: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Memo (OFX)</Label>
              <Textarea value={formData.memo} onChange={e => setFormData({ ...formData, memo: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="conciliado">Conciliado</SelectItem>
                  <SelectItem value="ignorado">Ignorado</SelectItem>
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