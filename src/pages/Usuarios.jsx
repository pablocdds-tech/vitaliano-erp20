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
import { Users, Plus, Pencil, Shield } from 'lucide-react';
import { toast } from 'sonner';
import PermissoesModal from '@/components/rbac/PermissoesModal';

export default function Usuarios() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    role: 'user'
  });

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list()
  });

  const inviteUserMutation = useMutation({
    mutationFn: (data) => base44.users.inviteUser(data.email, data.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      setModalOpen(false);
      resetForm();
      toast.success('Usuário convidado!');
    },
    onError: () => toast.error('Erro ao convidar')
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      setModalOpen(false);
      resetForm();
      toast.success('Usuário atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar')
  });

  const resetForm = () => {
    setFormData({ email: '', role: 'user' });
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      email: item.email || '',
      role: item.role || 'user'
    });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingItem) {
      updateUserMutation.mutate({ id: editingItem.id, data: { role: formData.role } });
    } else {
      inviteUserMutation.mutate({ email: formData.email, role: formData.role });
    }
  };

  const columns = [
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (value) => (
        <div>
          <p className="font-medium text-slate-800 dark:text-white">{value}</p>
        </div>
      )
    },
    {
      key: 'full_name',
      label: 'Nome',
      sortable: true,
      render: (v) => <span className="text-sm text-slate-600">{v || '-'}</span>
    },
    {
      key: 'role',
      label: 'Função',
      render: (v) => (
        <StatusBadge
          status={v === 'admin' ? 'critica' : 'media'}
          customLabel={v === 'admin' ? 'Administrador' : 'Usuário'}
          size="sm"
        />
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        subtitle="Gerencie usuários do sistema"
        icon={Users}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Sistema' }, { label: 'Usuários' }]}
        actions={
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Convidar
          </Button>
        }
      />

      {usuarios.length === 0 && !isLoading ? (
        <EmptyState icon={Users} title="Nenhum usuário" description="Convide usuários para acessar." actionLabel="Convidar" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable columns={columns} data={usuarios} loading={isLoading} searchPlaceholder="Buscar..." rowActions={(row) => [
          { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) }
        ]} />
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Função' : 'Convidar Usuário'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Email {editingItem ? '' : '*'}</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                disabled={!!editingItem}
                required={!editingItem}
              />
              {editingItem && <p className="text-xs text-slate-500">Email não pode ser alterado</p>}
            </div>
            <div className="space-y-2">
              <Label>Função *</Label>
              <Select value={formData.role} onValueChange={v => setFormData({ ...formData, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={inviteUserMutation.isPending || updateUserMutation.isPending}>
                {editingItem ? 'Salvar' : 'Convidar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}