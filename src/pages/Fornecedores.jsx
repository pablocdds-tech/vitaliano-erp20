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
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Truck, Plus, Pencil, Trash2, Upload } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import ImportarCSVModal, { IMPORT_CONFIGS } from '@/components/importacao/ImportarCSVModal';

export default function Fornecedores() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [formData, setFormData] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    contato: { email: '', telefone: '', responsavel: '' },
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
      toast.success('Fornecedor criado!');
    },
    onError: () => toast.error('Erro ao criar')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Fornecedor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      setModalOpen(false);
      resetForm();
      toast.success('Fornecedor atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Fornecedor.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      toast.success('Fornecedor excluído!');
    }
  });

  const handleBulkDelete = async (ids) => {
    if (!window.confirm(`Deseja excluir ${ids.length} fornecedor(es) selecionado(s)?`)) return;
    for (const id of ids) await base44.entities.Fornecedor.delete(id);
    queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
    toast.success(`${ids.length} fornecedor(es) excluído(s)!`);
  };

  const fornecedoresFiltrados = useMemo(() => {
    if (!filtroStatus) return fornecedores;
    return fornecedores.filter(f => f.status === filtroStatus);
  }, [fornecedores, filtroStatus]);

  const resetForm = () => {
    setFormData({
      razao_social: '',
      nome_fantasia: '',
      cnpj: '',
      contato: { email: '', telefone: '', responsavel: '' },
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
      contato: item.contato || { email: '', telefone: '', responsavel: '' },
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
        title="Fornecedores"
        subtitle="Gerencie fornecedores e condições de pagamento"
        icon={Truck}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Fornecedores' }]}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setImportarOpen(true)} className="gap-2 w-full sm:w-auto">
              <Upload className="w-4 h-4" /> Importar CSV
            </Button>
            <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" /> Novo
            </Button>
          </div>
        }
      />

      <ImportarCSVModal
        open={importarOpen}
        onClose={() => setImportarOpen(false)}
        config={IMPORT_CONFIGS.fornecedor}
      />

      {fornecedores.length === 0 && !isLoading ? (
        <EmptyState icon={Truck} title="Nenhum fornecedor" description="Cadastre seus fornecedores." actionLabel="Criar" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable
          columns={columns}
          data={fornecedoresFiltrados}
          loading={isLoading}
          searchPlaceholder="Buscar..."
          onBulkDelete={handleBulkDelete}
          filterBar={
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-9 w-36 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todos status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
                <SelectItem value="bloqueado">Bloqueado</SelectItem>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar' : 'Novo Fornecedor'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Razão Social *</Label>
                <Input value={formData.razao_social} onChange={e => setFormData({ ...formData, razao_social: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Nome Fantasia</Label>
                <Input value={formData.nome_fantasia} onChange={e => setFormData({ ...formData, nome_fantasia: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={formData.cnpj} onChange={e => setFormData({ ...formData, cnpj: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={formData.contato?.telefone || ''} onChange={e => setFormData({ ...formData, contato: { ...formData.contato, telefone: e.target.value } })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formData.contato?.email || ''} onChange={e => setFormData({ ...formData, contato: { ...formData.contato, email: e.target.value } })} />
            </div>
            <div className="space-y-2">
              <Label>Condições de Pagamento</Label>
              <Input value={formData.condicoes_pagamento} onChange={e => setFormData({ ...formData, condicoes_pagamento: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={formData.observacoes} onChange={e => setFormData({ ...formData, observacoes: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 border rounded-md">
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="bloqueado">Bloqueado</option>
              </select>
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