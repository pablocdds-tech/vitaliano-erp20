import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, CheckCircle2, X, Link2, AlertTriangle } from 'lucide-react';
import { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import { sugerirConciliacao } from '@/components/services/conciliacaoInteligenteService';
import { toast } from 'sonner';

const SCORE_COR = (score) => {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-500';
};

const SCORE_BG = (score) => {
  if (score >= 80) return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800';
  if (score >= 50) return 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800';
  return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
};

export default function SugestaoIAConciliacao({ transacao, contasReceber, contasPagar, onConfirmar, onIgnorar }) {
  const [carregando, setCarregando] = useState(false);
  const [sugestao, setSugestao] = useState(null);

  const analisar = async () => {
    setCarregando(true);
    try {
      const resultado = await sugerirConciliacao(transacao, contasReceber, contasPagar);
      setSugestao(resultado);
    } catch (e) {
      toast.error('Erro ao gerar sugestão da IA');
    } finally {
      setCarregando(false);
    }
  };

  const handleConfirmar = () => {
    if (!sugestao) return;
    onConfirmar({
      tipo: sugestao.tipo,
      id: sugestao.id,
      itemSugerido: sugestao.itemSugerido,
    });
    setSugestao(null);
  };

  const handleIgnorar = () => {
    setSugestao(null);
    onIgnorar && onIgnorar();
  };

  if (sugestao) {
    return (
      <div className={`rounded-xl border p-4 space-y-3 ${SCORE_BG(sugestao.score)}`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Sugestão da IA</span>
          </div>
          <span className={`text-sm font-bold ${SCORE_COR(sugestao.score)}`}>
            Confiança: {sugestao.score}%
          </span>
        </div>

        {/* Sugestão */}
        {sugestao.tipo === 'movimento_avulso' ? (
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Nenhuma conta correspondente encontrada</p>
              <p className="text-xs text-slate-500 mt-0.5">{sugestao.explicacao}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                {sugestao.tipo === 'conta_receber' ? 'Conta a Receber' : 'Conta a Pagar'}
              </span>
            </div>
            {sugestao.itemSugerido && (
              <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-white">
                    {sugestao.itemSugerido.descricao}
                  </p>
                  <p className="text-xs text-slate-400">
                    Vence: {sugestao.itemSugerido.data_vencimento} • {formatMoney(sugestao.itemSugerido.valor_original)}
                  </p>
                </div>
              </div>
            )}
            <p className="text-xs text-slate-500 italic">{sugestao.explicacao}</p>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-2 pt-1">
          {sugestao.tipo !== 'movimento_avulso' && sugestao.id && (
            <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-xs" onClick={handleConfirmar}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar sugestão
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleIgnorar}>
            <X className="w-3.5 h-3.5" /> Ignorar
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs ml-auto" onClick={() => { setSugestao(null); }}>
            <Link2 className="w-3.5 h-3.5" /> Conciliar manualmente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-400"
      onClick={analisar}
      disabled={carregando}
    >
      {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
      {carregando ? 'Analisando...' : 'Sugerir com IA'}
    </Button>
  );
}