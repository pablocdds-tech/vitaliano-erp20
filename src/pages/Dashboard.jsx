import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import KPICard from '@/components/ui-custom/KPICard';
import MoneyDisplay, { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import AlertasPanel from '@/components/alertas/AlertasPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  DollarSign,
  TrendingUp,
  Package,
  AlertTriangle,
  CreditCard,
  Wallet,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  RefreshCw,
  Landmark,
  Vault
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

export default function Dashboard() {
  // Buscar empresa do usuário (para alertas)
  const [empresa_id, setEmpresa_id] = useState(null);

  useEffect(() => {
    async function getEmpresaId() {
      try {
        const user = await base44.auth.me();
        setEmpresa_id(user.empresa_id || null);
      } catch {
        setEmpresa_id(null);
      }
    }
    getEmpresaId();
  }, []);

  // Query para dados do dashboard
   const { data: vendas = [], isLoading: loadingVendas } = useQuery({
    queryKey: ['vendas-dashboard'],
    queryFn: () => base44.entities.Venda.list('-data', 30)
  });

  const { data: contasPagar = [], isLoading: loadingContas } = useQuery({
    queryKey: ['contas-pagar-dashboard'],
    queryFn: () => base44.entities.ContaPagar.filter({ status: 'pendente' }, 'data_vencimento', 10)
  });

  const { data: contasReceber = [], isLoading: loadingReceber } = useQuery({
    queryKey: ['contas-receber-dashboard'],
    queryFn: () => base44.entities.ContaReceber.filter({ status: 'pendente' }, 'data_vencimento', 10)
  });

  const { data: contasBancarias = [] } = useQuery({ queryKey: ['contas-bancarias'], queryFn: () => base44.entities.ContaBancaria.list('nome') });
  const { data: transacoesBanco = [] } = useQuery({ queryKey: ['transacoes-banco'], queryFn: () => base44.entities.TransacaoBancaria.list('-data', 1000) });
  const { data: cofres = [] } = useQuery({ queryKey: ['cofres'], queryFn: () => base44.entities.Cofre.list('nome') });
  const { data: movsCofre = [] } = useQuery({ queryKey: ['movs-cofre'], queryFn: () => base44.entities.MovimentacaoCofre.list('-data', 500) });

  const { data: estoqueAlerta = [], isLoading: loadingEstoque } = useQuery({
    queryKey: ['estoque-alerta'],
    queryFn: async () => {
      const estoques = await base44.entities.Estoque.list();
      const produtos = await base44.entities.Produto.list();
      return estoques.filter(e => {
        const produto = produtos.find(p => p.id === e.produto_id);
        return produto && e.quantidade <= (produto.estoque_minimo || 0);
      }).slice(0, 5);
    }
  });

  // Cálculos
  const totalVendasMes = vendas.reduce((sum, v) => sum + (v.valor_liquido || 0), 0);
  const totalPagar = contasPagar.reduce((sum, c) => sum + (c.valor_original || 0), 0);
  const totalReceber = contasReceber.reduce((sum, c) => sum + (c.valor_original || 0), 0);
  const contasVencidas = contasPagar.filter(c => new Date(c.data_vencimento) < new Date()).length;

  // Dados para gráfico de vendas (últimos 7 dias)
  const vendasGrafico = React.useMemo(() => {
    const dias = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const vendasDia = vendas.filter(v => v.data === dateStr);
      dias.push({
        data: format(date, 'EEE', { locale: ptBR }),
        valor: vendasDia.reduce((sum, v) => sum + (v.valor_liquido || 0), 0)
      });
    }
    return dias;
  }, [vendas]);

  const loading = loadingVendas || loadingContas || loadingReceber || loadingEstoque;

  // Tesouraria
  const getSaldoBanco = (contaId) => {
    const saldoInicial = contasBancarias.find(c => c.id === contaId)?.saldo_inicial || 0;
    const movs = transacoesBanco.filter(t => t.conta_bancaria_id === contaId && t.status !== 'ignorado');
    return saldoInicial + movs.reduce((s, t) => s + (t.valor || 0), 0);
  };
  const totalBancos = contasBancarias.reduce((s, c) => s + getSaldoBanco(c.id), 0);

  const getSaldoCofre = (cofreId) => movsCofre.filter(m => m.cofre_id === cofreId || m.cofre_destino_id === cofreId).reduce((s, m) => {
    if (m.tipo === 'entrada') return s + m.valor;
    if (m.tipo === 'saida') return s - m.valor;
    if (m.tipo === 'transferencia') return m.cofre_id === cofreId ? s - m.valor : s + m.valor;
    return s;
  }, 0);
  const totalCofres = cofres.reduce((s, c) => s + getSaldoCofre(c.id), 0);

  const hoje = format(new Date(), 'yyyy-MM-dd');
  const em7dias = format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd');
  const em30dias = format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd');
  const receberProx7 = contasReceber.filter(c => c.data_vencimento <= em7dias).reduce((s, c) => s + (c.valor_original || 0), 0);
  const pagarProx7 = contasPagar.filter(c => c.data_vencimento <= em7dias).reduce((s, c) => s + (c.valor_original || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={`Olá! Hoje é ${format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}`}
        icon={LayoutDashboard}
        actions={
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
        }
      />

      {/* Alertas IA */}
      {empresa_id && (
        <AlertasPanel empresa_id={empresa_id} loja_id={null} />
      )}

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Vendas do Mês"
          value={formatMoney(totalVendasMes)}
          icon={TrendingUp}
          variant="success"
          trend="up"
          trendValue="+12.5%"
          subtitle="vs. mês anterior"
          loading={loading}
        />
        <KPICard
          title="A Receber"
          value={formatMoney(totalReceber)}
          icon={Wallet}
          variant="info"
          subtitle={`${contasReceber.length} títulos`}
          loading={loading}
        />
        <KPICard
          title="A Pagar"
          value={formatMoney(totalPagar)}
          icon={CreditCard}
          variant={contasVencidas > 0 ? 'danger' : 'warning'}
          subtitle={contasVencidas > 0 ? `${contasVencidas} vencidos` : `${contasPagar.length} títulos`}
          loading={loading}
        />
        <KPICard
          title="Alertas Estoque"
          value={estoqueAlerta.length}
          icon={AlertTriangle}
          variant={estoqueAlerta.length > 0 ? 'warning' : 'default'}
          subtitle="itens abaixo do mínimo"
          loading={loading}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Vendas */}
        <Card className="lg:col-span-2 border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Vendas dos Últimos 7 Dias</CardTitle>
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <ArrowUpRight className="w-4 h-4" />
                <span className="font-medium">+8.2%</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={vendasGrafico}>
                  <defs>
                    <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="data" axisLine={false} tickLine={false} className="text-xs" />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(v) => formatMoney(v, { compact: true })}
                    className="text-xs"
                  />
                  <Tooltip 
                    formatter={(value) => [formatMoney(value), 'Vendas']}
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="valor"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#colorVendas)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Resumo Financeiro */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Resumo Financeiro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                  <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Entradas</p>
                  <p className="text-sm font-semibold text-emerald-600">{formatMoney(totalReceber)}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-900/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50">
                  <ArrowDownRight className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Saídas</p>
                  <p className="text-sm font-semibold text-red-600">{formatMoney(totalPagar)}</p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Saldo Projetado</span>
                <MoneyDisplay value={totalReceber - totalPagar} size="lg" colorize />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tesouraria */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Tesouraria</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-1"><Landmark className="w-4 h-4 text-blue-500" /><p className="text-xs text-slate-500">Total em Bancos</p></div>
            <p className={`text-xl font-bold ${totalBancos < 0 ? 'text-red-600' : 'text-blue-600'}`}>{formatMoney(totalBancos)}</p>
            <p className="text-xs text-slate-400 mt-1">{contasBancarias.length} conta(s) — estimado</p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-1"><Vault className="w-4 h-4 text-amber-500" /><p className="text-xs text-slate-500">Total em Cofres</p></div>
            <p className={`text-xl font-bold ${totalCofres < 0 ? 'text-red-600' : 'text-amber-600'}`}>{formatMoney(totalCofres)}</p>
            <p className="text-xs text-slate-400 mt-1">{cofres.length} cofre(s)</p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200">
            <div className="flex items-center gap-2 mb-1"><ArrowUpRight className="w-4 h-4 text-emerald-500" /><p className="text-xs text-slate-500">A Receber (7 dias)</p></div>
            <p className="text-xl font-bold text-emerald-600">{formatMoney(receberProx7)}</p>
          </div>
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200">
            <div className="flex items-center gap-2 mb-1"><ArrowDownRight className="w-4 h-4 text-red-500" /><p className="text-xs text-slate-500">A Pagar (7 dias)</p></div>
            <p className="text-xl font-bold text-red-600">{formatMoney(pagarProx7)}</p>
          </div>
        </div>
        {contasBancarias.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {contasBancarias.map(c => {
              const s = getSaldoBanco(c.id);
              return (
                <span key={c.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <Landmark className="w-3 h-3" />{c.nome}: <span className={s >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatMoney(s)}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Listas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contas a Pagar */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-slate-500" />
                Próximas Contas a Pagar
              </CardTitle>
              <Button variant="ghost" size="sm">Ver todas</Button>
            </div>
          </CardHeader>
          <CardContent>
            {contasPagar.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                Nenhuma conta pendente
              </div>
            ) : (
              <div className="space-y-3">
                {contasPagar.slice(0, 5).map((conta) => {
                  const vencida = new Date(conta.data_vencimento) < new Date();
                  return (
                    <div 
                      key={conta.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${vencida ? 'bg-red-100 dark:bg-red-900/50' : 'bg-amber-100 dark:bg-amber-900/50'}`}>
                          {vencida ? (
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-white">
                            {conta.descricao}
                          </p>
                          <p className="text-xs text-slate-500">
                            Vence em {format(new Date(conta.data_vencimento), 'dd/MM')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <MoneyDisplay value={conta.valor_original} size="sm" />
                        {vencida && <StatusBadge status="vencido" size="xs" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contas a Receber */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Wallet className="w-5 h-5 text-slate-500" />
                Próximas Contas a Receber
              </CardTitle>
              <Button variant="ghost" size="sm">Ver todas</Button>
            </div>
          </CardHeader>
          <CardContent>
            {contasReceber.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                Nenhuma conta a receber
              </div>
            ) : (
              <div className="space-y-3">
                {contasReceber.slice(0, 5).map((conta) => (
                  <div 
                    key={conta.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                        <DollarSign className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-white">
                          {conta.descricao}
                        </p>
                        <p className="text-xs text-slate-500">
                          {conta.cliente_nome || 'Cliente'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <MoneyDisplay value={conta.valor_original} size="sm" />
                      <p className="text-xs text-slate-500 mt-0.5">
                        {format(new Date(conta.data_vencimento), 'dd/MM')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}