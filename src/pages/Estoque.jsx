import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import MoneyDisplay from '@/components/ui-custom/MoneyDisplay';
import KPICard from '@/components/ui-custom/KPICard';
import { Button } from '@/components/ui/button';
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
import { Boxes, Package, AlertTriangle, TrendingDown, TrendingUp, Tags, Store } from 'lucide-react';
import { format } from 'date-fns';

export default function Estoque() {
  const [lojaFiltro, setLojaFiltro] = useState('all');
  const [categoriaFiltro, setCategoriaFiltro] = useState('all');
  const [viewModal, setViewModal] = useState(null);

  const { data: estoques = [], isLoading: loadingEstoques } = useQuery({
    queryKey: ['estoques'],
    queryFn: () => base44.entities.Estoque.list()
  });

  const { data: produtos = [], isLoading: loadingProdutos } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list()
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => base44.entities.Categoria.list()
  });

  const isLoading = loadingEstoques || loadingProdutos;

  const getLoja = (id) => lojas.find(l => l.id === id);
  const getCategoria = (id) => categorias.find(c => c.id === id);

  /**
   * REGRA: "Mostrar todos os produtos com estoque"
   * Construímos uma linha por produto por loja onde há registro Estoque.
   * Produtos sem nenhum registro aparecem na linha "Sem loja" (loja_id=null) com saldo 0.
   * Isso garante que todo produto cadastrado seja visível.
   */
  const linhasEstoque = React.useMemo(() => {
    const registrosMap = new Map(); // key: produto_id|loja_id
    estoques.forEach(e => {
      registrosMap.set(`${e.produto_id}|${e.loja_id}`, e);
    });

    const linhas = [];
    produtos.filter(p => p.controla_estoque !== false && p.status === 'ativo').forEach(produto => {
      const registrosDoProduto = estoques.filter(e => e.produto_id === produto.id);
      if (registrosDoProduto.length > 0) {
        registrosDoProduto.forEach(e => linhas.push({ ...e, _produto: produto }));
      } else {
        // Produto sem movimentação: aparece com saldo 0
        linhas.push({
          id: `virtual_${produto.id}`,
          produto_id: produto.id,
          loja_id: null,
          quantidade: 0,
          custo_medio: produto.custo_medio || 0,
          ultima_entrada: null,
          ultima_saida: null,
          _produto: produto,
          _virtual: true,
        });
      }
    });
    return linhas;
  }, [produtos, estoques]);

  // Filtros
  const estoquesFiltrados = linhasEstoque.filter(e => {
    if (lojaFiltro !== 'all' && e.loja_id !== lojaFiltro) return false;
    if (categoriaFiltro !== 'all' && e._produto?.categoria_id !== categoriaFiltro) return false;
    return true;
  });

  // Cálculos
  const totalItens = estoquesFiltrados.length;
  const abaixoMinimo = estoquesFiltrados.filter(e => {
    const produto = e._produto;
    return produto && e.quantidade <= (produto.estoque_minimo || 0) && e.quantidade >= 0;
  }).length;
  const valorTotal = estoquesFiltrados.reduce((sum, e) => sum + ((e.quantidade || 0) * (e.custo_medio || 0)), 0);
  const zerado = estoquesFiltrados.filter(e => (e.quantidade || 0) === 0).length;

  const columns = [
    {
      key: 'produto_id',
      label: 'Produto',
      sortable: true,
      render: (value, row) => {
        const produto = row._produto;
        const abaixoMin = produto && row.quantidade <= (produto.estoque_minimo || 0);
        return (
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              abaixoMin ? 'bg-red-100 dark:bg-red-900/30' : row._virtual ? 'bg-slate-50 dark:bg-slate-900' : 'bg-slate-100 dark:bg-slate-800'
            }`}>
              {abaixoMin ? (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              ) : (
                <Package className={`w-4 h-4 ${row._virtual ? 'text-slate-300' : 'text-slate-500'}`} />
              )}
            </div>
            <div>
              <p className={`font-medium ${row._virtual ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-white'}`}>
                {produto?.nome || 'Produto não encontrado'}
              </p>
              <p className="text-xs text-slate-500">{produto?.codigo || '-'}{row._virtual ? ' • sem movimentação' : ''}</p>
            </div>
          </div>
        );
      }
    },
    {
      key: 'loja_id',
      label: 'Loja',
      render: (value, row) => {
        const loja = getLoja(value);
        return (
          <div className="flex items-center gap-2 text-sm">
            <Store className="w-4 h-4 text-slate-400" />
            {loja?.nome || <span className="text-slate-400 italic text-xs">Sem loja</span>}
          </div>
        );
      }
    },
    {
      key: 'quantidade',
      label: 'Quantidade',
      sortable: true,
      render: (value, row) => {
        const produto = row._produto;
        const abaixoMin = produto && value <= (produto.estoque_minimo || 0);
        return (
          <div>
            <span className={`font-medium ${abaixoMin ? 'text-red-600' : row._virtual ? 'text-slate-400' : 'text-slate-800 dark:text-white'}`}>
              {value || 0} {produto?.unidade_medida || 'un'}
            </span>
            {produto?.estoque_minimo > 0 && (
              <p className="text-xs text-slate-500">
                Mín: {produto.estoque_minimo} {produto.unidade_medida}
              </p>
            )}
          </div>
        );
      }
    },
    {
      key: 'custo_medio',
      label: 'Custo Médio',
      sortable: true,
      render: (value) => <MoneyDisplay value={value || 0} size="sm" />
    },
    {
      key: 'valor_total',
      label: 'Valor Total',
      sortable: true,
      render: (_, row) => <MoneyDisplay value={(row.quantidade || 0) * (row.custo_medio || 0)} size="sm" />
    },
    {
      key: 'ultima_entrada',
      label: 'Última Entrada',
      render: (value) => value ? format(new Date(value), 'dd/MM/yyyy') : '-'
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque"
        subtitle="Gerencie os saldos de estoque por produto e loja"
        icon={Boxes}
        breadcrumbs={[
          { label: 'Dashboard', href: 'Dashboard' },
          { label: 'Estoque' }
        ]}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Total de Itens"
          value={totalItens}
          icon={Package}
          variant="default"
          subtitle="produtos em estoque"
        />
        <KPICard
          title="Abaixo do Mínimo"
          value={abaixoMinimo}
          icon={AlertTriangle}
          variant={abaixoMinimo > 0 ? 'danger' : 'success'}
          subtitle="itens críticos"
        />
        <KPICard
          title="Valor Total"
          value={`R$ ${(valorTotal / 1000).toFixed(1)}K`}
          icon={TrendingUp}
          variant="info"
          subtitle="em estoque"
        />
        <KPICard
          title="Itens Zerados"
          value={zerado}
          icon={TrendingDown}
          variant={zerado > 0 ? 'warning' : 'default'}
          subtitle="sem saldo"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select value={lojaFiltro} onValueChange={setLojaFiltro}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todas as lojas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as lojas</SelectItem>
            {lojas.map((loja) => (
              <SelectItem key={loja.id} value={loja.id}>{loja.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categorias.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>{cat.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <DataTable
        columns={columns}
        data={estoquesFiltrados}
        loading={isLoading}
        searchPlaceholder="Buscar produtos..."
        emptyIcon={Boxes}
        emptyTitle="Nenhum item em estoque"
        onRowClick={(row) => setViewModal(row)}
      />

      {/* Modal de Detalhes */}
      <Dialog open={!!viewModal} onOpenChange={() => setViewModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do Estoque</DialogTitle>
          </DialogHeader>
          
          {viewModal && (() => {
            const produto = viewModal._produto || produtos.find(p => p.id === viewModal.produto_id);
            const loja = getLoja(viewModal.loja_id);
            const categoria = getCategoria(produto?.categoria_id);
            
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Produto</p>
                    <p className="font-medium">{produto?.nome || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Loja</p>
                    <p className="font-medium">{loja?.nome || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Categoria</p>
                    <div className="flex items-center gap-2">
                      <Tags className="w-4 h-4 text-slate-400" />
                      <span>{categoria?.nome || '-'}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Unidade</p>
                    <p className="font-medium uppercase">{produto?.unidade_medida || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Quantidade Atual</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">
                      {viewModal.quantidade || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Estoque Mínimo</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {produto?.estoque_minimo || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Custo Médio</p>
                    <MoneyDisplay value={viewModal.custo_medio || 0} size="lg" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Valor Total</p>
                    <MoneyDisplay 
                      value={(viewModal.quantidade || 0) * (viewModal.custo_medio || 0)} 
                      size="lg" 
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Última Entrada</p>
                      <p>{viewModal.ultima_entrada ? format(new Date(viewModal.ultima_entrada), 'dd/MM/yyyy HH:mm') : '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Última Saída</p>
                      <p>{viewModal.ultima_saida ? format(new Date(viewModal.ultima_saida), 'dd/MM/yyyy HH:mm') : '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}