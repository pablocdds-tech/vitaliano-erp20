import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import MoneyDisplay from '@/components/ui-custom/MoneyDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  BarChart3, TrendingUp, Wallet, CreditCard, Boxes, FileBarChart,
  ArrowUpRight, ClipboardList, Package, PiggyBank, FileText, Wrench
} from 'lucide-react';

function ReportCard({ icon: Icon, title, description, href, kpi, kpiLabel, color = 'blue' }) {
  const colorMap = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600',
    green: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600',
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-600',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-600',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-600',
  };
  const cls = colorMap[color] || colorMap.blue;

  return (
    <Card className={`border ${cls.split(' ').filter(c => c.startsWith('border')).join(' ')} hover:shadow-md transition-shadow`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${cls.split(' ').filter(c => c.startsWith('bg')).join(' ')}`}>
            <Icon className={`w-5 h-5 ${cls.split(' ').filter(c => c.startsWith('text')).join(' ')}`} />
          </div>
          {href && (
            <Link to={createPageUrl(href)}>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <ArrowUpRight className="w-4 h-4" />
              </Button>
            </Link>
          )}
        </div>
        <h3 className="font-semibold text-slate-800 dark:text-white mb-1">{title}</h3>
        <p className="text-xs text-slate-500 mb-3">{description}</p>
        {kpi !== undefined && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-400">{kpiLabel}</p>
            <p className={`text-lg font-bold mt-0.5 ${cls.split(' ').filter(c => c.startsWith('text')).join(' ')}`}>{kpi}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Relatorios() {
  const { data: vendas = [] } = useQuery({
    queryKey: ['vendas-rel'],
    queryFn: () => base44.entities.Venda.list('-data', 100)
  });
  const { data: contasPagar = [] } = useQuery({
    queryKey: ['cp-rel'],
    queryFn: () => base44.entities.ContaPagar.filter({ status: 'pendente' }, 'data_vencimento', 50)
  });
  const { data: contasReceber = [] } = useQuery({
    queryKey: ['cr-rel'],
    queryFn: () => base44.entities.ContaReceber.filter({ status: 'pendente' }, 'data_vencimento', 50)
  });
  const { data: estoques = [] } = useQuery({
    queryKey: ['est-rel'],
    queryFn: () => base44.entities.Estoque.list()
  });
  const { data: producoes = [] } = useQuery({
    queryKey: ['prod-rel'],
    queryFn: () => base44.entities.Producao.filter({ status: 'em_andamento' })
  });
  const { data: notas = [] } = useQuery({
    queryKey: ['nf-rel'],
    queryFn: () => base44.entities.NotaFiscal.filter({ status: 'pendente' })
  });

  const totalVendas = vendas.reduce((s, v) => s + (v.valor_liquido || 0), 0);
  const totalPagar = contasPagar.reduce((s, c) => s + (c.valor_original || 0), 0);
  const totalReceber = contasReceber.reduce((s, c) => s + (c.valor_original || 0), 0);
  const valorEstoque = estoques.reduce((s, e) => s + ((e.quantidade || 0) * (e.custo_medio || 0)), 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Relatórios"
        subtitle="Visão consolidada e acesso rápido aos módulos"
        icon={BarChart3}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Relatórios' }]}
      />

      {/* Financeiro */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">Financeiro</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ReportCard
            icon={TrendingUp} color="green" title="Vendas"
            description="Vendas importadas por canal e período"
            href="Vendas" kpi={`R$ ${(totalVendas/1000).toFixed(1)}K`} kpiLabel="Total no sistema"
          />
          <ReportCard
            icon={Wallet} color="blue" title="Contas a Receber"
            description="Títulos pendentes de recebimento"
            href="ContasReceber" kpi={`R$ ${(totalReceber/1000).toFixed(1)}K`} kpiLabel="Pendente"
          />
          <ReportCard
            icon={CreditCard} color="red" title="Contas a Pagar"
            description="Obrigações financeiras e vencimentos"
            href="ContasPagar" kpi={`R$ ${(totalPagar/1000).toFixed(1)}K`} kpiLabel="Pendente"
          />
          <ReportCard
            icon={FileBarChart} color="indigo" title="DRE Gerencial"
            description="Demonstrativo de resultado mensal"
            href="DRE" kpi={`R$ ${((totalReceber - totalPagar)/1000).toFixed(1)}K`} kpiLabel="Resultado projetado"
          />
        </div>
      </section>

      {/* Estoque */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">Estoque & Compras</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ReportCard
            icon={Boxes} color="amber" title="Posição de Estoque"
            description="Saldos atuais por produto e loja"
            href="Estoque" kpi={`R$ ${(valorEstoque/1000).toFixed(1)}K`} kpiLabel="Valor em estoque"
          />
          <ReportCard
            icon={FileText} color="blue" title="Notas Fiscais"
            description="NFs pendentes de conferência e lançamento"
            href="NotasFiscais" kpi={notas.length} kpiLabel="NFs pendentes"
          />
          <ReportCard
            icon={ClipboardList} color="purple" title="Contagens"
            description="Inventários e contagens de estoque"
            href="Contagens" kpiLabel="Módulo disponível"
          />
          <ReportCard
            icon={Package} color="green" title="Movimentações"
            description="Histórico de entradas e saídas"
            href="Movimentacoes" kpiLabel="Ver histórico"
          />
        </div>
      </section>

      {/* Produção */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">Produção</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ReportCard
            icon={Package} color="amber" title="Ordens de Produção"
            description="Acompanhe ordens abertas e concluídas"
            href="Producao" kpi={producoes.length} kpiLabel="Em andamento"
          />
          <ReportCard
            icon={FileText} color="indigo" title="Fichas Técnicas"
            description="Receitas, insumos e custos de produção"
            href="FichasTecnicas" kpiLabel="Ver fichas"
          />
        </div>
      </section>

      {/* Operação */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">Operação</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ReportCard
            icon={PiggyBank} color="green" title="Banco Virtual"
            description="Saldos e transferências entre CD e lojas"
            href="BancoVirtual" kpiLabel="Ver saldos"
          />
          <ReportCard
            icon={Wrench} color="amber" title="Manutenção"
            description="Ordens de manutenção de ativos"
            href="Manutencao" kpiLabel="Ver manutenções"
          />
        </div>
      </section>
    </div>
  );
}