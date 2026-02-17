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
import { Store, Plus, Pencil, Trash2, Building2, MapPin, Phone } from 'lucide-react';
import { toast } from 'sonner';

export default function Lojas() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    tipo: 'loja',
    cnpj: '',
    endereco: {
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: ''
    },
    contato: {
      telefone: '',
      email: '',
      responsavel: ''
    },
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
      toast.success('Loja criada com sucesso!');
    },
    onError: () => toast.error('Erro ao criar loja')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Loja.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lojas'] });
      setModalOpen(false);
      resetForm();
      toast.success('Loja atualizada com sucesso!');
    },
    onError: () => toast.error('Erro ao atualizar loja')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Loja.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lojas'] });
      toast.success('Loja excluída com sucesso!');
    },
    onError: () => toast.error('Erro ao excluir loja')
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      codigo: '',
      tipo: 'loja',
      cnpj: '',
      endereco: { logradouro: '', numero: '', bairro: '', cidade: '', estado: '', cep: '' },
      contato: { telefone: '', email: '', responsavel: '' },
      status: 'ativo'
    });
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      nome: item.nome || '',
      codigo: item.codigo || '',
      tipo: item.tipo || 'loja',
      cnpj: item.cnpj || '',
      endereco: item.endereco || { logradouro: '', numero: '', bairro: '', cidade: '', estado: '', cep: '' },
      contato: item.contato || { telefone: '', email: '', responsavel: '' },
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
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${row.tipo === 'cd' ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-teal-100 dark:bg-teal-900/30'}`}>
            {row.tipo === 'cd' ? (
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            ) : (
              <Store className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            )}
          </div>
          <div>
            <p className="font-medium text-slate-800 dark:text-white">{value}</p>
            <p className="text-xs text-slate-500">{row.codigo || '-'}</p>
          </div>
        </div>
      )
    },
    {
      key: 'tipo',
      label: 'Tipo',
      sortable: true,
      render: (value) => <StatusBadge status={value} />
    },
    {
      key: 'endereco',
      label: 'Cidade',
      render: (value) => (
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <MapPin className="w-4 h-4" />
          {value?.cidade || '-'} / {value?.estado || '-'}
        </div>
      )
    },
    {
      key: 'saldo_banco_virtual',
      label: 'Saldo Virtual',
      sortable: true,
      render: (value) => <MoneyDisplay value={value || 0} colorize />
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => <StatusBadge status={value} />
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lojas"
        subtitle="Gerencie suas unidades e centros de distribuição"
        icon={Store}
        breadcrumbs={[
          { label: 'Dashboard', href: 'Dashboard' },
          { label: 'Lojas' }
        ]}
        actions={
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Loja
          </Button>
        }
      />

      {lojas.length === 0 && !isLoading ? (
        <EmptyState
          icon={Store}
          title="Nenhuma loja cadastrada"
          description="Comece cadastrando sua primeira loja ou centro de distribuição."
          actionLabel="Cadastrar Loja"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={lojas}
          loading={isLoading}
          searchPlaceholder="Buscar lojas..."
          emptyIcon={Store}
          emptyTitle="Nenhuma loja encontrada"
          rowActions={(row) => [
            { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) },
            { label: 'Excluir', icon: Trash2, onClick: () => deleteMutation.mutate(row.id), destructive: true }
          ]}
        />
      )}

      {/* Modal de Cadastro/Edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Loja' : 'Nova Loja'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados Básicos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome da loja"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Código</Label>
                <Input
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="Código interno"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select 
                  value={formData.tipo} 
                  onValueChange={(v) => setFormData({ ...formData, tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loja">Loja</SelectItem>
                    <SelectItem value="cd">Centro de Distribuição</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Endereço</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label>Logradouro</Label>
                  <Input
                    value={formData.endereco?.logradouro || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      endereco: { ...formData.endereco, logradouro: e.target.value }
                    })}
                    placeholder="Rua, Avenida..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input
                    value={formData.endereco?.numero || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      endereco: { ...formData.endereco, numero: e.target.value }
                    })}
                    placeholder="123"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input
                    value={formData.endereco?.bairro || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      endereco: { ...formData.endereco, bairro: e.target.value }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    value={formData.endereco?.cidade || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      endereco: { ...formData.endereco, cidade: e.target.value }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input
                    value={formData.endereco?.estado || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      endereco: { ...formData.endereco, estado: e.target.value }
                    })}
                    placeholder="SP"
                  />
                </div>
              </div>
            </div>

            {/* Contato */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Contato</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={formData.contato?.telefone || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      contato: { ...formData.contato, telefone: e.target.value }
                    })}
                    placeholder="(00) 0000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={formData.contato?.email || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      contato: { ...formData.contato, email: e.target.value }
                    })}
                    type="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Input
                    value={formData.contato?.responsavel || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      contato: { ...formData.contato, responsavel: e.target.value }
                    })}
                  />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
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