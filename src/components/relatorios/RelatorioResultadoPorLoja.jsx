import React, { useMemo } from 'react';
import MoneyDisplay from '@/components/ui-custom/MoneyDisplay';
import { Button } from '@/components/ui/button';
import { Download, TrendingUp, TrendingDown } from 'lucide-react';

function exportCSV(rows) {
  const header = ['Loja', 'Receita', 'CMV', 'Despesas', 'Lucro', 'Margem %'];
  const lines = [header, ...rows.map(r => [r.nome, r.receita.toFixed(2), r.cmv.toFixed(2), r.despesas.toFixed(2), r.lucro.toFixed(2), r.margem.toFixed(2)])];
  const csv = lines.map(l => l.join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'resultado_por_loja.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function RelatorioResultadoPorLoja({ vendas, contasPagar, contasReceber, categoriasDRE, lojas }) {
  const rows = useMemo(() => {
    const map = {};

    // Inicializar lojas
    lojas.forEach(l => {
      map[l.id] = { id: l.id, nome: l.nome, tipo: l.tipo, receita: 0, cmv: 0, despesas: 0 };
    });
    map['__consolidado'] = { id: '__consolidado', nome: 'CONSOLIDADO', tipo: null, receita: 0, cmv: 0, despesas: 0 };

    // Receita de vendas
    vendas.forEach(v => {
      const val = v.valor_liquido || 0;
      if (map[v.loja_id]) map[v.loja_id].receita += val;
      map['__consolidado'].receita += val;
    });
    // Receita de ContasReceber (não venda)
    contasReceber.filter(c => c.status === 'recebido').forEach(c => {
      const val = c.valor_recebido || c.valor_original || 0;
      if (map[c.loja_id]) map[c.loja_id].receita += val;
      map['__consolidado'].receita += val;
    });

    // CMV e despesas
    contasPagar.filter(c => c.status === 'pago').forEach(cp => {
      const cat = categoriasDRE.find(c => c.id === cp.categoria_dre_id);
      const val = cp.valor_pago || cp.valor_original || 0;
      const grupo = cat?.grupo || 'outros';
      const isCMV = grupo === 'cmv';
      if (map[cp.loja_id]) {
        if (isCMV) map[cp.loja_id].cmv += val;
        else map[cp.loja_id].despesas += val;
      }
      if (isCMV) map['__consolidado'].cmv += val;
      else map['__consolidado'].despesas += val;
    });

    return Object.values(map)
      .map(r => ({ ...r, lucro: r.receita - r.cmv - r.despesas, margem: r.receita > 0 ? ((r.receita - r.cmv - r.despesas) / r.receita) * 100 : 0 }))
      .sort((a, b) => {
        if (a.id === '__consolidado') return 1;
        if (b.id === '__consolidado') return -1;
        return b.lucro - a.lucro;
      });
  }, [vendas, contasPagar, contasReceber, categoriasDRE, lojas]);

  const thCls = "text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4 bg-slate-50 dark:bg-slate-800";
  const tdCls = "py-3 px-4 text-sm border-b border-slate-100 dark:border-slate-800";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => exportCSV(rows.filter(r => r.id !== '__consolidado'))}>
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className={`${thCls} text-left`}>Loja</th>
              <th className={`${thCls} text-right`}>Receita Líquida</th>
              <th className={`${thCls} text-right`}>CMV</th>
              <th className={`${thCls} text-right`}>Despesas</th>
              <th className={`${thCls} text-right`}>Lucro</th>
              <th className={`${thCls} text-center`}>Margem %</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900">
            {rows.filter(r => r.id !== '__consolidado').map((r, i) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className={`${tdCls} font-medium text-slate-800 dark:text-white`}>
                  <div>
                    {r.nome}
                    {r.tipo && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">{r.tipo.toUpperCase()}</span>}
                  </div>
                </td>
                <td className={`${tdCls} text-right text-emerald-600 dark:text-emerald-400`}><MoneyDisplay value={r.receita} size="sm" /></td>
                <td className={`${tdCls} text-right text-red-600 dark:text-red-400`}><MoneyDisplay value={r.cmv} size="sm" /></td>
                <td className={`${tdCls} text-right text-orange-600 dark:text-orange-400`}><MoneyDisplay value={r.despesas} size="sm" /></td>
                <td className={`${tdCls} text-right font-semibold ${r.lucro >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                  <MoneyDisplay value={r.lucro} size="sm" colorize />
                </td>
                <td className={`${tdCls} text-center`}>
                  <div className="flex items-center justify-center gap-1.5">
                    {r.lucro >= 0
                      ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                    <span className={`font-bold text-sm ${r.margem >= 10 ? 'text-emerald-600 dark:text-emerald-400' : r.margem >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                      {r.margem.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {/* Consolidado */}
          {(() => {
            const cons = rows.find(r => r.id === '__consolidado');
            if (!cons) return null;
            return (
              <tfoot>
                <tr className="bg-slate-800 dark:bg-slate-700">
                  <td className="py-3 px-4 text-sm font-bold text-white">CONSOLIDADO</td>
                  <td className="py-3 px-4 text-right text-sm font-bold text-emerald-300"><MoneyDisplay value={cons.receita} size="sm" /></td>
                  <td className="py-3 px-4 text-right text-sm font-bold text-red-300"><MoneyDisplay value={cons.cmv} size="sm" /></td>
                  <td className="py-3 px-4 text-right text-sm font-bold text-orange-300"><MoneyDisplay value={cons.despesas} size="sm" /></td>
                  <td className={`py-3 px-4 text-right text-sm font-bold ${cons.lucro >= 0 ? 'text-emerald-300' : 'text-red-300'}`}><MoneyDisplay value={cons.lucro} size="sm" /></td>
                  <td className="py-3 px-4 text-center text-sm font-bold text-white">{cons.margem.toFixed(1)}%</td>
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>
    </div>
  );
}