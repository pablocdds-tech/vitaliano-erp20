import React, { useState, useMemo } from 'react';
import MoneyDisplay from '@/components/ui-custom/MoneyDisplay';
import { Button } from '@/components/ui/button';
import { Download, ArrowUpDown } from 'lucide-react';

function exportCSV(rows) {
  const header = ['Produto', 'Unidade', 'Qtd Movimentada', 'Custo Total', 'Custo Médio Unit.'];
  const lines = [header, ...rows.map(r => [r.nome, r.unidade, r.qtd.toFixed(3), r.custoTotal.toFixed(2), r.custoMedio.toFixed(2)])];
  const csv = lines.map(l => l.join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'cmv_por_produto.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function RelatorioCMV({ movimentacoes, produtos }) {
  const [sort, setSort] = useState('custo');

  const rows = useMemo(() => {
    const map = {};
    movimentacoes
      .filter(m => m.tipo === 'saida' || m.tipo === 'producao' || m.tipo === 'perda')
      .forEach(m => {
        const pid = m.produto_id;
        if (!map[pid]) {
          const prod = produtos.find(p => p.id === pid);
          map[pid] = { nome: prod?.nome || 'Desconhecido', unidade: prod?.unidade_medida || 'un', qtd: 0, custoTotal: 0 };
        }
        map[pid].qtd += Math.abs(m.quantidade || 0);
        map[pid].custoTotal += Math.abs(m.custo_total || 0);
      });
    return Object.values(map)
      .map(r => ({ ...r, custoMedio: r.qtd > 0 ? r.custoTotal / r.qtd : 0 }))
      .sort((a, b) => sort === 'custo' ? b.custoTotal - a.custoTotal : sort === 'qtd' ? b.qtd - a.qtd : b.custoMedio - a.custoMedio);
  }, [movimentacoes, produtos, sort]);

  const totalCMV = rows.reduce((s, r) => s + r.custoTotal, 0);

  const thCls = "text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4 bg-slate-50 dark:bg-slate-800";
  const tdCls = "py-3 px-4 text-sm border-b border-slate-100 dark:border-slate-800";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2">
            <p className="text-xs text-red-500 font-medium">Total CMV no período</p>
            <MoneyDisplay value={totalCMV} size="lg" className="text-red-700 dark:text-red-400" />
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2">
            <p className="text-xs text-slate-500 font-medium">Produtos com saída</p>
            <p className="text-lg font-bold text-slate-800 dark:text-white">{rows.length}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => exportCSV(rows)}>
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className={`${thCls} text-left`}>#</th>
              <th className={`${thCls} text-left`}>Produto</th>
              <th className={`${thCls} text-center`}>Un.</th>
              <th className={`${thCls} text-right cursor-pointer`} onClick={() => setSort('qtd')}>
                <span className="flex items-center justify-end gap-1">Qtd Saída <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th className={`${thCls} text-right cursor-pointer`} onClick={() => setSort('custo')}>
                <span className="flex items-center justify-end gap-1">Custo Total <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th className={`${thCls} text-right cursor-pointer`} onClick={() => setSort('medio')}>
                <span className="flex items-center justify-end gap-1">Custo Médio <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th className={`${thCls} text-right`}>% CMV</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900">
            {rows.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400 text-sm">Sem movimentações no período</td></tr>
            )}
            {rows.map((r, i) => {
              const pct = totalCMV > 0 ? (r.custoTotal / totalCMV) * 100 : 0;
              return (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className={`${tdCls} text-slate-400`}>{i + 1}</td>
                  <td className={`${tdCls} font-medium text-slate-800 dark:text-white`}>{r.nome}</td>
                  <td className={`${tdCls} text-center text-slate-500`}>{r.unidade}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{r.qtd.toFixed(3)}</td>
                  <td className={`${tdCls} text-right`}><MoneyDisplay value={r.custoTotal} size="sm" /></td>
                  <td className={`${tdCls} text-right`}><MoneyDisplay value={r.custoMedio} size="sm" /></td>
                  <td className={`${tdCls} text-right`}>
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                        <div className="bg-red-400 h-1.5 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <span className="text-xs text-red-600 dark:text-red-400 w-10 text-right">{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 dark:bg-slate-800 font-semibold">
                <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-300" colSpan={4}>Total</td>
                <td className="py-3 px-4 text-right text-sm"><MoneyDisplay value={totalCMV} size="sm" /></td>
                <td className="py-3 px-4" colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}