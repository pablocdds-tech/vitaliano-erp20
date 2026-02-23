import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, CalendarDays, AlertTriangle, TrendingUp } from 'lucide-react';
import { formatMoney } from '../ui-custom/MoneyDisplay';

export default function PassivoKPIs({ passivos, parcelas }) {
  const ativos = passivos.filter(p => p.status === 'ativo');
  const dividaTotal = ativos.reduce((s, p) => s + (p.saldo_atual || 0), 0);

  const hoje = new Date();
  const em30dias = new Date();
  em30dias.setDate(em30dias.getDate() + 30);

  const parcelasPendentes = parcelas.filter(p => p.status === 'pendente');
  const prox30 = parcelasPendentes.filter(p => {
    const d = new Date(p.data_vencimento);
    return d >= hoje && d <= em30dias;
  });
  const valorProx30 = prox30.reduce((s, p) => s + (p.valor || 0), 0);

  const vencidas = parcelasPendentes.filter(p => new Date(p.data_vencimento) < hoje);

  const maiorParcela = ativos.reduce((max, p) => Math.max(max, p.valor_parcela || 0), 0);

  const kpis = [
    { label: 'Dívida Total Atual', value: formatMoney(dividaTotal), icon: DollarSign, color: 'text-red-600 bg-red-50' },
    { label: 'Próximos 30 dias', value: formatMoney(valorProx30), icon: CalendarDays, color: 'text-blue-600 bg-blue-50' },
    { label: 'Parcelas Vencidas', value: vencidas.length.toString(), icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
    { label: 'Maior Parcela Mensal', value: formatMoney(maiorParcela), icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${kpi.color}`}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-xl font-bold">{kpi.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}