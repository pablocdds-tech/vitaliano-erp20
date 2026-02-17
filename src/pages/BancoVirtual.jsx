import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import MoneyDisplay, { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import KPICard from '@/components/ui-custom/KPICard';
import EmptyState from '@/components/ui-custom/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { 
  PiggyBank, 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight, 
  ArrowLeftRight,
  Building2,
  Store,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function BancoVirtual() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'transferencia',
    loja_origem_id: '',
    loja_destino_id: '',
    valor: 0,
    descricao: ''
  });

  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ['banco-virtual'],
    queryFn: () => base44.entities.BancoVirtual.list('-created_date', 100)
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Criar movimentação
      const mov = await base44.entities.BancoVirtual.create(data);
      
      // Atualizar saldos das lojas
      if (data.loja_origem_id) {
        const lojaOrigem = lojas.find(l => l.id === data.loja_origem_id);
        if (lojaOrigem) {
          await base44.entities.Loja.update(data.loja_origem_id, {
            saldo_banco_virtual: (lojaOrigem.saldo_banco_virtual || 0) - data.valor
          });
        }
      }
      
      if (data.loja_destino_id) {
        const lojaDestino = lojas.find(l => l.id === data.loja_destino_id);
        if (lojaDestino) {
          await base44.entities.Loja.update(data.loja_destino_id, {
            saldo_banco_virtual: (lojaDestino.saldo_banco_virtual || 0) + data.valor
          });
        }
      }
      
      return mov;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banco-virtual'] });
      queryClient.invalidateQueries({ queryKey: ['lojas'] });
      setModalOpen(false);
      resetForm();
      toast.success('Operação realizada com sucesso!');
    },
    onError: () => toast.error('Erro ao realizar operação')
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.BancoVirtual.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banco-virtual'] });
      toast.success('Operação atualizada!');
    }
  });

  const resetForm = () => {
    setFormData({
      tipo: 'transferencia',
      loja_origem_id: '',
      loja_destino_id: '',
      valor: 0,
      descricao: ''
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      status: 'pendente'
    });
  };

  const getLoja = (id) => lojas.find(l => l.id === id);
  
  const cd = lojas.find(l => l.tipo === 'cd');
  const lojasOperacionais = lojas.filter(l => l.tipo === 'loja');
  
  const saldoTotalLojas = lojasOperacionais.reduce((sum, l) => sum + (l.saldo_banco_virtual || 0), 0);
  const pendentes = movimentacoes.filter(m => m.status === 'pendente').length;

  const tipoIcons = {
    deposito: <ArrowDownRight className="w-4 h-4 text-emerald-600" />,
    saque: <ArrowUpRight className="w-4 h-4 text-red-600" />,
    transferencia: <ArrowLeftRight className="w-4 h-4 text-blue-600" />,
    ajuste: <PiggyBank className="w-4 h-4 text-amber-600" />
  };

  const columns = [
    {
      key: 'tipo',
      label: 'Operação',
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            value === 'deposito' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
            value === 'saque' ? 'bg-red-100 dark:bg-red-900/30' :
            value === 'transferencia' ? 'bg-blue-100 dark:bg-blue-900/30' :
            'bg-amber-100 dark:bg-amber-900/30'
          }`}>
            {tipoIcons[value]}
          </div>
          <div>
            <p className="font-medium text-slate-800 dark:text-white capitalize">{value}</p>
            <p className="text-xs text-slate-500">
              {format(new Date(row.created_date), 'dd/MM/yyyy HH:mm')}
            </p>
          </div>
        </div>
      )
    },
    {
      key: 'loja_origem_id',
      label: 'De',
      render: (value) => {
        const loja = getLoja(value);
        if (!loja) return '-';
        return (
          <div className="flex items-center gap-2 text-sm">
            {loja.tipo === 'cd' ? (
              <Building2 className="w-4 h-4 text-indigo-500" />
            ) : (
              <Store className="w-4 h-4 text-teal-500" />
            )}
            {loja.nome}
          </div>
        );
      }
    },
    {
      key: 'loja_destino_id',
      label: 'Para',
      render: (value) => {
        const loja = getLoja(value);
        if (!loja) return '-';
        return (
          <div className="flex items-center gap-2 text-sm">
            {loja.tipo === 'cd' ? (
              <Building2 className="w-4 h-4 text-indigo-500" />
            ) : (
              <Store className="w-4 h-4 text-teal-500" />
            )}
            {loja.nome}
          </div>
        );
      }
    },
    {
      key: 'valor',
      label: 'Valor',
      sortable: true,
      render: (value) => <MoneyDisplay value={value || 0} size="sm" />
    },
    {
      key: 'descricao',
      label: 'Descrição',
      render: (value) => (
        <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[200px] block">
          {value || '-'}
        </span>
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
        title="Banco Virtual"
        subtitle="Gerencie transferências entre CD e lojas"
        icon={PiggyBank}
        breadcrumbs={[
          { label: 'Dashboard', href: 'Dashboard' },
          { label: 'Banco Virtual' }
        ]}
        actions={
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Operação
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Saldo CD"
          value={formatMoney(cd?.saldo_banco_virtual || 0)}
          icon={Building2}
          variant="info"
        />
        <KPICard
          title="Total em Lojas"
          value={formatMoney(saldoTotalLojas)}
          icon={Store}
          variant="success"
        />
        <KPICard
          title="Movimentações"
          value={movimentacoes.length}
          icon={ArrowLeftRight}
          variant="default"
          subtitle="últimos 30 dias"
        />
        <KPICard
          title="Pendentes"
          value={pendentes}
          icon={Clock}
          variant={pendentes > 0 ? 'warning' : 'default'}
          subtitle="aguardando aprovação"
        />
      </div>

      {/* Saldos por Loja */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Saldos por Unidade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {lojas.map((loja) => (
              <div 
                key={loja.id}
                className={`p-4 rounded-xl border ${
                  loja.tipo === 'cd' 
                    ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/20'
                    : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {loja.tipo === 'cd' ? (
                    <Building2 className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <Store className="w-4 h-4 text-slate-500" />
                  )}
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                    {loja.nome}
                  </span>
                </div>
                <MoneyDisplay 
                  value={loja.saldo_banco_virtual || 0} 
                  size="lg" 
                  colorize 
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Movimentações */}
      {movimentacoes.length === 0 && !isLoading ? (
        <EmptyState
          icon={PiggyBank}
          title="Nenhuma movimentação"
          description="Realize sua primeira operação de banco virtual."
          actionLabel="Nova Operação"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={movimentacoes}
          loading={isLoading}
          searchPlaceholder="Buscar movimentações..."
          emptyIcon={PiggyBank}
          emptyTitle="Nenhuma movimentação encontrada"
          rowActions={(row) => row.status === 'pendente' ? [
            { 
              label: 'Aprovar', 
              icon: CheckCircle2, 
              onClick: () => approveMutation.mutate({ id: row.id, status: 'aprovado' }) 
            },
            { 
              label: 'Rejeitar', 
              icon: XCircle, 
              onClick: () => approveMutation.mutate({ id: row.id, status: 'rejeitado' }),
              destructive: true 
            }
          ] : []}
        />
      )}

      {/* Modal de Nova Operação */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Operação</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Operação *</Label>
              <Select 
                value={formData.tipo} 
                onValueChange={(v) => setFormData({ ...formData, tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="deposito">Depósito</SelectItem>
                  <SelectItem value="saque">Saque</SelectItem>
                  <SelectItem value="ajuste">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formData.tipo === 'transferencia' || formData.tipo === 'saque') && (
              <div className="space-y-2">
                <Label>De (Origem) *</Label>
                <Select 
                  value={formData.loja_origem_id} 
                  onValueChange={(v) => setFormData({ ...formData, loja_origem_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {lojas.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.tipo === 'cd' ? '🏢' : '🏪'} {l.nome} ({formatMoney(l.saldo_banco_virtual || 0)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(formData.tipo === 'transferencia' || formData.tipo === 'deposito') && (
              <div className="space-y-2">
                <Label>Para (Destino) *</Label>
                <Select 
                  value={formData.loja_destino_id} 
                  onValueChange={(v) => setFormData({ ...formData, loja_destino_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {lojas
                      .filter(l => l.id !== formData.loja_origem_id)
                      .map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.tipo === 'cd' ? '🏢' : '🏪'} {l.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })}
                min="0.01"
                step="0.01"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Motivo da operação..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Realizar Operação
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}