import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import StatusBadge from '@/components/ui-custom/StatusBadge';
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
import { Store, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTenant } from '@/components/services/useTenant';

export default function Lojas() {
  const queryClient = useQueryClient();
  const { empresa_id } = useTenant();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    tipo: 'loja',
    cnpj: '',
    contato: { telefone: '', email: '' },
    status: 'ativo'
  });

  const { data: lojas = [], isLoading } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Loja.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lojas'] });
      setModalOpen(false);
      resetForm();
      toast.success('Loja criada!');
    },
    onError: () => toast.error('Erro ao criar')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Loja.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lojas'] });
      setModalOpen(false);
      resetForm();
      toast.success('Loja atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Loja.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lojas'] });
      toast.success('Loja excluída!');
    }
  });

  const resetForm = () => {
    setFormData({ nome: '', codigo: '', tipo: 'loja', cnpj: '', contato: { telefone: '', email: '' }, status: 'ativo' });
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      nome: item.nome || '',
      codigo: item.codigo || '',
      tipo: item.tipo || 'loja',
      cnpj: item.cnpj || '',
      contato: item.contato || { telefone: '', email: '' },
      status: item.status || 'ativo'
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

  const columns = [
    {
      key: 'nome',
      label: 'Loja',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-slate-800 dark:text-white">{value}</p>
          <p className="text-xs text-slate-500">{row.tipo === 'cd' ? 'Centro Distribuição' : 'Loja'} • {row.codigo || '-'}</p>
        </div>
      )
    },
    {
      key: 'contato',
      label: 'Contato',
      render: (v) => <span className="text-xs">{v?.email || v?.telefone || '-'}</span>
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
        title="Lojas"
        subtitle="Gerencie suas unidades operacionais"
        icon={Store}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Lojas' }]}
        actions={
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nova
          </Button>
        }
      />

      {lojas.length === 0 && !isLoading ? (
        <EmptyState icon={Store} title="Nenhuma loja" description="Cadastre suas unidades." actionLabel="Criar" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable columns={columns} data={lojas} loading={isLoading} searchPlaceholder="Buscar..." rowActions={(row) => [
          { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) },
          { label: 'Excluir', icon: Trash2, onClick: () => deleteMutation.mutate(row.id), destructive: true }
        ]} />
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar' : 'Nova Loja'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input value={formData.codigo} onChange={e => setFormData({ ...formData, codigo: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={formData.tipo} onValueChange={v => setFormData({ ...formData, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loja">Loja</SelectItem>
                    <SelectItem value="cd">Centro Distribuição</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value={formData.cnpj} onChange={e => setFormData({ ...formData, cnpj: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={formData.contato?.telefone || ''} onChange={e => setFormData({ ...formData, contato: { ...formData.contato, telefone: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.contato?.email || ''} onChange={e => setFormData({ ...formData, contato: { ...formData.contato, email: e.target.value } })} />
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
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editingItem ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}