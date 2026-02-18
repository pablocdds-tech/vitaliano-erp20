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
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Truck, Plus, Pencil, Trash2, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';

export default function Fornecedores() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    inscricao_estadual: '',
    endereco: {
      logradouro: '',
      numero: '',
      complemento: '',
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
    condicoes_pagamento: '',
    observacoes: '',
    status: 'ativo'
  });

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Fornecedor.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Fornecedor.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      setModalOpen(false);
      resetForm();
      toast.success('Fornecedor criado com sucesso!');
    },
    onError: () => toast.error('Erro ao criar fornecedor')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Fornecedor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      setModalOpen(false);
      resetForm();
      toast.success('Fornecedor atualizado com sucesso!');
    },
    onError: () => toast.error('Erro ao atualizar fornecedor')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Fornecedor.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      toast.success('Fornecedor excluído com sucesso!');
    },
    onError: () => toast.error('Erro ao excluir fornecedor')
  });

  const resetForm = () => {
    setFormData({
      razao_social: '',
      nome_fantasia: '',
      cnpj: '',
      inscricao_estadual: '',
      endereco: { logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '' },
      contato: { telefone: '', email: '', responsavel: '' },
      condicoes_pagamento: '',
      observacoes: '',
      status: 'ativo'
    });
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      razao_social: item.razao_social || '',
      nome_fantasia: item.nome_fantasia || '',
      cnpj: item.cnpj || '',
      inscricao_estadual: item.inscricao_estadual || '',
      endereco: item.endereco || { logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '' },
      contato: item.contato || { telefone: '', email: '', responsavel: '' },
      condicoes_pagamento: item.condicoes_pagamento || '',
      observacoes: item.observacoes || '',
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
      key: 'razao_social',
      label: 'Fornecedor',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-slate-800 dark:text-white">{value}</p>
          <p className="text-xs text-slate-500">{row.nome_fantasia || row.cnpj || '-'}</p>
        </div>
      )
    },
    {
      key: 'contato',
      label: 'Contato',
      render: (value) => (
        <div className="text-xs space-y-0.5">
          {value?.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{value.email}</div>}
          {value?.telefone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{value.telefone}</div>}
        </div>
      )
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
        title="Fornecedores"
        subtitle="Gerencie seus fornecedores e condições de pagamento"
        icon={Truck}
        breadcrumbs={[
          { label: 'Dashboard', href: 'Dashboard' },
          { label: 'Fornecedores' }
        ]}
        actions={
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Fornecedor
          </Button>
        }
      />

      {fornecedores.length === 0 && !isLoading ? (
        <EmptyState
          icon={Truck}
          title="Nenhum fornecedor cadastrado"
          description="Cadastre seus fornecedores principais."
          actionLabel="Cadastrar Fornecedor"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={fornecedores}
          loading={isLoading}
          searchPlaceholder="Buscar fornecedores..."
          rowActions={(row) => [
            { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) },
            { label: 'Excluir', icon: Trash2, onClick: () => deleteMutation.mutate(row.id), destructive: true }
          ]}
        />
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Razão Social *</Label>
                <Input
                  value={formData.razao_social}
                  onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                  placeholder="Razão social"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Nome Fantasia</Label>
                <Input
                  value={formData.nome_fantasia}
                  onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                  placeholder="Nome fantasia"
                />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="space-y-2">
                <Label>Inscrição Estadual</Label>
                <Input
                  value={formData.inscricao_estadual}
                  onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Contato</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  value={formData.contato?.telefone || ''}
                  onChange={(e) => setFormData({ ...formData, contato: { ...formData.contato, telefone: e.target.value } })}
                  placeholder="Telefone"
                />
                <Input
                  type="email"
                  value={formData.contato?.email || ''}
                  onChange={(e) => setFormData({ ...formData, contato: { ...formData.contato, email: e.target.value } })}
                  placeholder="Email"
                />
                <Input
                  value={formData.contato?.responsavel || ''}
                  onChange={(e) => setFormData({ ...formData, contato: { ...formData.contato, responsavel: e.target.value } })}
                  placeholder="Responsável"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Condições de Pagamento</Label>
              <Input
                value={formData.condicoes_pagamento}
                onChange={(e) => setFormData({ ...formData, condicoes_pagamento: e.target.value })}
                placeholder="Ex: 30 dias após NF"
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-40 px-3 py-2 border rounded-md"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="bloqueado">Bloqueado</option>
              </select>
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