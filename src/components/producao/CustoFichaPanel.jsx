/**
 * Painel que exibe o custo calculado automaticamente de uma Ficha Técnica,
 * usando custo médio atual dos insumos no estoque.
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import MoneyDisplay, { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import { calcularCustoFicha } from '@/components/services/producaoService';
import { toast } from 'sonner';

export default function CustoFichaPanel({ fichaTecnicaId, lojaId, empresaId, quantidade = 1 }) {
  const [calculando, setCalculando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const calcular = async () => {
    if (!lojaId || !empresaId) {
      toast.error('Selecione empresa e loja primeiro.');
      return;
    }
    setCalculando(true);
    try {
      const r = await calcularCustoFicha(fichaTecnicaId, lojaId, empresaId);
      setResultado(r);
    } catch (e) {
      toast.error('Erro ao calcular custo: ' + e.message);
    } finally {
      setCalculando(false);
    }
  };

  if (!fichaTecnicaId) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Custo calculado (custo médio atual)</p>
        <Button size="sm" variant="outline" onClick={calcular} disabled={calculando} className="gap-1.5 text-xs">
          {calculando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {resultado ? 'Recalcular' : 'Calcular custo'}
        </Button>
      </div>

      {resultado && (
        <>
          {/* Insumos */}
          <div className="space-y-1.5">
            {resultado.ingredientes_com_custo.map((ing, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">
                  {ing.produto_id?.substring(0, 8)}… × {ing.quantidade} {ing.unidade}
                </span>
                <div className="flex items-center gap-2">
                  {ing.custo_unitario === 0 && (
                    <AlertTriangle className="w-3 h-3 text-amber-500" title="Sem custo médio cadastrado" />
                  )}
                  <span className="font-medium">{formatMoney(ing.custo_linha)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Custo total do lote</p>
              <MoneyDisplay value={resultado.custo_total} size="lg" />
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Custo unitário × {quantidade}</p>
              <MoneyDisplay value={resultado.custo_unitario * quantidade} size="lg" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}