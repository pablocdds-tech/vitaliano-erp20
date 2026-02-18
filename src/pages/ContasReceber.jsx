import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import MoneyDisplay from '@/components/ui-custom/MoneyDisplay';
import KPICard from '@/components/ui-custom/KPICard';
import EmptyState from '@/components/ui-custom/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, Plus, CheckCircle2, Clock, AlertTriangle, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const EMPTY_FORM = {
  loja_id: '', cliente_nome: '', descricao: '', origem: 'venda',
  documento_numero: '', data_emissao: '', data_vencimento: '',
  valor_original: 0, forma_recebimento: 'dinheiro', observacoes: '', status: 'pendente'
};

export default function ContasReceber() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [statusFiltro, setStatusFiltro] = useState('all');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['contas-receber'],
    queryFn: () => base44.entities.ContaReceber.list('-data_vencimento', 100)
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ContaReceber.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contas-receber'] }); closeModal(); toast.success('Conta criada!'); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ContaReceber.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contas-receber'] }); closeModal(); toast.success('Conta atualizada!'); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContaReceber.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contas-receber'] }); toast.success('Conta removida!'); }
  });

  const closeModal = () => { setModalOpen(false); setEditing(null); setFormData(EMPTY_FORM); };

  const openEdit = (conta) => {
    setEditing(conta);
    setFormData({ ...conta });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    editing ? updateMutation.mutate({ id: editing.id, data: formData }) : createMutation.mutate(formData);
  };

  const handleReceberClick = (conta) => {
    updateMutation.mutate({
      id: conta.id,
      data: { status: 'recebido', data_recebimento: format(new Date(), 'yyyy-MM-dd'), valor_recebido: conta.valor_original }
    });
  };

  const getLoja = (id) => lojas.find(l => l.id === id);

  const contasFiltradas = contas.filter(c => {
    if (statusFiltro !== 'all' && c.status !== statusFiltro) return false;
    if (dataInicio && c.data_vencimento < dataInicio) return false;
    if (dataFim && c.data_vencimento > dataFim) return false;
    return true;
  });

  const totalPendente = contasFiltradas.filter(c => c.status === 'pendente').reduce((s, c) => s + (c.valor_original || 0), 0);
  const totalRecebido = contasFiltradas.filter(c => c.status === 'recebido').reduce((s, c) => s + (c.valor_recebido || c.valor_original || 0), 0);
  const totalVencido = contasFiltradas.filter(c => c.status === 'vencido' || (c.status === 'pendente' && new Date(c.data_vencimento) < new Date())).length;

  const columns = [
    {
      key: 'descricao', label: 'Descrição', sortable: true,
      render: (v, row) => (
        <div>
          <p className="font-medium text-slate-800 dark:text-white text-sm">{v}</p>
          <p className="text-xs text-slate-500">{row.cliente_nome || '-'}</p>
        </div>
      )
    },
    {
      key: 'loja_id', label: 'Loja',
      render: (v) => <span className="text-sm">{getLoja(v)?.nome || '-'}</span>
    },
    {
      key: 'origem', label: 'Origem',
      render: (v) => <span className="text-xs capitalize px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">{v?.replace('_', ' ')}</span>
    },
    {
      key: 'data_vencimento', label: 'Vencimento', sortable: true,
      render: (v) => {
        const vencido = v && new Date(v) < new Date();
        return <span className={vencido ? 'text-red-600 font-medium text-sm' : 'text-sm'}>{v ? format(new Date(v), 'dd/MM/yyyy') : '-'}</span>;
      }
    },
    { key: 'valor_original', label: 'Valor', sortable: true, render: (v) => <MoneyDisplay value={v || 0} size="sm" /> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a Receber"
        subtitle="Gerencie seus títulos a receber"
        icon={Wallet}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Contas a Receber' }]}
        actions={<Button onClick={() => setModalOpen(true)} className="gap-2"><Plus className="w-4 h-4" />Nova Conta</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title="A Receber" value={`R$ ${(totalPendente/1000).toFixed(1)}K`} icon={Clock} variant="info" subtitle="pendentes" />
        <KPICard title="Recebido" value={`R$ ${(totalRecebido/1000).toFixed(1)}K`} icon={CheckCircle2} variant="success" subtitle="no período" />
        <KPICard title="Vencidos" value={totalVencido} icon={AlertTriangle} variant={totalVencido > 0 ? 'danger' : 'default'} subtitle="em atraso" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Todos os status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="recebido">Recebido</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-40" />
        <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-40" />
      </div>

      {contas.length === 0 && !isLoading ? (
        <EmptyState icon={Wallet} title="Nenhuma conta a receber" description="Cadastre seus títulos a receber." actionLabel="Nova Conta" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable
          columns={columns}
          data={contasFiltradas}
          loading={isLoading}
          searchPlaceholder="Buscar contas..."
          emptyIcon={Wallet}
          emptyTitle="Nenhuma conta encontrada"
          rowActions={(row) => [
            { label: 'Editar', onClick: () => openEdit(row) },
            ...(row.status === 'pendente' ? [{ label: 'Marcar Recebido', icon: CheckCircle2, onClick: () => handleReceberClick(row) }] : []),
            { label: 'Excluir', onClick: () => deleteMutation.mutate(row.id), destructive: true }
          ]}
        />
      )}

      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar Conta' : 'Nova Conta a Receber'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 col-span-2">
                <Label>Descrição *</Label>
                <Input value={formData.descricao} onChange={e => setFormData({ ...formData, descricao: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Cliente</Label>
                <Input value={formData.cliente_nome} onChange={e => setFormData({ ...formData, cliente_nome: e.target.value })} placeholder="Nome do cliente" />
              </div>
              <div className="space-y-1">
                <Label>Loja</Label>
                <Select value={formData.loja_id} onValueChange={v => setFormData({ ...formData, loja_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Origem</Label>
                <Select value={formData.origem} onValueChange={v => setFormData({ ...formData, origem: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venda">Venda</SelectItem>
                    <SelectItem value="servico">Serviço</SelectItem>
                    <SelectItem value="aluguel">Aluguel</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" min="0" value={formData.valor_original} onChange={e => setFormData({ ...formData, valor_original: parseFloat(e.target.value) || 0 })} required />
              </div>
              <div className="space-y-1">
                <Label>Data Emissão</Label>
                <Input type="date" value={formData.data_emissao} onChange={e => setFormData({ ...formData, data_emissao: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Data Vencimento *</Label>
                <Input type="date" value={formData.data_vencimento} onChange={e => setFormData({ ...formData, data_vencimento: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Forma de Recebimento</Label>
                <Select value={formData.forma_recebimento} onValueChange={v => setFormData({ ...formData, forma_recebimento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                    <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Observações</Label>
                <Textarea value={formData.observacoes} onChange={e => setFormData({ ...formData, observacoes: e.target.value })} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}