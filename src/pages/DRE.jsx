import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import MoneyDisplay from '@/components/ui-custom/MoneyDisplay';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileBarChart, TrendingUp, TrendingDown, Percent, Settings2, BarChart3, BookOpen } from 'lucide-react';
import { format, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DREGerencial from '@/components/dre/DREGerencial';
import DREFinanceiro from '@/components/dre/DREFinanceiro';
import DREConfig from '@/components/dre/DREConfig';

const MESES = Array.from({ length: 12 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return { value: format(d, 'yyyy-MM'), label: format(d, "MMMM 'de' yyyy", { locale: ptBR }) };
});

function KPI({ title, value, sub, icon: Icon, cor }) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border p-4 flex items-start gap-3 ${cor || 'border-slate-200 dark:border-slate-700'}`}>
      {Icon && <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 shrink-0"><Icon className="w-4 h-4 text-slate-500" /></div>}
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium truncate">{title}</p>
        <p className="text-lg font-bold text-slate-800 dark:text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function DRE() {
  const [mesSelecionado, setMesSelecionado] = useState(MESES[0].value);
  const [lojaFiltro, setLojaFiltro] = useState('all');
  const [tipoDRE, setTipoDRE] = useState('gerencial'); // 'gerencial' | 'financeiro'
  const [configOpen, setConfigOpen] = useState(false);

  const { data: categoriasDRE = [] } = useQuery({
    queryKey: ['categorias-dre'],
    queryFn: () => base44.entities.CategoriaDRE.list('ordem', 500)
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const { data: vendas = [] } = useQuery({
    queryKey: ['vendas-dre'],
    queryFn: () => base44.entities.Venda.list('-data', 1000)
  });

  const { data: contasPagar = [] } = useQuery({
    queryKey: ['contas-pagar-dre'],
    queryFn: () => base44.entities.ContaPagar.list('-data_vencimento', 1000)
  });

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contas-receber-dre'],
    queryFn: () => base44.entities.ContaReceber.list('-data_vencimento', 1000)
  });

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
  const pagarPeriodo = filtrar(contasPagar.filter(c => c.status === 'pago'), 'data_pagamento');
  const receberPeriodo = filtrar(contasReceber.filter(c => c.status === 'recebido'), 'data_recebimento');

  // Monta dados calculados
  const dados = useMemo(() => {
    const receitaVendas = vendasPeriodo.reduce((s, v) => s + (v.valor_liquido || 0), 0);
    const receitaOutras = receberPeriodo.filter(c => c.origem !== 'venda').reduce((s, c) => s + (c.valor_recebido || c.valor_original || 0), 0);

    // Agrupa despesas por grupo DRE
    const grupos = {};
    pagarPeriodo.forEach(conta => {
      const cat = categoriasDRE.find(c => c.id === conta.categoria_dre_id);
      const grupo = cat?.grupo || 'outros';
      const nome = cat?.nome || 'Sem categoria';
      if (!grupos[grupo]) grupos[grupo] = { total: 0, cats: {} };
      grupos[grupo].total += (conta.valor_pago || conta.valor_original || 0);
      grupos[grupo].cats[nome] = (grupos[grupo].cats[nome] || 0) + (conta.valor_pago || conta.valor_original || 0);
    });

    // Receitas não operacionais (de ContasReceber com grupo = receita_nao_operacional)
    const recNaoOpCats = {};
    let totalRecNaoOp = 0;
    receberPeriodo.forEach(c => {
      const cat = categoriasDRE.find(x => x.id === c.categoria_dre_id);
      if (cat?.grupo === 'receita_nao_operacional') {
        const v = c.valor_recebido || c.valor_original || 0;
        totalRecNaoOp += v;
        recNaoOpCats[cat.nome] = (recNaoOpCats[cat.nome] || 0) + v;
      }
    });

    return {
      receitaVendas,
      receitaOutras,
      totalCMV: grupos['cmv']?.total || 0,
      cmvCats: grupos['cmv']?.cats || {},
      totalDespOp: grupos['despesas_operacionais']?.total || 0,
      despOpCats: grupos['despesas_operacionais']?.cats || {},
      totalDespAdm: grupos['despesas_administrativas']?.total || 0,
      despAdmCats: grupos['despesas_administrativas']?.cats || {},
      totalDespFin: grupos['despesas_financeiras']?.total || 0,
      despFinCats: grupos['despesas_financeiras']?.cats || {},
      totalImpostos: grupos['impostos']?.total || 0,
      impostosCats: grupos['impostos']?.cats || {},
      totalRecNaoOp,
      recNaoOpCats,
      totalDespOutros: grupos['outros']?.total || 0,
      despOutrosCats: grupos['outros']?.cats || {},
    };
  }, [vendasPeriodo, pagarPeriodo, receberPeriodo, categoriasDRE]);

  const totalReceita = dados.receitaVendas + dados.receitaOutras;
  const totalDespesas = dados.totalCMV + dados.totalDespOp + dados.totalDespAdm + dados.totalDespFin + dados.totalImpostos + dados.totalDespOutros;
  const lucroBruto = totalReceita - dados.totalCMV;
  const resultadoLiquido = lucroBruto - dados.totalDespOp - dados.totalDespAdm - dados.totalDespFin + dados.totalRecNaoOp - dados.totalDespOutros;
  const margem = totalReceita > 0 ? (resultadoLiquido / totalReceita) * 100 : 0;

  const mesLabel = MESES.find(m => m.value === mesSelecionado)?.label;

  return (
    <div className="space-y-6">
      <PageHeader
        title="DRE"
        subtitle="Demonstrativo de Resultado do Exercício"
        icon={FileBarChart}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'DRE' }]}
        actions={
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setConfigOpen(true)}>
            <Settings2 className="w-4 h-4" />
            Configurar DRE
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KPI title="Receita Líquida" value={<MoneyDisplay value={totalReceita} size="md" />} icon={TrendingUp} />
        <KPI title="CMV" value={<MoneyDisplay value={dados.totalCMV} size="md" />} icon={TrendingDown} />
        <KPI title="Lucro Bruto" value={<MoneyDisplay value={lucroBruto} size="md" colorize />} icon={BarChart3} />
        <KPI title="Despesas Totais" value={<MoneyDisplay value={totalDespesas} size="md" />} icon={TrendingDown} />
        <KPI title="Resultado Líquido" value={<MoneyDisplay value={resultadoLiquido} size="md" colorize />} icon={resultadoLiquido >= 0 ? TrendingUp : TrendingDown} />
        <KPI title="Margem Líquida" value={`${margem.toFixed(1)}%`} icon={Percent} cor={margem >= 10 ? 'border-emerald-200' : margem >= 0 ? 'border-amber-200' : 'border-red-200'} />
      </div>

      {/* Filtros + Seletor de tipo */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Seletor Gerencial / Financeiro */}
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
          <button
            onClick={() => setTipoDRE('gerencial')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${tipoDRE === 'gerencial' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <BarChart3 className="w-4 h-4" />
            Gerencial
          </button>
          <button
            onClick={() => setTipoDRE('financeiro')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${tipoDRE === 'financeiro' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <BookOpen className="w-4 h-4" />
            Financeiro
          </button>
        </div>

        <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
          <SelectTrigger className="w-56 bg-white dark:bg-slate-800">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={lojaFiltro} onValueChange={setLojaFiltro}>
          <SelectTrigger className="w-44 bg-white dark:bg-slate-800">
            <SelectValue placeholder="Todas as lojas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as lojas</SelectItem>
            {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Corpo do DRE */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-lg">
            DRE {tipoDRE === 'gerencial' ? 'Gerencial' : 'Financeiro'} — {mesLabel}
            {lojaFiltro !== 'all' && (
              <span className="ml-2 text-sm font-normal text-slate-400">
                {lojas.find(l => l.id === lojaFiltro)?.nome}
              </span>
            )}
          </CardTitle>
          <span className="text-xs text-slate-400 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">
            {lojaFiltro === 'all' ? 'Consolidado' : 'Por Loja'}
          </span>
        </CardHeader>
        <CardContent>
          {tipoDRE === 'gerencial'
            ? <DREGerencial dados={dados} totalReceita={totalReceita} categoriasDRE={categoriasDRE} />
            : <DREFinanceiro dados={dados} totalReceita={totalReceita} />
          }
        </CardContent>
      </Card>

      <DREConfig open={configOpen} onClose={() => setConfigOpen(false)} categorias={categoriasDRE} />
    </div>
  );
}