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
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  TrendingUp, 
  Upload, 
  Loader2, 
  Sparkles,
  ShoppingBag,
  DollarSign,
  Percent,
  Calendar
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';

const canaisConfig = {
  balcao: { label: 'Balcão', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' },
  delivery: { label: 'Delivery', color: 'bg-green-100 text-green-700 dark:bg-green-900/30' },
  ifood: { label: 'iFood', color: 'bg-red-100 text-red-700 dark:bg-red-900/30' },
  rappi: { label: 'Rappi', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30' },
  uber_eats: { label: 'Uber Eats', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' },
  outros: { label: 'Outros', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800' }
};

export default function Vendas() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [canalFiltro, setCanalFiltro] = useState('all');
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [viewModal, setViewModal] = useState(null);

  const { data: vendas = [], isLoading } = useQuery({
    queryKey: ['vendas'],
    queryFn: () => base44.entities.Venda.list('-data', 200)
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const importMutation = useMutation({
    mutationFn: async (vendasData) => {
      const results = [];
      for (const venda of vendasData) {
        const result = await base44.entities.Venda.create(venda);
        results.push(result);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendas'] });
      toast.success('Vendas importadas com sucesso!');
    }
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    
    try {
      // 1. Upload do arquivo
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      setUploading(false);
      setProcessing(true);
      
      // 2. Processar com IA
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analise este arquivo de vendas e extraia os dados.
        
O arquivo pode estar em formato CSV ou JSON e contém vendas de plataformas como iFood, Rappi, Uber Eats ou balcão próprio.

Extraia e retorne um JSON com um array de vendas, onde cada venda deve ter:
- data: data da venda no formato YYYY-MM-DD
- canal: canal de venda (balcao, delivery, ifood, rappi, uber_eats, outros)
- valor_bruto: valor bruto da venda
- valor_desconto: valor de desconto (se houver, senão 0)
- valor_taxa_entrega: taxa de entrega (se houver, senão 0)
- valor_comissao_plataforma: comissão da plataforma (se houver, senão 0)
- valor_liquido: valor líquido após descontos e comissões
- quantidade_pedidos: quantidade de pedidos (default 1 se for venda única)
- ticket_medio: ticket médio (valor_bruto / quantidade_pedidos)
- observacoes: qualquer observação relevante

IMPORTANTE: 
- Se o arquivo tiver vendas agregadas por dia, use quantidade_pedidos para indicar quantos pedidos
- Calcule o valor_liquido corretamente: valor_bruto - valor_desconto - valor_comissao_plataforma
- Para iFood/Rappi/Uber, geralmente há comissão de 20-30%
- Normalize o nome do canal para um dos valores aceitos`,
        response_json_schema: {
          type: 'object',
          properties: {
            vendas: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  data: { type: 'string' },
                  canal: { type: 'string' },
                  valor_bruto: { type: 'number' },
                  valor_desconto: { type: 'number' },
                  valor_taxa_entrega: { type: 'number' },
                  valor_comissao_plataforma: { type: 'number' },
                  valor_liquido: { type: 'number' },
                  quantidade_pedidos: { type: 'number' },
                  ticket_medio: { type: 'number' },
                  observacoes: { type: 'string' }
                }
              }
            }
          }
        },
        file_urls: [file_url]
      });

      setProcessing(false);

      if (result?.vendas && result.vendas.length > 0) {
        // 3. Adicionar loja_id a todas as vendas
        const loja = lojas[0]; // Usa a primeira loja disponível
        const vendasComLoja = result.vendas.map(v => ({
          ...v,
          loja_id: loja?.id
        }));

        // 4. Importar vendas
        await importMutation.mutateAsync(vendasComLoja);
        
        // 5. Registrar ação na IA
        await base44.entities.AcaoIA.create({
          tipo_acao: 'processar_vendas',
          descricao: `Importação de ${result.vendas.length} vendas via arquivo`,
          status: 'concluida',
          entrada: { file_url },
          saida: { total_vendas: result.vendas.length }
        });
      } else {
        toast.error('Nenhuma venda encontrada no arquivo');
      }
    } catch (error) {
      setUploading(false);
      setProcessing(false);
      toast.error('Erro ao processar arquivo: ' + error.message);
    }
  };

  // Filtros
  const vendasFiltradas = vendas.filter(v => {
    if (canalFiltro !== 'all' && v.canal !== canalFiltro) return false;
    if (dataInicio && v.data < dataInicio) return false;
    if (dataFim && v.data > dataFim) return false;
    return true;
  });

  // Cálculos
  const totalVendas = vendasFiltradas.reduce((sum, v) => sum + (v.valor_liquido || 0), 0);
  const totalPedidos = vendasFiltradas.reduce((sum, v) => sum + (v.quantidade_pedidos || 0), 0);
  const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0;
  const totalComissao = vendasFiltradas.reduce((sum, v) => sum + (v.valor_comissao_plataforma || 0), 0);
  const percentualComissao = totalVendas > 0 ? (totalComissao / (totalVendas + totalComissao)) * 100 : 0;

  const getLoja = (id) => lojas.find(l => l.id === id);

  const columns = [
    {
      key: 'data',
      label: 'Data',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          {value ? format(new Date(value), 'dd/MM/yyyy') : '-'}
        </div>
      )
    },
    {
      key: 'canal',
      label: 'Canal',
      render: (value) => {
        const config = canaisConfig[value] || canaisConfig.outros;
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
            {config.label}
          </span>
        );
      }
    },
    {
      key: 'quantidade_pedidos',
      label: 'Pedidos',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-1.5">
          <ShoppingBag className="w-4 h-4 text-slate-400" />
          <span className="font-medium">{value || 0}</span>
        </div>
      )
    },
    {
      key: 'valor_bruto',
      label: 'Valor Bruto',
      sortable: true,
      render: (value) => <MoneyDisplay value={value || 0} size="sm" />
    },
    {
      key: 'valor_comissao_plataforma',
      label: 'Comissão',
      render: (value) => <MoneyDisplay value={value || 0} size="xs" colorize />
    },
    {
      key: 'valor_liquido',
      label: 'Valor Líquido',
      sortable: true,
      render: (value) => <MoneyDisplay value={value || 0} size="sm" />
    },
    {
      key: 'ticket_medio',
      label: 'Ticket Médio',
      sortable: true,
      render: (value) => <MoneyDisplay value={value || 0} size="xs" />
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendas"
        subtitle="Importe e visualize vendas de todas as plataformas"
        icon={TrendingUp}
        breadcrumbs={[
          { label: 'Dashboard', href: 'Dashboard' },
          { label: 'Vendas' }
        ]}
        actions={
          <div>
            <input
              type="file"
              accept=".csv,.json,.xlsx"
              onChange={handleFileUpload}
              className="hidden"
              id="vendas-upload"
              disabled={uploading || processing}
            />
            <label htmlFor="vendas-upload">
              <Button asChild disabled={uploading || processing}>
                <span className="cursor-pointer gap-2">
                  {uploading || processing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploading ? 'Enviando...' : processing ? 'Processando IA...' : 'Importar Vendas'}
                </span>
              </Button>
            </label>
          </div>
        }
      />

      {/* Banner de Upload com IA */}
      {vendas.length === 0 && !isLoading && (
        <Card className="border-2 border-dashed border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-2xl bg-purple-100 dark:bg-purple-900/30">
                <Sparkles className="w-8 h-8 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
                  Importe vendas com IA
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg">
                  Envie arquivos CSV ou JSON de iFood, Rappi, Uber Eats ou qualquer plataforma.
                  Nossa IA processa automaticamente e cria os registros de vendas.
                </p>
              </div>
              <input
                type="file"
                accept=".csv,.json,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
                id="vendas-upload-hero"
                disabled={uploading || processing}
              />
              <label htmlFor="vendas-upload-hero">
                <Button size="lg" className="gap-2 cursor-pointer" disabled={uploading || processing}>
                  {uploading || processing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {uploading ? 'Enviando...' : 'Processando com IA...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Começar Importação
                    </>
                  )}
                </Button>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {vendas.length > 0 && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KPICard
              title="Total de Vendas"
              value={formatMoney(totalVendas)}
              icon={DollarSign}
              variant="success"
              subtitle={`${vendasFiltradas.length} registros`}
            />
            <KPICard
              title="Total de Pedidos"
              value={totalPedidos}
              icon={ShoppingBag}
              variant="info"
              subtitle="no período"
            />
            <KPICard
              title="Ticket Médio"
              value={formatMoney(ticketMedio)}
              icon={TrendingUp}
              variant="default"
              subtitle="por pedido"
            />
            <KPICard
              title="Comissões"
              value={formatMoney(totalComissao)}
              icon={Percent}
              variant="warning"
              subtitle={`${percentualComissao.toFixed(1)}% do total`}
            />
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select value={canalFiltro} onValueChange={setCanalFiltro}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os canais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os canais</SelectItem>
                {Object.entries(canaisConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />

            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>

          {/* Tabela */}
          <DataTable
            columns={columns}
            data={vendasFiltradas}
            loading={isLoading}
            searchPlaceholder="Buscar vendas..."
            emptyIcon={TrendingUp}
            emptyTitle="Nenhuma venda encontrada"
            onRowClick={(row) => setViewModal(row)}
          />
        </>
      )}

      {/* Modal de Detalhes */}
      <Dialog open={!!viewModal} onOpenChange={() => setViewModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da Venda</DialogTitle>
          </DialogHeader>
          
          {viewModal && (() => {
            const loja = getLoja(viewModal.loja_id);
            const canalConfig = canaisConfig[viewModal.canal] || canaisConfig.outros;
            
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Data</p>
                    <p className="font-medium">
                      {viewModal.data ? format(new Date(viewModal.data), 'dd/MM/yyyy') : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Canal</p>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${canalConfig.color}`}>
                      {canalConfig.label}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Loja</p>
                    <p className="font-medium">{loja?.nome || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Quantidade de Pedidos</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">
                      {viewModal.quantidade_pedidos || 0}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="text-sm font-medium mb-3">Valores</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Valor Bruto:</span>
                      <MoneyDisplay value={viewModal.valor_bruto || 0} />
                    </div>
                    {viewModal.valor_desconto > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Desconto:</span>
                        <MoneyDisplay value={-(viewModal.valor_desconto || 0)} colorize />
                      </div>
                    )}
                    {viewModal.valor_taxa_entrega > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Taxa de Entrega:</span>
                        <MoneyDisplay value={viewModal.valor_taxa_entrega || 0} />
                      </div>
                    )}
                    {viewModal.valor_comissao_plataforma > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Comissão Plataforma:</span>
                        <MoneyDisplay value={-(viewModal.valor_comissao_plataforma || 0)} colorize />
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-sm font-medium">Valor Líquido:</span>
                      <MoneyDisplay value={viewModal.valor_liquido || 0} size="lg" />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Ticket Médio:</span>
                      <MoneyDisplay value={viewModal.ticket_medio || 0} />
                    </div>
                  </div>
                </div>

                {viewModal.formas_pagamento && viewModal.formas_pagamento.length > 0 && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <h4 className="text-sm font-medium mb-3">Formas de Pagamento</h4>
                    <div className="space-y-2">
                      {viewModal.formas_pagamento.map((fp, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="capitalize">{fp.forma?.replace(/_/g, ' ')}</span>
                          <MoneyDisplay value={fp.valor || 0} size="sm" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewModal.observacoes && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-500 mb-1">Observações</p>
                    <p className="text-sm text-slate-600">{viewModal.observacoes}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}