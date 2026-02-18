import React, { useState, useMemo } from 'react';
import MoneyDisplay from '@/components/ui-custom/MoneyDisplay';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download } from 'lucide-react';

const GRUPOS_LABEL = {
  cmv: 'CMV',
  despesas_operacionais: 'Operacional',
  despesas_administrativas: 'Administrativo',
  despesas_financeiras: 'Financeiro',
  impostos: 'Impostos',
  outros: 'Outros',
  receita_operacional: 'Receita Op.',
  receita_nao_operacional: 'Rec. Não Op.',
};

function exportCSV(rows) {
  const header = ['Categoria', 'Grupo', 'Lançamentos', 'Valor Total'];
  const lines = [header, ...rows.map(r => [r.nome, r.grupo, r.count, r.total.toFixed(2)])];
  const csv = lines.map(l => l.join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'ranking_despesas.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function RelatorioRankingDespesas({ contasPagar, categoriasDRE, totalReceita }) {
  const [grupoFiltro, setGrupoFiltro] = useState('all');

  const rows = useMemo(() => {
    const map = {};
    contasPagar.forEach(cp => {
      const cat = categoriasDRE.find(c => c.id === cp.categoria_dre_id);
      const catId = cp.categoria_dre_id || '__sem__';
      const nome = cat?.nome || 'Sem categoria';
      const grupo = cat?.grupo || 'outros';
      if (!map[catId]) map[catId] = { nome, grupo, total: 0, count: 0 };
      map[catId].total += (cp.valor_pago || cp.valor_original || 0);
      map[catId].count += 1;
    });
    return Object.values(map)
      .filter(r => grupoFiltro === 'all' || r.grupo === grupoFiltro)
      .sort((a, b) => b.total - a.total);
  }, [contasPagar, categoriasDRE, grupoFiltro]);

  const totalGeral = rows.reduce((s, r) => s + r.total, 0);

  const thCls = "text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4 bg-slate-50 dark:bg-slate-800";
  const tdCls = "py-3 px-4 text-sm border-b border-slate-100 dark:border-slate-800";

  const corPct = (pct) => pct > 30 ? 'text-red-600 dark:text-red-400' : pct > 15 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl px-4 py-2">
            <p className="text-xs text-orange-500 font-medium">Total despesas no período</p>
            <MoneyDisplay value={totalGeral} size="lg" className="text-orange-700 dark:text-orange-400" />
          </div>
          {totalReceita > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2">
              <p className="text-xs text-slate-500 font-medium">% sobre receita</p>
              <p className="text-lg font-bold text-slate-800 dark:text-white">
                {((totalGeral / totalReceita) * 100).toFixed(1)}%
              </p>
            </div>
          )}
          <Select value={grupoFiltro} onValueChange={setGrupoFiltro}>
            <SelectTrigger className="w-48 bg-white dark:bg-slate-800">
              <SelectValue placeholder="Todos os grupos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os grupos</SelectItem>
              {Object.entries(GRUPOS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
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
              <th className={`${thCls} text-left`}>Categoria</th>
              <th className={`${thCls} text-left`}>Grupo</th>
              <th className={`${thCls} text-right`}>Lançamentos</th>
              <th className={`${thCls} text-right`}>Valor Total</th>
              <th className={`${thCls} text-right`}>% Receita</th>
              <th className={`${thCls} text-right`}>% do Total</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900">
            {rows.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400 text-sm">Sem despesas no período</td></tr>
            )}
            {rows.map((r, i) => {
              const pctReceita = totalReceita > 0 ? (r.total / totalReceita) * 100 : 0;
              const pctTotal = totalGeral > 0 ? (r.total / totalGeral) * 100 : 0;
              return (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className={`${tdCls} text-slate-400`}>{i + 1}</td>
                  <td className={`${tdCls} font-medium text-slate-800 dark:text-white`}>{r.nome}</td>
                  <td className={`${tdCls}`}>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {GRUPOS_LABEL[r.grupo] || r.grupo}
                    </span>
                  </td>
                  <td className={`${tdCls} text-right text-slate-600 dark:text-slate-400`}>{r.count}</td>
                  <td className={`${tdCls} text-right`}><MoneyDisplay value={r.total} size="sm" /></td>
                  <td className={`${tdCls} text-right font-semibold ${corPct(pctReceita)}`}>{pctReceita.toFixed(1)}%</td>
                  <td className={`${tdCls} text-right`}>
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                        <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${Math.min(pctTotal, 100)}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 w-10 text-right">{pctTotal.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}