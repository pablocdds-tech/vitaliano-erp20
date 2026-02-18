import React, { useState, useMemo } from 'react';
import MoneyDisplay from '@/components/ui-custom/MoneyDisplay';
import { Button } from '@/components/ui/button';
import { Download, AlertTriangle, Clock, Calendar, ArrowRight } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';

const hoje = new Date();

function classificarDias(dataVenc) {
  if (!dataVenc) return { bucket: 'sem_data', dias: 0 };
  const dias = differenceInDays(hoje, parseISO(dataVenc));
  if (dias > 0) return { bucket: 'vencido', dias };
  if (dias >= -7) return { bucket: '7d', dias: Math.abs(dias) };
  if (dias >= -30) return { bucket: '30d', dias: Math.abs(dias) };
  return { bucket: 'longo', dias: Math.abs(dias) };
}

function exportCSV(rows, tipo) {
  const header = ['Nome', 'Loja', 'Valor', 'Vencimento', 'Dias', 'Status', 'Faixa'];
  const lines = [header, ...rows.map(r => [r.nome, r.loja, r.valor.toFixed(2), r.vencimento, r.dias, r.status, r.bucket])];
  const csv = lines.map(l => l.join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `aging_${tipo}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function AgingTabela({ rows, tipo, lojas }) {
  const thCls = "text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4 bg-slate-50 dark:bg-slate-800";
  const tdCls = "py-3 px-4 text-sm border-b border-slate-100 dark:border-slate-800";

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr>
            <th className={`${thCls} text-left`}>{tipo === 'pagar' ? 'Credor / Descrição' : 'Cliente / Origem'}</th>
            <th className={`${thCls} text-left`}>Loja</th>
            <th className={`${thCls} text-right`}>Valor</th>
            <th className={`${thCls} text-center`}>Vencimento</th>
            <th className={`${thCls} text-center`}>Faixa</th>
            <th className={`${thCls} text-center`}>Dias</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-slate-900">
          {rows.length === 0 && (
            <tr><td colSpan={6} className="text-center py-10 text-slate-400 text-sm">Sem registros</td></tr>
          )}
          {rows.map((r, i) => {
            const loja = lojas.find(l => l.id === r.loja_id);
            const { bucket, dias } = classificarDias(r.vencimento);
            return (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className={`${tdCls} font-medium text-slate-800 dark:text-white`}>{r.nome}</td>
                <td className={`${tdCls} text-slate-500 text-xs`}>{loja?.nome || '—'}</td>
                <td className={`${tdCls} text-right`}><MoneyDisplay value={r.valor} size="sm" /></td>
                <td className={`${tdCls} text-center text-slate-500 text-xs`}>{r.vencimento || '—'}</td>
                <td className={`${tdCls} text-center`}>
                  {bucket === 'vencido' && <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-semibold">Vencido</span>}
                  {bucket === '7d' && <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 font-semibold">7 dias</span>}
                  {bucket === '30d' && <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-semibold">30 dias</span>}
                  {bucket === 'longo' && <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">Longo prazo</span>}
                  {bucket === 'sem_data' && <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-400">—</span>}
                </td>
                <td className={`${tdCls} text-center text-xs ${bucket === 'vencido' ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                  {bucket === 'vencido' ? `+${dias}d` : dias > 0 ? `${dias}d` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function RelatorioAging({ contasPagar, contasReceber, lojas }) {
  const [aba, setAba] = useState('pagar');

  const rowsPagar = useMemo(() => contasPagar.map(c => ({
    nome: c.descricao || 'Sem descrição',
    loja_id: c.loja_id,
    valor: c.valor_original || 0,
    vencimento: c.data_vencimento,
    status: c.status,
    ...classificarDias(c.data_vencimento),
  })).sort((a, b) => {
    if (a.bucket === 'vencido' && b.bucket !== 'vencido') return -1;
    if (b.bucket === 'vencido' && a.bucket !== 'vencido') return 1;
    return b.valor - a.valor;
  }), [contasPagar]);

  const rowsReceber = useMemo(() => contasReceber.map(c => ({
    nome: c.cliente_nome || c.descricao || 'Sem descrição',
    loja_id: c.loja_id,
    valor: c.valor_original || 0,
    vencimento: c.data_vencimento,
    status: c.status,
    ...classificarDias(c.data_vencimento),
  })).sort((a, b) => {
    if (a.bucket === 'vencido' && b.bucket !== 'vencido') return -1;
    if (b.bucket === 'vencido' && a.bucket !== 'vencido') return 1;
    return b.valor - a.valor;
  }), [contasReceber]);

  const rows = aba === 'pagar' ? rowsPagar : rowsReceber;
  const vencidos = rows.filter(r => r.bucket === 'vencido').reduce((s, r) => s + r.valor, 0);
  const a7d = rows.filter(r => r.bucket === '7d').reduce((s, r) => s + r.valor, 0);
  const a30d = rows.filter(r => r.bucket === '30d').reduce((s, r) => s + r.valor, 0);
  const total = rows.reduce((s, r) => s + r.valor, 0);

  return (
    <div className="space-y-4">
      {/* Abas */}
      <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800 w-fit">
        <button onClick={() => setAba('pagar')} className={`px-5 py-2 text-sm font-medium transition-colors ${aba === 'pagar' ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
          A Pagar
        </button>
        <button onClick={() => setAba('receber')} className={`px-5 py-2 text-sm font-medium transition-colors ${aba === 'receber' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
          A Receber
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Vencido', value: vencidos, icon: AlertTriangle, cor: 'red' },
          { label: 'Vence em 7 dias', value: a7d, icon: Clock, cor: 'orange' },
          { label: 'Vence em 30 dias', value: a30d, icon: Calendar, cor: 'amber' },
          { label: 'Total geral', value: total, icon: ArrowRight, cor: 'slate' },
        ].map(({ label, value, icon: Icon, cor }) => (
          <div key={label} className={`bg-${cor}-50 dark:bg-${cor}-900/20 border border-${cor}-200 dark:border-${cor}-800 rounded-xl px-4 py-3`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-3.5 h-3.5 text-${cor}-500`} />
              <p className={`text-xs text-${cor}-500 font-medium`}>{label}</p>
            </div>
            <MoneyDisplay value={value} size="md" />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => exportCSV(rows, aba)}>
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      <AgingTabela rows={rows} tipo={aba} lojas={lojas} />
    </div>
  );
}