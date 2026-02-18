import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import MoneyDisplay, { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import EmptyState from '@/components/ui-custom/EmptyState';
import KPICard from '@/components/ui-custom/KPICard';
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
import { Landmark, Plus, Pencil, Trash2, TrendingDown, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function BancoVirtual() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    tipo: 'transferencia',
    valor: '',
    descricao: '',
    loja_origem_id: '',
    loja_destino_id: '',
    status: 'pendente'
  });

  const { data: transferencias = [], isLoading } = useQuery({
    queryKey: ['bancoVirtual'],
    queryFn: () => base44.entities.BancoVirtual.list('-updated_date', 50)
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.BancoVirtual.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancoVirtual'] });
      setModalOpen(false);
      resetForm();
      toast.success('Transferência registrada!');
    },
    onError: () => toast.error('Erro ao registrar')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BancoVirtual.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancoVirtual'] });
      setModalOpen(false);
      resetForm();
      toast.success('Transferência atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BancoVirtual.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancoVirtual'] });
      toast.success('Transferência excluída!');
    }
  });

  const resetForm = () => {
    setFormData({ tipo: 'transferencia', valor: '', descricao: '', loja_origem_id: '', loja_destino_id: '', status: 'pendente' });
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      tipo: item.tipo || 'transferencia',
      valor: item.valor || '',
      descricao: item.descricao || '',
      loja_origem_id: item.loja_origem_id || '',
      loja_destino_id: item.loja_destino_id || '',
      status: item.status || 'pendente'
    });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      valor: parseFloat(formData.valor),
      empresa_id: lojas[0]?.empresa_id || ''
    };

    // Validação: Loja nunca fica positiva (dívida nunca vira crédito)
    if (formData.tipo === 'transferencia' && formData.loja_origem_id) {
      const saldoLojaAtual = saldosLojas[formData.loja_origem_id] || 0;
      const saldoAposTransf = saldoLojaAtual - parseFloat(formData.valor);
      if (saldoAposTransf > 0.01) {
        toast.error('⚠️ Loja não pode ficar com saldo positivo no Banco Virtual. Dívida máxima permitida: ' + formatMoney(Math.abs(saldoLojaAtual)));
        return;
      }
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getLojaName = (id) => {
    const loja = lojas.find(l => l.id === id);
    return loja?.nome || id || '-';
  };

  // Calcula saldos no banco virtual por loja (dívida = negativo, CD = positivo)
  const saldosLojas = useMemo(() => {
    const saldos = {};
    const cd = lojas.find(l => l.tipo === 'cd');
    
    lojas.forEach(l => {
      saldos[l.id] = 0;
    });

    // Loja origem envia money (débito), loja destino recebe (crédito)
    transferencias.filter(t => t.status === 'aprovado').forEach(t => {
      if (t.loja_origem_id) saldos[t.loja_origem_id] = (saldos[t.loja_origem_id] || 0) - t.valor;
      if (t.loja_destino_id) saldos[t.loja_destino_id] = (saldos[t.loja_destino_id] || 0) + t.valor;
    });

    return saldos;
  }, [transferencias, lojas]);

  // Total que as lojas devem ao CD
  const totalDividaLojas = Object.entries(saldosLojas)
    .filter(([lojaId]) => lojaId !== lojas.find(l => l.tipo === 'cd')?.id)
    .reduce((sum, [_, saldo]) => sum + Math.max(0, -saldo), 0);

  // Lojas com maior dívida
  const lojasMaiorDivida = useMemo(() => {
    const cd = lojas.find(l => l.tipo === 'cd');
    return Object.entries(saldosLojas)
      .filter(([lojaId]) => lojaId !== cd?.id)
      .map(([lojaId, saldo]) => ({
        lojaId,
        lojanome: getLojaName(lojaId),
        divida: Math.max(0, -saldo),
      }))
      .sort((a, b) => b.divida - a.divida);
  }, [saldosLojas, lojas]);

  const columns = [
    {
      key: 'tipo',
      label: 'Tipo',
      render: (v) => <span className="text-sm font-medium capitalize">{v?.replace(/_/g, ' ')}</span>
    },
    {
      key: 'loja_origem_id',
      label: 'De',
      render: (v) => <span className="text-sm">{getLojaName(v) || '-'}</span>
    },
    {
      key: 'loja_destino_id',
      label: 'Para',
      render: (v) => <span className="text-sm">{getLojaName(v) || '-'}</span>
    },
    {
      key: 'valor',
      label: 'Valor',
      render: (v) => <MoneyDisplay value={v} size="sm" colorize />
    },
    {
      key: 'descricao',
      label: 'Descrição',
      render: (v) => <span className="text-sm text-slate-600">{v || '-'}</span>
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
        title="Banco Virtual"
        subtitle="Gerencie transferências entre lojas e CD — Dívidas e Saldos"
        icon={Landmark}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Financeiro' }, { label: 'Banco Virtual' }]}
        actions={
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nova
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title="Total Dívida (Lojas)" value={formatMoney(totalDividaLojas)} icon={TrendingDown} variant="danger" subtitle="Lojas devem ao CD" />
        <KPICard title="Lojas com Dívida" value={lojasMaiorDivida.filter(l => l.divida > 0).length} icon={AlertCircle} variant="warning" />
        <KPICard title="Transações Aprovadas" value={transferencias.filter(t => t.status === 'aprovado').length} icon={Landmark} variant="success" />
      </div>

      {/* Ranking de dívidas */}
      {lojasMaiorDivida.some(l => l.divida > 0) && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            Ranking de Dívidas
          </h3>
          <div className="space-y-2">
            {lojasMaiorDivida.filter(l => l.divida > 0).map((item, idx) => (
              <div key={item.lojaId} className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-red-600 text-sm">#{idx + 1}</span>
                  <span className="font-medium text-slate-800 dark:text-white">{item.lojanome}</span>
                </div>
                <span className="font-bold text-red-600">{formatMoney(item.divida)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {transferencias.length === 0 && !isLoading ? (
        <EmptyState icon={Landmark} title="Sem transferências" description="Registre suas transferências." actionLabel="Criar" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable columns={columns} data={transferencias} loading={isLoading} searchPlaceholder="Buscar..." rowActions={(row) => [
          { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) },
          { label: 'Excluir', icon: Trash2, onClick: () => deleteMutation.mutate(row.id), destructive: true }
        ]} />
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar' : 'Nova Transferência'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={formData.tipo} onValueChange={v => setFormData({ ...formData, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposito">Depósito</SelectItem>
                  <SelectItem value="saque">Saque</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="ajuste">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor *</Label>
              <Input type="number" step="0.01" value={formData.valor} onChange={e => setFormData({ ...formData, valor: e.target.value })} required />
            </div>
            {formData.tipo === 'transferencia' && (
              <>
                <div className="space-y-2">
                  <Label>Loja Origem</Label>
                  <Select value={formData.loja_origem_id} onValueChange={v => setFormData({ ...formData, loja_origem_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Loja Destino</Label>
                  <Select value={formData.loja_destino_id} onValueChange={v => setFormData({ ...formData, loja_destino_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={formData.descricao} onChange={e => setFormData({ ...formData, descricao: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="rejeitado">Rejeitado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
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