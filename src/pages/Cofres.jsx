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
    status: 'ativo'
  });

  const { data: cofres = [], isLoading } = useQuery({
    queryKey: ['cofres'],
    queryFn: () => base44.entities.Cofre.list('nome')
  });

  const { data: movsCofre = [] } = useQuery({
    queryKey: ['movs-cofre'],
    queryFn: () => base44.entities.MovimentacaoCofre.list('-data', 1000)
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
    onError: () => toast.error('Erro ao criar cofre')
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
    setFormData({ nome: '', tipo: 'loja', loja_id: '', status: 'ativo' });
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      nome: item.nome || '',
      tipo: item.tipo || 'loja',
      loja_id: item.loja_id || '',
      status: item.status || 'ativo'
    });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      nome: formData.nome,
      tipo: formData.tipo,
      loja_id: formData.loja_id || null,
      status: formData.status
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getSaldoCofre = (cofreId) => {
    return movsCofre.filter(m => m.cofre_id === cofreId || m.cofre_destino_id === cofreId).reduce((s, m) => {
      if (m.tipo === 'entrada') return s + m.valor;
      if (m.tipo === 'saida') return s - m.valor;
      if (m.tipo === 'transferencia') return m.cofre_id === cofreId ? s - m.valor : s + m.valor;
      return s;
    }, 0);
  };

  const columns = [
    {
      key: 'nome',
      label: 'Cofre',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-slate-800 dark:text-white">{value}</p>
          <p className="text-xs text-slate-500">{row.tipo === 'central' ? 'Central' : lojas.find(l => l.id === row.loja_id)?.nome || '-'}</p>
        </div>
      )
    },
    {
      key: 'id',
      label: 'Saldo',
      render: (id) => <MoneyDisplay value={getSaldoCofre(id)} colorize size="sm" />
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <StatusBadge status={v} />
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cofres"
        subtitle="Gerencie cofres e caixas da empresa"
        icon={Vault}
        breadcrumbs={[
          { label: 'Dashboard', href: 'Dashboard' },
          { label: 'Cofres' }
        ]}
        actions={
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Cofre
          </Button>
        }
      />

      {cofres.length === 0 && !isLoading ? (
        <EmptyState icon={Vault} title="Nenhum cofre cadastrado" description="Crie seus cofres." actionLabel="Novo Cofre" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable
          columns={columns}
          data={cofres}
          loading={isLoading}
          searchPlaceholder="Buscar cofres..."
          rowActions={(row) => [
            { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) },
            { label: 'Excluir', icon: Trash2, onClick: () => deleteMutation.mutate(row.id), destructive: true }
          ]}
        />
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Cofre' : 'Novo Cofre'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} placeholder="Cofre Loja 1" required />
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
                <Select value={formData.loja_id || '__none__'} onValueChange={v => setFormData({ ...formData, loja_id: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Selecione...</SelectItem>
                    {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

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