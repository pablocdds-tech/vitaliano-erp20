import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Package, CreditCard, Wallet, Store } from 'lucide-react';
import { format, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import RelatorioCMV from '@/components/relatorios/RelatorioCMV';
import RelatorioRankingDespesas from '@/components/relatorios/RelatorioRankingDespesas';
import RelatorioAging from '@/components/relatorios/RelatorioAging';
import RelatorioResultadoPorLoja from '@/components/relatorios/RelatorioResultadoPorLoja';

const MESES = Array.from({ length: 12 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return { value: format(d, 'yyyy-MM'), label: format(d, "MMMM 'de' yyyy", { locale: ptBR }) };
});

const RELATORIOS = [
  { value: 'cmv', label: 'CMV por Produto', icon: Package, cor: 'red' },
  { value: 'despesas', label: 'Ranking de Despesas', icon: CreditCard, cor: 'orange' },
  { value: 'aging', label: 'Aging de Contas', icon: Wallet, cor: 'amber' },
  { value: 'lojas', label: 'Resultado por Loja', icon: Store, cor: 'indigo' },
];

function Relatorios() {
  const [relatorio, setRelatorio] = useState('cmv');
  const [mesSelecionado, setMesSelecionado] = useState(MESES[0].value);
  const [lojaFiltro, setLojaFiltro] = useState('all');

  // Queries
  const { data: lojas = [] } = useQuery({ queryKey: ['lojas'], queryFn: () => base44.entities.Loja.list() });
  const { data: categoriasDRE = [] } = useQuery({ queryKey: ['categorias-dre'], queryFn: () => base44.entities.CategoriaDRE.list('ordem', 500) });
  const { data: vendas = [] } = useQuery({ queryKey: ['vendas-rel'], queryFn: () => base44.entities.Venda.list('-data', 2000) });
  const { data: contasPagar = [] } = useQuery({ queryKey: ['cp-rel'], queryFn: () => base44.entities.ContaPagar.list('-data_vencimento', 2000) });
  const { data: contasReceber = [] } = useQuery({ queryKey: ['cr-rel'], queryFn: () => base44.entities.ContaReceber.list('-data_vencimento', 2000) });
  const { data: movimentacoes = [] } = useQuery({ queryKey: ['mov-rel'], queryFn: () => base44.entities.MovimentacaoEstoque.list('-created_date', 2000) });
  const { data: produtos = [] } = useQuery({ queryKey: ['produtos-rel'], queryFn: () => base44.entities.Produto.list('nome', 500) });

  // Filtro de período
  const inicio = mesSelecionado + '-01';
  const fim = format(endOfMonth(new Date(inicio)), 'yyyy-MM-dd');

  const filtrar = (lista, campoData) =>
    lista.filter(item => {
      const d = (item[campoData] || '').substring(0, 10);
      const lojaOk = lojaFiltro === 'all' || item.loja_id === lojaFiltro;
      return d >= inicio && d <= fim && lojaOk;
    });

  const vendasPeriodo = filtrar(vendas, 'data');
  const pagarPeriodo = filtrar(contasPagar, 'data_vencimento');
  const pagarPagoPeriodo = filtrar(contasPagar.filter(c => c.status === 'pago'), 'data_pagamento');
  const receberPeriodo = filtrar(contasReceber, 'data_vencimento');
  const movPeriodo = useMemo(() => movimentacoes.filter(m => {
    const d = (m.created_date || '').substring(0, 10);
    const lojaOk = lojaFiltro === 'all' || m.loja_id === lojaFiltro;
    return d >= inicio && d <= fim && lojaOk;
  }), [movimentacoes, inicio, fim, lojaFiltro]);

  const totalReceita = vendasPeriodo.reduce((s, v) => s + (v.valor_liquido || 0), 0);

  // Aging: pendentes não filtrados por período
  const pagarPendente = contasPagar.filter(c => ['pendente', 'vencido'].includes(c.status) && (lojaFiltro === 'all' || c.loja_id === lojaFiltro));
  const receberPendente = contasReceber.filter(c => ['pendente', 'vencido'].includes(c.status) && (lojaFiltro === 'all' || c.loja_id === lojaFiltro));

  const rel = RELATORIOS.find(r => r.value === relatorio);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios Gerenciais"
        subtitle="Análises operacionais e financeiras em tempo real"
        icon={BarChart3}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Relatórios' }]}
      />

      {/* Filtros globais */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
        {/* Seletor de relatório */}
        <div className="flex flex-wrap gap-2">
          {RELATORIOS.map(r => {
            const Icon = r.icon;
            const ativo = relatorio === r.value;
            return (
              <button
                key={r.value}
                onClick={() => setRelatorio(r.value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border
                  ${ativo
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
              >
                <Icon className="w-4 h-4" />
                {r.label}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 ml-auto">
          <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
            <SelectTrigger className="w-52 bg-white dark:bg-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={lojaFiltro} onValueChange={setLojaFiltro}>
            <SelectTrigger className="w-40 bg-white dark:bg-slate-700">
              <SelectValue placeholder="Todas as lojas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as lojas</SelectItem>
              {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Corpo do relatório */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          {rel && <rel.icon className="w-5 h-5 text-indigo-600" />}
          <div>
            <h2 className="font-bold text-slate-800 dark:text-white">{rel?.label}</h2>
            <p className="text-xs text-slate-400">
              {MESES.find(m => m.value === mesSelecionado)?.label}
              {lojaFiltro !== 'all' && ` · ${lojas.find(l => l.id === lojaFiltro)?.nome}`}
            </p>
          </div>
        </div>

        {relatorio === 'cmv' && (
          <RelatorioCMV movimentacoes={movPeriodo} produtos={produtos} />
        )}
        {relatorio === 'despesas' && (
          <RelatorioRankingDespesas contasPagar={pagarPagoPeriodo} categoriasDRE={categoriasDRE} totalReceita={totalReceita} />
        )}
        {relatorio === 'aging' && (
          <RelatorioAging contasPagar={pagarPendente} contasReceber={receberPendente} lojas={lojas} />
        )}
        {relatorio === 'lojas' && (
          <RelatorioResultadoPorLoja
            vendas={vendasPeriodo}
            contasPagar={contasPagar.filter(c => c.status === 'pago')}
            contasReceber={contasReceber.filter(c => c.status === 'recebido')}
            categoriasDRE={categoriasDRE}
            lojas={lojas}
          />
        )}
      </div>
    </div>
  );
}

export default withPermissao(Relatorios, 'relatorios');
import withPermissao from '@/components/rbac/withPermissao';