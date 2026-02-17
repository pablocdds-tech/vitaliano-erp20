import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import EmptyState from '@/components/ui-custom/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
import { Tags, Plus, Pencil, Trash2, Folder } from 'lucide-react';
import { toast } from 'sonner';

const cores = [
  { value: '#3b82f6', label: 'Azul' },
  { value: '#10b981', label: 'Verde' },
  { value: '#f59e0b', label: 'Âmbar' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#06b6d4', label: 'Ciano' },
  { value: '#64748b', label: 'Cinza' }
];

export default function Categorias() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
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
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Categoria.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      setModalOpen(false);
      resetForm();
      toast.success('Categoria atualizada!');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Categoria.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      toast.success('Categoria excluída!');
    }
  });

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorias"
        subtitle="Organize seus produtos em categorias"
        icon={Tags}
        breadcrumbs={[
          { label: 'Dashboard', href: 'Dashboard' },
          { label: 'Categorias' }
        ]}
        actions={
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Categoria
          </Button>
        }
      />

      {categorias.length === 0 && !isLoading ? (
        <EmptyState
          icon={Tags}
          title="Nenhuma categoria"
          description="Crie categorias para organizar seus produtos."
          actionLabel="Criar Categoria"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {categorias.map((cat) => (
            <Card 
              key={cat.id} 
              className="group hover:shadow-lg transition-all cursor-pointer border-slate-200 dark:border-slate-800"
              onClick={() => handleEdit(cat)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2.5 rounded-xl"
                      style={{ backgroundColor: `${cat.cor}20` }}
                    >
                      <Folder className="w-5 h-5" style={{ color: cat.cor }} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-white">{cat.nome}</p>
                      <p className="text-xs text-slate-500 capitalize">{cat.tipo?.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); handleEdit(cat); }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-red-600 hover:text-red-700"
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(cat.id); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome da categoria"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Código</Label>
              <Input
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                placeholder="CAT001"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select 
                value={formData.tipo} 
                onValueChange={(v) => setFormData({ ...formData, tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="insumo">Insumo</SelectItem>
                  <SelectItem value="produto_final">Produto Final</SelectItem>
                  <SelectItem value="embalagem">Embalagem</SelectItem>
                  <SelectItem value="limpeza">Limpeza</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                {cores.map((cor) => (
                  <button
                    key={cor.value}
                    type="button"
                    className={`w-8 h-8 rounded-full transition-all ${
                      formData.cor === cor.value ? 'ring-2 ring-offset-2 ring-slate-400' : ''
                    }`}
                    style={{ backgroundColor: cor.value }}
                    onClick={() => setFormData({ ...formData, cor: cor.value })}
                  />
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingItem ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}