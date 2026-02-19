import React, { useState, useMemo } from 'react';
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
import { Tags, Plus, Pencil, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import ImportarCSVModal, { IMPORT_CONFIGS } from '@/components/importacao/ImportarCSVModal';

export default function Categorias() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    tipo: 'insumo',
    cor: '#3b82f6',
    status: 'ativo'
  });

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => base44.entities.Categoria.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Categoria.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      setModalOpen(false);
      resetForm();
      toast.success('Categoria criada!');
    },
    onError: () => toast.error('Erro ao criar')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Categoria.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      setModalOpen(false);
      resetForm();
      toast.success('Categoria atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Categoria.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      toast.success('Categoria excluída!');
    }
  });

  const handleBulkDelete = async (ids) => {
    if (!window.confirm(`Deseja excluir ${ids.length} categoria(s) selecionada(s)?`)) return;
    for (const id of ids) await base44.entities.Categoria.delete(id);
    queryClient.invalidateQueries({ queryKey: ['categorias'] });
    toast.success(`${ids.length} categoria(s) excluída(s)!`);
  };

  const categoriasFiltradas = useMemo(() => {
    if (!filtroStatus) return categorias;
    return categorias.filter(c => c.status === filtroStatus);
  }, [categorias, filtroStatus]);

  const resetForm = () => {
    setFormData({ nome: '', codigo: '', tipo: 'insumo', cor: '#3b82f6', status: 'ativo' });
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      nome: item.nome || '',
      codigo: item.codigo || '',
      tipo: item.tipo || 'insumo',
      cor: item.cor || '#3b82f6',
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
      label: 'Categoria',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: row.cor || '#3b82f6' }} />
          <div>
            <p className="font-medium text-slate-800 dark:text-white">{value}</p>
            <p className="text-xs text-slate-500">{row.codigo || '-'}</p>
          </div>
        </div>
      )
    },
    { key: 'tipo', label: 'Tipo', sortable: true, render: (v) => <span className="text-sm capitalize">{v?.replace(/_/g, ' ')}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <StatusBadge status={v} size="sm" />
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorias"
        subtitle="Organize produtos em categorias"
        icon={Tags}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Categorias' }]}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setImportarOpen(true)} className="gap-2 w-full sm:w-auto">
              <Upload className="w-4 h-4" /> Importar CSV
            </Button>
            <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" /> Nova
            </Button>
          </div>
        }
      />

      <ImportarCSVModal
        open={importarOpen}
        onClose={() => setImportarOpen(false)}
        config={IMPORT_CONFIGS.categoria}
      />

      {categorias.length === 0 && !isLoading ? (
        <EmptyState icon={Tags} title="Nenhuma categoria" description="Crie suas categorias." actionLabel="Criar" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable
          columns={columns}
          data={categoriasFiltradas}
          loading={isLoading}
          searchPlaceholder="Buscar..."
          onBulkDelete={handleBulkDelete}
          filterBar={
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-9 w-32 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          }
          rowActions={(row) => [
            { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) },
            { label: 'Excluir', icon: Trash2, onClick: () => deleteMutation.mutate(row.id), destructive: true }
          ]}
        />
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Código</Label>
              <Input value={formData.codigo} onChange={e => setFormData({ ...formData, codigo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formData.tipo} onValueChange={v => setFormData({ ...formData, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="insumo">Insumo</SelectItem>
                  <SelectItem value="produto_final">Produto Final</SelectItem>
                  <SelectItem value="embalagem">Embalagem</SelectItem>
                  <SelectItem value="limpeza">Limpeza</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <div className="space-y-2 flex-1">
                <Label>Cor</Label>
                <input type="color" value={formData.cor} onChange={e => setFormData({ ...formData, cor: e.target.value })} className="w-12 h-10 rounded cursor-pointer" />
              </div>
              <div className="space-y-2 flex-1">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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