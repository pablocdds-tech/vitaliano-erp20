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
import { BookOpen, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function FichasTecnicas() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    rendimento: '',
    unidade_rendimento: '',
    tempo_preparo_minutos: '',
    modo_preparo: '',
    custo_total: '',
    margem_sugerida: '',
    preco_sugerido: '',
    status: 'rascunho'
  });

  const { data: fichas = [], isLoading } = useQuery({
    queryKey: ['fichasTecnicas'],
    queryFn: () => base44.entities.FichaTecnica.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.FichaTecnica.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fichasTecnicas'] });
      setModalOpen(false);
      resetForm();
      toast.success('Ficha técnica criada!');
    },
    onError: () => toast.error('Erro ao criar')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FichaTecnica.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fichasTecnicas'] });
      setModalOpen(false);
      resetForm();
      toast.success('Ficha técnica atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FichaTecnica.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fichasTecnicas'] });
      toast.success('Ficha técnica excluída!');
    }
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      codigo: '',
      rendimento: '',
      unidade_rendimento: '',
      tempo_preparo_minutos: '',
      modo_preparo: '',
      custo_total: '',
      margem_sugerida: '',
      preco_sugerido: '',
      status: 'rascunho'
    });
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      nome: item.nome || '',
      codigo: item.codigo || '',
      rendimento: item.rendimento || '',
      unidade_rendimento: item.unidade_rendimento || '',
      tempo_preparo_minutos: item.tempo_preparo_minutos || '',
      modo_preparo: item.modo_preparo || '',
      custo_total: item.custo_total || '',
      margem_sugerida: item.margem_sugerida || '',
      preco_sugerido: item.preco_sugerido || '',
      status: item.status || 'rascunho'
    });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      rendimento: parseFloat(formData.rendimento),
      tempo_preparo_minutos: formData.tempo_preparo_minutos ? parseInt(formData.tempo_preparo_minutos) : undefined,
      custo_total: formData.custo_total ? parseFloat(formData.custo_total) : undefined,
      margem_sugerida: formData.margem_sugerida ? parseFloat(formData.margem_sugerida) : undefined,
      preco_sugerido: formData.preco_sugerido ? parseFloat(formData.preco_sugerido) : undefined
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const columns = [
    {
      key: 'nome',
      label: 'Receita',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-slate-800 dark:text-white">{value}</p>
          <p className="text-xs text-slate-500">{row.codigo || '-'}</p>
        </div>
      )
    },
    {
      key: 'rendimento',
      label: 'Rendimento',
      render: (v, row) => <span className="text-sm">{v} {row.unidade_rendimento || 'un'}</span>
    },
    {
      key: 'custo_total',
      label: 'Custo',
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
        title="Fichas Técnicas"
        subtitle="Gerencie receitas e custos de produção"
        icon={BookOpen}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Produção' }, { label: 'Fichas Técnicas' }]}
        actions={
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nova
          </Button>
        }
      />

      {fichas.length === 0 && !isLoading ? (
        <EmptyState icon={BookOpen} title="Nenhuma ficha" description="Crie suas receitas." actionLabel="Criar" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable columns={columns} data={fichas} loading={isLoading} searchPlaceholder="Buscar..." rowActions={(row) => [
          { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) },
          { label: 'Excluir', icon: Trash2, onClick: () => deleteMutation.mutate(row.id), destructive: true }
        ]} />
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar' : 'Nova Ficha Técnica'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Receita *</Label>
              <Input value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Código</Label>
              <Input value={formData.codigo} onChange={e => setFormData({ ...formData, codigo: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rendimento *</Label>
                <Input type="number" step="0.01" value={formData.rendimento} onChange={e => setFormData({ ...formData, rendimento: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Input value={formData.unidade_rendimento} onChange={e => setFormData({ ...formData, unidade_rendimento: e.target.value })} placeholder="ex: kg, l" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tempo de Preparo (min)</Label>
              <Input type="number" value={formData.tempo_preparo_minutos} onChange={e => setFormData({ ...formData, tempo_preparo_minutos: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Modo de Preparo</Label>
              <Textarea value={formData.modo_preparo} onChange={e => setFormData({ ...formData, modo_preparo: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Custo Total</Label>
                <Input type="number" step="0.01" value={formData.custo_total} onChange={e => setFormData({ ...formData, custo_total: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Margem (%)</Label>
                <Input type="number" step="0.01" value={formData.margem_sugerida} onChange={e => setFormData({ ...formData, margem_sugerida: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Preço Sugerido</Label>
              <Input type="number" step="0.01" value={formData.preco_sugerido} onChange={e => setFormData({ ...formData, preco_sugerido: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
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