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
import { Vault, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Cofres() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'loja',
    loja_id: '',
    saldo_inicial: 0,
    status: 'ativo'
  });

  const { data: cofres = [], isLoading } = useQuery({
    queryKey: ['cofres'],
    queryFn: () => base44.entities.Cofre.list()
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Cofre.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cofres'] });
      setModalOpen(false);
      resetForm();
      toast.success('Cofre criado!');
    },
    onError: () => toast.error('Erro ao criar')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cofre.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cofres'] });
      setModalOpen(false);
      resetForm();
      toast.success('Cofre atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Cofre.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cofres'] });
      toast.success('Cofre excluído!');
    }
  });

  const resetForm = () => {
    setFormData({ nome: '', tipo: 'loja', loja_id: '', saldo_inicial: 0, status: 'ativo' });
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      nome: item.nome || '',
      tipo: item.tipo || 'loja',
      loja_id: item.loja_id || '',
      saldo_inicial: item.saldo_inicial || 0,
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

  const getLojaName = (id) => {
    const loja = lojas.find(l => l.id === id);
    return loja?.nome || id || '-';
  };

  const columns = [
    {
      key: 'nome',
      label: 'Cofre',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-slate-800 dark:text-white">{value}</p>
          <p className="text-xs text-slate-500">{row.tipo === 'central' ? 'Central' : getLojaName(row.loja_id)}</p>
        </div>
      )
    },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (v) => <span className="text-sm capitalize">{v === 'central' ? 'Central' : 'Loja'}</span>
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
        title="Cofres"
        subtitle="Gerencie cofres de lojas e central"
        icon={Vault}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Financeiro' }, { label: 'Cofres' }]}
        actions={
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Novo
          </Button>
        }
      />

      {cofres.length === 0 && !isLoading ? (
        <EmptyState icon={Vault} title="Nenhum cofre" description="Cadastre seus cofres." actionLabel="Criar" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable columns={columns} data={cofres} loading={isLoading} searchPlaceholder="Buscar..." rowActions={(row) => [
          { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) },
          { label: 'Excluir', icon: Trash2, onClick: () => deleteMutation.mutate(row.id), destructive: true }
        ]} />
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar' : 'Novo Cofre'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} required />
            </div>
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
              <Label>Saldo Inicial *</Label>
              <Input 
                type="number" 
                step="0.01"
                min="0"
                value={formData.saldo_inicial} 
                onChange={e => setFormData({ ...formData, saldo_inicial: parseFloat(e.target.value) || 0 })} 
                required 
                placeholder="0,00"
              />
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