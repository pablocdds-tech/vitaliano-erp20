import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import MoneyDisplay from '@/components/ui-custom/MoneyDisplay';
import KPICard from '@/components/ui-custom/KPICard';
import AjusteSaldosTab from '@/components/movimentacoes/AjusteSaldosTab';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  ArrowLeftRight, 
  ArrowUpRight, 
  ArrowDownRight, 
  Package,
  TrendingUp,
  TrendingDown,
  FileText,
  Store,
  BarChart3
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export default function Movimentacoes() {
  const [lojaFiltro, setLojaFiltro] = useState('all');
  const [tipoFiltro, setTipoFiltro] = useState('all');
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [viewModal, setViewModal] = useState(null);

  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ['movimentacoes-estoque'],
    queryFn: () => base44.entities.MovimentacaoEstoque.list('-created_date', 200)
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list()
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const getProduto = (id) => produtos.find(p => p.id === id);
  const getLoja = (id) => lojas.find(l => l.id === id);

  // Filtros
  const movimentacoesFiltradas = movimentacoes.filter(m => {
    if (lojaFiltro !== 'all' && m.loja_id !== lojaFiltro) return false;
    if (tipoFiltro !== 'all' && m.tipo !== tipoFiltro) return false;
    if (dataInicio && m.created_date < new Date(dataInicio).toISOString()) return false;
    if (dataFim && m.created_date > new Date(dataFim + 'T23:59:59').toISOString()) return false;
    return true;
  });

  // Cálculos
  const entradas = movimentacoesFiltradas.filter(m => ['entrada', 'producao', 'ajuste'].includes(m.tipo) && m.quantidade > 0);
  const saidas = movimentacoesFiltradas.filter(m => ['saida', 'perda', 'transferencia'].includes(m.tipo) || m.quantidade < 0);
  const totalEntradas = entradas.reduce((sum, m) => sum + Math.abs(m.quantidade || 0), 0);
  const totalSaidas = saidas.reduce((sum, m) => sum + Math.abs(m.quantidade || 0), 0);

  const tipoIcons = {
    entrada: { icon: ArrowDownRight, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    saida: { icon: ArrowUpRight, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
    ajuste: { icon: ArrowLeftRight, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    transferencia: { icon: ArrowLeftRight, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    producao: { icon: Package, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    perda: { icon: TrendingDown, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    contagem: { icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30' }
  };

  const columns = [
    {
      key: 'tipo',
      label: 'Tipo',
      render: (value, row) => {
        const config = tipoIcons[value] || tipoIcons.ajuste;
        const Icon = config.icon;
        return (
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bg}`}>
              <Icon className={`w-4 h-4 ${config.color}`} />
            </div>
            <div>
              <p className="font-medium text-slate-800 dark:text-white capitalize">{value?.replace(/_/g, ' ')}</p>
              <p className="text-xs text-slate-500">
                {format(new Date(row.created_date), 'dd/MM/yyyy HH:mm')}
              </p>
            </div>
          </div>
        );
      }
    },
    {
      key: 'produto_id',
      label: 'Produto',
      render: (value) => {
        const produto = getProduto(value);
        return (
          <div>
            <p className="font-medium text-slate-800 dark:text-white text-sm">{produto?.nome || '-'}</p>
            <p className="text-xs text-slate-500">{produto?.codigo || '-'}</p>
          </div>
        );
      }
    },
    {
      key: 'loja_id',
      label: 'Loja',
      render: (value) => {
        const loja = getLoja(value);
        return (
          <div className="flex items-center gap-2 text-sm">
            <Store className="w-4 h-4 text-slate-400" />
            {loja?.nome || '-'}
          </div>
        );
      }
    },
    {
      key: 'quantidade',
      label: 'Quantidade',
      sortable: true,
      render: (value, row) => {
        const produto = getProduto(row.produto_id);
        const isEntrada = value > 0;
        return (
          <span className={`font-medium ${isEntrada ? 'text-emerald-600' : 'text-red-600'}`}>
            {isEntrada ? '+' : ''}{value || 0} {produto?.unidade_medida || 'un'}
          </span>
        );
      }
    },
    {
      key: 'custo_unitario',
      label: 'Custo Unit.',
      render: (value) => <MoneyDisplay value={value || 0} size="xs" />
    },
    {
      key: 'custo_total',
      label: 'Custo Total',
      sortable: true,
      render: (value) => <MoneyDisplay value={value || 0} size="sm" />
    },
    {
      key: 'documento_tipo',
      label: 'Documento',
      render: (value) => value ? <StatusBadge status={value} size="xs" /> : '-'
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movimentações de Estoque"
        subtitle="Histórico completo de entradas e saídas"
        icon={ArrowLeftRight}
        breadcrumbs={[
          { label: 'Dashboard', href: 'Dashboard' },
          { label: 'Movimentações' }
        ]}
      />

      {/* Tabs */}
      <Tabs defaultValue="movimentacoes" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="movimentacoes" className="gap-2">
            <ArrowLeftRight className="w-4 h-4" />
            Movimentações
          </TabsTrigger>
          <TabsTrigger value="ajustes" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Ajuste de Saldos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="movimentacoes" className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Total Movimentações"
          value={movimentacoesFiltradas.length}
          icon={ArrowLeftRight}
          variant="default"
          subtitle="no período"
        />
        <KPICard
          title="Entradas"
          value={entradas.length}
          icon={ArrowDownRight}
          variant="success"
          subtitle={`${totalEntradas.toFixed(0)} unidades`}
        />
        <KPICard
          title="Saídas"
          value={saidas.length}
          icon={ArrowUpRight}
          variant="danger"
          subtitle={`${totalSaidas.toFixed(0)} unidades`}
        />
        <KPICard
          title="Saldo Líquido"
          value={`${(totalEntradas - totalSaidas).toFixed(0)}`}
          icon={TrendingUp}
          variant="info"
          subtitle="unidades"
        />
      </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Select value={lojaFiltro} onValueChange={setLojaFiltro}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as lojas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as lojas</SelectItem>
                {lojas.map((loja) => (
                  <SelectItem key={loja.id} value={loja.id}>{loja.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
                <SelectItem value="ajuste">Ajuste</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="producao">Produção</SelectItem>
                <SelectItem value="perda">Perda</SelectItem>
                <SelectItem value="contagem">Contagem</SelectItem>
              </SelectContent>
            </Select>

            <div>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>

            <div>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
          </div>

          {/* Tabela */}
          <DataTable
            columns={columns}
            data={movimentacoesFiltradas}
            loading={isLoading}
            searchPlaceholder="Buscar movimentações..."
            emptyIcon={ArrowLeftRight}
            emptyTitle="Nenhuma movimentação encontrada"
            onRowClick={(row) => setViewModal(row)}
          />

          {/* Modal de Detalhes */}
          <Dialog open={!!viewModal} onOpenChange={() => setViewModal(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Detalhes da Movimentação</DialogTitle>
              </DialogHeader>
              
              {viewModal && (() => {
                const produto = getProduto(viewModal.produto_id);
                const loja = getLoja(viewModal.loja_id);
                const lojaDestino = getLoja(viewModal.loja_destino_id);
                const config = tipoIcons[viewModal.tipo] || tipoIcons.ajuste;
                const Icon = config.icon;
                
                return (
                  <div className="space-y-4">
                    <div className={`flex items-center gap-3 p-4 rounded-lg ${config.bg}`}>
                      <Icon className={`w-6 h-6 ${config.color}`} />
                      <div>
                        <p className="font-semibold capitalize">{viewModal.tipo?.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-slate-600">
                          {format(new Date(viewModal.created_date), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500">Produto</p>
                        <p className="font-medium">{produto?.nome || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Loja</p>
                        <p className="font-medium">{loja?.nome || '-'}</p>
                      </div>
                      {lojaDestino && (
                        <div>
                          <p className="text-xs text-slate-500">Loja Destino</p>
                          <p className="font-medium">{lojaDestino.nome}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-slate-500">Quantidade</p>
                        <p className={`text-2xl font-bold ${viewModal.quantidade > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {viewModal.quantidade > 0 ? '+' : ''}{viewModal.quantidade || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Quantidade Anterior</p>
                        <p className="font-medium">{viewModal.quantidade_anterior || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Quantidade Posterior</p>
                        <p className="font-medium">{viewModal.quantidade_posterior || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Custo Unitário</p>
                        <MoneyDisplay value={viewModal.custo_unitario || 0} />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Custo Total</p>
                        <MoneyDisplay value={viewModal.custo_total || 0} />
                      </div>
                      {viewModal.documento_tipo && (
                        <div className="col-span-2">
                          <p className="text-xs text-slate-500">Documento</p>
                          <div className="flex items-center gap-2 mt-1">
                            <StatusBadge status={viewModal.documento_tipo} />
                            {viewModal.documento_id && (
                              <span className="text-sm text-slate-600">ID: {viewModal.documento_id.substring(0, 8)}...</span>
                            )}
                          </div>
                        </div>
                      )}
                      {viewModal.observacao && (
                        <div className="col-span-2">
                          <p className="text-xs text-slate-500">Observação</p>
                          <p className="text-sm text-slate-600 mt-1">{viewModal.observacao}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="ajustes">
          <AjusteSaldosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}