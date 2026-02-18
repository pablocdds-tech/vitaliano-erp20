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
import { Wrench, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Manutencao() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    numero: '',
    tipo: 'corretiva',
    prioridade: 'media',
    descricao_problema: '',
    solicitante: '',
    data_prevista: '',
    tecnico: '',
    descricao_servico: '',
    custo_mao_obra: '',
    custo_pecas: '',
    observacoes: '',
    status: 'aberta'
  });

  const { data: ordens = [], isLoading } = useQuery({
    queryKey: ['manutencao'],
    queryFn: () => base44.entities.Manutencao.list('-data_abertura', 50)
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Manutencao.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manutencao'] });
      setModalOpen(false);
      resetForm();
      toast.success('OS de manutenção criada!');
    },
    onError: () => toast.error('Erro ao criar')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Manutencao.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manutencao'] });
      setModalOpen(false);
      resetForm();
      toast.success('OS atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Manutencao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manutencao'] });
      toast.success('OS excluída!');
    }
  });

  const resetForm = () => {
    setFormData({
      numero: '',
      tipo: 'corretiva',
      prioridade: 'media',
      descricao_problema: '',
      solicitante: '',
      data_prevista: '',
      tecnico: '',
      descricao_servico: '',
      custo_mao_obra: '',
      custo_pecas: '',
      observacoes: '',
      status: 'aberta'
    });
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      numero: item.numero || '',
      tipo: item.tipo || 'corretiva',
      prioridade: item.prioridade || 'media',
      descricao_problema: item.descricao_problema || '',
      solicitante: item.solicitante || '',
      data_prevista: item.data_prevista || '',
      tecnico: item.tecnico || '',
      descricao_servico: item.descricao_servico || '',
      custo_mao_obra: item.custo_mao_obra || '',
      custo_pecas: item.custo_pecas || '',
      observacoes: item.observacoes || '',
      status: item.status || 'aberta'
    });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      custo_mao_obra: formData.custo_mao_obra ? parseFloat(formData.custo_mao_obra) : 0,
      custo_pecas: formData.custo_pecas ? parseFloat(formData.custo_pecas) : 0
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const columns = [
    {
      key: 'numero',
      label: 'OS',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-slate-800 dark:text-white">{value || '-'}</p>
          <p className="text-xs text-slate-500">{row.descricao_problema}</p>
        </div>
      )
    },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (v) => <span className="text-sm capitalize">{v?.replace(/_/g, ' ')}</span>
    },
    {
      key: 'prioridade',
      label: 'Prioridade',
      render: (v) => <StatusBadge status={v} size="sm" />
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
        title="Manutenção"
        subtitle="Gerencie ordens de serviço"
        icon={Wrench}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Operação' }, { label: 'Manutenção' }]}
        actions={
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nova OS
          </Button>
        }
      />

      {ordens.length === 0 && !isLoading ? (
        <EmptyState icon={Wrench} title="Nenhuma OS" description="Crie ordens de manutenção." actionLabel="Criar" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable columns={columns} data={ordens} loading={isLoading} searchPlaceholder="Buscar..." rowActions={(row) => [
          { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) },
          { label: 'Excluir', icon: Trash2, onClick: () => deleteMutation.mutate(row.id), destructive: true }
        ]} />
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar OS' : 'Nova Ordem de Serviço'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número</Label>
                <Input value={formData.numero} onChange={e => setFormData({ ...formData, numero: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={formData.prioridade} onValueChange={v => setFormData({ ...formData, prioridade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={formData.tipo} onValueChange={v => setFormData({ ...formData, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="preventiva">Preventiva</SelectItem>
                  <SelectItem value="corretiva">Corretiva</SelectItem>
                  <SelectItem value="preditiva">Preditiva</SelectItem>
                  <SelectItem value="emergencial">Emergencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Problema *</Label>
              <Textarea value={formData.descricao_problema} onChange={e => setFormData({ ...formData, descricao_problema: e.target.value })} rows={2} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Solicitante</Label>
                <Input value={formData.solicitante} onChange={e => setFormData({ ...formData, solicitante: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Técnico</Label>
                <Input value={formData.tecnico} onChange={e => setFormData({ ...formData, tecnico: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data Prevista</Label>
              <Input type="date" value={formData.data_prevista} onChange={e => setFormData({ ...formData, data_prevista: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descrição do Serviço</Label>
              <Textarea value={formData.descricao_servico} onChange={e => setFormData({ ...formData, descricao_servico: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Custo Mão de Obra</Label>
                <Input type="number" step="0.01" value={formData.custo_mao_obra} onChange={e => setFormData({ ...formData, custo_mao_obra: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Custo Peças</Label>
                <Input type="number" step="0.01" value={formData.custo_pecas} onChange={e => setFormData({ ...formData, custo_pecas: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={formData.observacoes} onChange={e => setFormData({ ...formData, observacoes: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aberta">Aberta</SelectItem>
                  <SelectItem value="em_analise">Em Análise</SelectItem>
                  <SelectItem value="aguardando_pecas">Aguardando Peças</SelectItem>
                  <SelectItem value="em_execucao">Em Execução</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
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