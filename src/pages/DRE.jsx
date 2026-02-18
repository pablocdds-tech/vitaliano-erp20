import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import MoneyDisplay from '@/components/ui-custom/MoneyDisplay';
import KPICard from '@/components/ui-custom/KPICard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileBarChart, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MESES = Array.from({ length: 6 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return { value: format(d, 'yyyy-MM'), label: format(d, "MMMM 'de' yyyy", { locale: ptBR }) };
});

function LinhaGrupo({ label, valor, indent = false, destaque = false, tipo }) {
  const cor = tipo === 'receita' ? 'text-emerald-600' : tipo === 'despesa' ? 'text-red-600' : 'text-slate-800 dark:text-white';
  return (
    <div className={`flex items-center justify-between py-2 ${indent ? 'pl-6' : ''} ${destaque ? 'border-t border-slate-200 dark:border-slate-700 mt-1 pt-3 font-semibold' : 'border-b border-slate-100 dark:border-slate-800'}`}>
      <div className="flex items-center gap-2">
        {indent && <ChevronRight className="w-3 h-3 text-slate-400" />}
        <span className={`text-sm ${destaque ? 'font-semibold' : ''} ${indent ? 'text-slate-600 dark:text-slate-400' : 'text-slate-800 dark:text-white'}`}>{label}</span>
      </div>
      <MoneyDisplay value={valor} size={destaque ? 'lg' : 'sm'} colorize={destaque} />
    </div>
  );
}

export default function DRE() {
  const [mesSelecionado, setMesSelecionado] = useState(MESES[0].value);
  const [lojaFiltro, setLojaFiltro] = useState('all');

  const { data: categoriasDRE = [] } = useQuery({
    queryKey: ['categorias-dre'],
    queryFn: () => base44.entities.CategoriaDRE.list('ordem', 200)
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const { data: vendas = [] } = useQuery({
    queryKey: ['vendas-dre', mesSelecionado],
    queryFn: () => base44.entities.Venda.list('-data', 500)
  });

  const { data: contasPagar = [] } = useQuery({
    queryKey: ['contas-pagar-dre', mesSelecionado],
    queryFn: () => base44.entities.ContaPagar.list('-data_vencimento', 500)
  });

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contas-receber-dre', mesSelecionado],
    queryFn: () => base44.entities.ContaReceber.list('-data_vencimento', 500)
  });

  // Filtro de período
  const inicio = mesSelecionado + '-01';
  const fimDate = endOfMonth(new Date(inicio));
  const fim = format(fimDate, 'yyyy-MM-dd');

  const filtrarPorPeriodo = (lista, campoData) =>
    lista.filter(item => {
      const d = item[campoData];
      if (!d) return false;
      const ds = d.substring(0, 10);
      const lojaOk = lojaFiltro === 'all' || item.loja_id === lojaFiltro;
      return ds >= inicio && ds <= fim && lojaOk;
    });

  const vendasPeriodo = filtrarPorPeriodo(vendas, 'data');
  const pagarPeriodo = filtrarPorPeriodo(contasPagar.filter(c => c.status === 'pago'), 'data_pagamento');
  const receberPeriodo = filtrarPorPeriodo(contasReceber.filter(c => c.status === 'recebido'), 'data_recebimento');

  // Totais
  const receitaVendas = vendasPeriodo.reduce((s, v) => s + (v.valor_liquido || 0), 0);
  const receitaOutras = receberPeriodo.filter(c => c.origem !== 'venda').reduce((s, c) => s + (c.valor_recebido || c.valor_original || 0), 0);
  const totalReceita = receitaVendas + receitaOutras;

  // Agrupar despesas por grupo
  const despesasGrupos = useMemo(() => {
    const grupos = {};
    pagarPeriodo.forEach(conta => {
      const catId = conta.categoria_dre_id;
      const cat = categoriasDRE.find(c => c.id === catId);
      const grupo = cat?.grupo || 'outros';
      const nomeGrupo = cat?.nome || 'Sem categoria';
      if (!grupos[grupo]) grupos[grupo] = { total: 0, categorias: {} };
      if (!grupos[grupo].categorias[nomeGrupo]) grupos[grupo].categorias[nomeGrupo] = 0;
      grupos[grupo].total += (conta.valor_pago || conta.valor_original || 0);
      grupos[grupo].categorias[nomeGrupo] += (conta.valor_pago || conta.valor_original || 0);
    });
    return grupos;
  }, [pagarPeriodo, categoriasDRE]);

  const totalCMV = despesasGrupos['cmv']?.total || 0;
  const totalDespesasOp = despesasGrupos['despesas_operacionais']?.total || 0;
  const totalDespesasAdm = despesasGrupos['despesas_administrativas']?.total || 0;
  const totalDespesasFin = despesasGrupos['despesas_financeiras']?.total || 0;
  const totalDespesas = totalCMV + totalDespesasOp + totalDespesasAdm + totalDespesasFin;

  const lucroBruto = totalReceita - totalCMV;
  const lucroOperacional = lucroBruto - totalDespesasOp - totalDespesasAdm;
  const resultadoLiquido = lucroOperacional - totalDespesasFin;
  const margemLiquida = totalReceita > 0 ? (resultadoLiquido / totalReceita) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="DRE Gerencial"
        subtitle="Demonstrativo de Resultado do Exercício"
        icon={FileBarChart}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'DRE Gerencial' }]}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Receita Total" value={`R$ ${(totalReceita/1000).toFixed(1)}K`} icon={TrendingUp} variant="success" />
        <KPICard title="Total Despesas" value={`R$ ${(totalDespesas/1000).toFixed(1)}K`} icon={TrendingDown} variant="danger" />
        <KPICard title="Resultado Líquido" value={`R$ ${(resultadoLiquido/1000).toFixed(1)}K`} icon={resultadoLiquido >= 0 ? TrendingUp : TrendingDown} variant={resultadoLiquido >= 0 ? 'success' : 'danger'} />
        <KPICard title="Margem Líquida" value={`${margemLiquida.toFixed(1)}%`} icon={Minus} variant={margemLiquida >= 10 ? 'success' : margemLiquida >= 0 ? 'warning' : 'danger'} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={lojaFiltro} onValueChange={setLojaFiltro}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todas as lojas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as lojas</SelectItem>
            {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* DRE */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">
            DRE — {MESES.find(m => m.value === mesSelecionado)?.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* RECEITAS */}
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Receitas</p>
            <LinhaGrupo label="Vendas (líquido)" valor={receitaVendas} indent tipo="receita" />
            <LinhaGrupo label="Outras Receitas" valor={receitaOutras} indent tipo="receita" />
            <LinhaGrupo label="(=) Total Receita Operacional" valor={totalReceita} destaque tipo="receita" />
          </div>

          {/* CMV */}
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 mt-4">CMV — Custo das Mercadorias Vendidas</p>
            {Object.entries(despesasGrupos['cmv']?.categorias || { 'Sem lançamentos': 0 }).map(([nome, val]) => (
              <LinhaGrupo key={nome} label={nome} valor={val} indent tipo="despesa" />
            ))}
            <LinhaGrupo label="(-) Total CMV" valor={-totalCMV} destaque />
            <LinhaGrupo label="(=) Lucro Bruto" valor={lucroBruto} destaque tipo={lucroBruto >= 0 ? 'receita' : 'despesa'} />
          </div>

          {/* DESPESAS OPERACIONAIS */}
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 mt-4">Despesas Operacionais</p>
            {Object.entries(despesasGrupos['despesas_operacionais']?.categorias || { 'Sem lançamentos': 0 }).map(([nome, val]) => (
              <LinhaGrupo key={nome} label={nome} valor={val} indent tipo="despesa" />
            ))}
            {Object.entries(despesasGrupos['despesas_administrativas']?.categorias || {}).map(([nome, val]) => (
              <LinhaGrupo key={nome} label={nome} valor={val} indent tipo="despesa" />
            ))}
            <LinhaGrupo label="(-) Total Despesas Operacionais" valor={-(totalDespesasOp + totalDespesasAdm)} destaque />
            <LinhaGrupo label="(=) Lucro Operacional" valor={lucroOperacional} destaque tipo={lucroOperacional >= 0 ? 'receita' : 'despesa'} />
          </div>

          {/* DESPESAS FINANCEIRAS */}
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 mt-4">Resultado Financeiro</p>
            {Object.entries(despesasGrupos['despesas_financeiras']?.categorias || { 'Sem lançamentos': 0 }).map(([nome, val]) => (
              <LinhaGrupo key={nome} label={nome} valor={val} indent tipo="despesa" />
            ))}
            <LinhaGrupo label="(-) Total Despesas Financeiras" valor={-totalDespesasFin} destaque />
          </div>

          {/* RESULTADO */}
          <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-slate-800 dark:text-white">(=) RESULTADO LÍQUIDO</span>
              <MoneyDisplay value={resultadoLiquido} size="xl" colorize />
            </div>
            <p className="text-xs text-slate-500 mt-1">Margem líquida: {margemLiquida.toFixed(2)}%</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}