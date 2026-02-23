import React from 'react';
import { Wallet, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { formatMoney } from '@/components/ui-custom/MoneyDisplay';

function KPIItem({ label, value, sublabel, icon: Icon, color }) {
  const colors = {
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-lg border ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
        <p className="text-lg font-bold text-slate-800 dark:text-white truncate">{value}</p>
        {sublabel && <p className="text-xs text-slate-400">{sublabel}</p>}
      </div>
    </div>
  );
}

export default function ContasPagarKPIs({ contas }) {
  const hoje = new Date();
  const pendentes = contas.filter(c => c.status === 'pendente' || c.status === 'parcial');
  const vencidas = pendentes.filter(c => c.data_vencimento && new Date(c.data_vencimento + 'T23:59:59') < hoje);
  const proximaSemana = pendentes.filter(c => {
    if (!c.data_vencimento) return false;
    const venc = new Date(c.data_vencimento + 'T12:00:00');
    const diff = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 7;
  });
  const pagas = contas.filter(c => c.status === 'pago');

  const totalPendente = pendentes.reduce((s, c) => s + (c.valor_original || 0) - (c.valor_pago || 0), 0);
  const totalVencido = vencidas.reduce((s, c) => s + (c.valor_original || 0) - (c.valor_pago || 0), 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KPIItem label="Total Pendente" value={formatMoney(totalPendente)} sublabel={`${pendentes.length} contas`} icon={Wallet} color="amber" />
      <KPIItem label="Vencidas" value={formatMoney(totalVencido)} sublabel={`${vencidas.length} contas`} icon={AlertTriangle} color="red" />
      <KPIItem label="Vence em 7 dias" value={proximaSemana.length} sublabel="contas próximas" icon={Clock} color="blue" />
      <KPIItem label="Pagas" value={pagas.length} sublabel="contas quitadas" icon={CheckCircle2} color="emerald" />
    </div>
  );
}