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
import { format } from 'date-fns';

export default function BancoVirtual() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    tipo: 'transferencia',
    valor: '',
    descricao: '',
    loja_origem_id: '',
    loja_destino_id: '',
    status: 'pendente'
  });

  const { data: transferencias = [], isLoading } = useQuery({
    queryKey: ['bancoVirtual'],
    queryFn: () => base44.entities.BancoVirtual.list('-updated_date', 50)
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.BancoVirtual.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancoVirtual'] });
      setModalOpen(false);
      resetForm();
      toast.success('Transferência registrada!');
    },
    onError: () => toast.error('Erro ao registrar')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BancoVirtual.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancoVirtual'] });
      setModalOpen(false);
      resetForm();
      toast.success('Transferência atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BancoVirtual.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancoVirtual'] });
      toast.success('Transferência excluída!');
    }
  });

  const resetForm = () => {
    setFormData({ tipo: 'transferencia', valor: '', descricao: '', loja_origem_id: '', loja_destino_id: '', status: 'pendente' });
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      tipo: item.tipo || 'transferencia',
      valor: item.valor || '',
      descricao: item.descricao || '',
      loja_origem_id: item.loja_origem_id || '',
      loja_destino_id: item.loja_destino_id || '',
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

  const getLojaName = (id) => {
    const loja = lojas.find(l => l.id === id);
    return loja?.nome || id || '-';
  };

  const columns = [
    {
      key: 'tipo',
      label: 'Tipo',
      render: (v) => <span className="text-sm font-medium capitalize">{v?.replace(/_/g, ' ')}</span>
    },
    {
      key: 'valor',
      label: 'Valor',
      render: (v) => <MoneyDisplay value={v} size="sm" colorize />
    },
    {
      key: 'descricao',
      label: 'Descrição',
      render: (v) => <span className="text-sm text-slate-600">{v || '-'}</span>
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
        title="Banco Virtual"
        subtitle="Gerencie transferências entre lojas e CD"
        icon={Landmark}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Financeiro' }, { label: 'Banco Virtual' }]}
        actions={
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nova
          </Button>
        }
      />

      {transferencias.length === 0 && !isLoading ? (
        <EmptyState icon={Landmark} title="Sem transferências" description="Registre suas transferências." actionLabel="Criar" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable columns={columns} data={transferencias} loading={isLoading} searchPlaceholder="Buscar..." rowActions={(row) => [
          { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) },
          { label: 'Excluir', icon: Trash2, onClick: () => deleteMutation.mutate(row.id), destructive: true }
        ]} />
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar' : 'Nova Transferência'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={formData.tipo} onValueChange={v => setFormData({ ...formData, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposito">Depósito</SelectItem>
                  <SelectItem value="saque">Saque</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="ajuste">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor *</Label>
              <Input type="number" step="0.01" value={formData.valor} onChange={e => setFormData({ ...formData, valor: e.target.value })} required />
            </div>
            {formData.tipo === 'transferencia' && (
              <>
                <div className="space-y-2">
                  <Label>Loja Origem</Label>
                  <Select value={formData.loja_origem_id} onValueChange={v => setFormData({ ...formData, loja_origem_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Loja Destino</Label>
                  <Select value={formData.loja_destino_id} onValueChange={v => setFormData({ ...formData, loja_destino_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={formData.descricao} onChange={e => setFormData({ ...formData, descricao: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="rejeitado">Rejeitado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
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