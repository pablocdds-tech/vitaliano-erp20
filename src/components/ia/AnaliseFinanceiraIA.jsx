/**
 * Bloco de Análise Inteligente Financeira — inserido na página IAExecutora
 * IA apenas analisa e sugere. Nenhuma alteração automática.
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { gerarDiagnosticoPeriodo, preverFluxoCaixa } from '@/components/services/iaFinanceiraService';
import {
  TrendingUp, TrendingDown, Minus,
  AlertTriangle, Lightbulb, BarChart2,
  Loader2, Shield, CheckCircle2, Brain
} from 'lucide-react';
import { toast } from 'sonner';

const NIVEL_COR = {
  alto: 'text-red-600 bg-red-50 border-red-200',
  medio: 'text-amber-600 bg-amber-50 border-amber-200',
  baixo: 'text-blue-600 bg-blue-50 border-blue-200',
};

const TENDENCIA_ICON = {
  superavit: <TrendingUp className="w-5 h-5 text-emerald-500" />,
  equilibrio: <Minus className="w-5 h-5 text-slate-400" />,
  deficit_leve: <TrendingDown className="w-5 h-5 text-amber-500" />,
  deficit_critico: <TrendingDown className="w-5 h-5 text-red-600" />,
  positiva: <TrendingUp className="w-5 h-5 text-emerald-500" />,
  negativa: <TrendingDown className="w-5 h-5 text-red-600" />,
  neutra: <Minus className="w-5 h-5 text-slate-400" />,
};

function ScoreCircle({ score }) {
  const color = score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-red-600';
  const label = score >= 70 ? 'Saudável' : score >= 40 ? 'Atenção' : 'Crítico';
  return (
    <div className="flex flex-col items-center justify-center w-24 h-24 rounded-full border-4 border-slate-100 bg-white shadow-sm">
      <span className={`text-2xl font-bold ${color}`}>{score}</span>
      <span className={`text-xs font-medium ${color}`}>{label}</span>
    </div>
  );
}

export default function AnaliseFinanceiraIA() {
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [loadingFluxo, setLoadingFluxo] = useState(false);
  const [diagnostico, setDiagnostico] = useState(null);
  const [fluxo, setFluxo] = useState(null);
  const [tab, setTab] = useState('diagnostico'); // 'diagnostico' | 'fluxo'

  const handleDiagnostico = async () => {
    setLoadingDiag(true);
    try {
      const res = await gerarDiagnosticoPeriodo();
      setDiagnostico(res);
      setTab('diagnostico');
    } catch (e) {
      toast.error('Erro ao gerar diagnóstico: ' + e.message);
    } finally {
      setLoadingDiag(false);
    }
  };

  const handleFluxo = async () => {
    setLoadingFluxo(true);
    try {
      const res = await preverFluxoCaixa();
      setFluxo(res);
      setTab('fluxo');
    } catch (e) {
      toast.error('Erro ao prever fluxo: ' + e.message);
    } finally {
      setLoadingFluxo(false);
    }
  };

  return (
    <Card className="border-indigo-100 dark:border-indigo-900">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="w-5 h-5 text-indigo-600" />
            Análise Inteligente Financeira
            <span className="text-xs font-normal text-slate-400 ml-1">— IA apenas sugere, nunca executa</span>
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDiagnostico}
              disabled={loadingDiag || loadingFluxo}
              className="gap-2"
            >
              {loadingDiag ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4 text-indigo-500" />}
              Diagnóstico do Mês
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleFluxo}
              disabled={loadingDiag || loadingFluxo}
              className="gap-2"
            >
              {loadingFluxo ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4 text-emerald-500" />}
              Prever 30 Dias
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-5">
        {/* Estado vazio */}
        {!diagnostico && !fluxo && !loadingDiag && !loadingFluxo && (
          <div className="text-center py-8 text-slate-400">
            <Brain className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Clique em "Diagnóstico do Mês" ou "Prever 30 Dias" para gerar uma análise financeira real com IA.</p>
            <p className="text-xs mt-1 text-slate-300">Todas as análises são auditadas no Action Log.</p>
          </div>
        )}

        {/* Loading */}
        {(loadingDiag || loadingFluxo) && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm text-slate-500">
              {loadingDiag ? 'Coletando dados e analisando saúde financeira...' : 'Projetando fluxo de caixa para os próximos 30 dias...'}
            </p>
          </div>
        )}

        {/* RESULTADO DIAGNÓSTICO */}
        {diagnostico && tab === 'diagnostico' && !loadingDiag && (
          <div className="space-y-5">
            {/* Score + resumo */}
            <div className="flex gap-4 items-start p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <ScoreCircle score={diagnostico.score_saude ?? 0} />
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Resumo Executivo</p>
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{diagnostico.resumo_executivo}</p>
              </div>
            </div>

            {/* Previsão de caixa */}
            {diagnostico.previsao_caixa && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-white dark:bg-slate-900">
                {TENDENCIA_ICON[diagnostico.previsao_caixa.tendencia]}
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-white">
                    {diagnostico.previsao_caixa.dias_ate_deficit != null
                      ? `⚠️ Déficit em aproximadamente ${diagnostico.previsao_caixa.dias_ate_deficit} dias`
                      : 'Caixa estável no horizonte analisado'}
                  </p>
                  <p className="text-xs text-slate-500">{diagnostico.previsao_caixa.observacao}</p>
                </div>
              </div>
            )}

            {/* Alertas */}
            {(diagnostico.alertas || []).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Alertas
                </p>
                {diagnostico.alertas.map((a, i) => (
                  <div key={i} className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{a.titulo}</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{a.detalhe}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Riscos */}
            {(diagnostico.riscos || []).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-red-500" /> Riscos Identificados
                </p>
                {diagnostico.riscos.map((r, i) => (
                  <div key={i} className={`flex gap-2 p-3 rounded-lg border text-sm ${NIVEL_COR[r.nivel] || NIVEL_COR.baixo}`}>
                    <span className="font-bold uppercase text-xs mt-0.5 shrink-0">{r.nivel}</span>
                    <div>
                      <p className="font-medium">{r.titulo}</p>
                      <p className="text-xs mt-0.5 opacity-80">{r.descricao}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sugestões */}
            {(diagnostico.sugestoes || []).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Lightbulb className="w-3.5 h-3.5 text-purple-500" /> Sugestões de Ação
                </p>
                {[...diagnostico.sugestoes].sort((a, b) => a.prioridade - b.prioridade).map((s, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-lg bg-purple-50 border border-purple-100 dark:bg-purple-900/20 dark:border-purple-800">
                    <span className="w-6 h-6 rounded-full bg-purple-200 dark:bg-purple-700 flex items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-200 shrink-0">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-purple-800 dark:text-purple-200">{s.acao}</p>
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">{s.impacto_esperado}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-slate-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Análise registrada no Action Log
            </p>
          </div>
        )}

        {/* RESULTADO FLUXO */}
        {fluxo && tab === 'fluxo' && !loadingFluxo && (
          <div className="space-y-5">
            {/* Tendência + análise */}
            <div className="flex gap-4 items-start p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className="flex flex-col items-center gap-1 shrink-0">
                {TENDENCIA_ICON[fluxo.tendencia]}
                <span className="text-xs font-medium text-slate-500 capitalize">{(fluxo.tendencia || '').replace('_', ' ')}</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{fluxo.analise}</p>
            </div>

            {/* Alerta crítico */}
            {fluxo.alerta_critico && (
              <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">{fluxo.alerta_critico}</p>
              </div>
            )}

            {/* Ações recomendadas */}
            {(fluxo.acoes_recomendadas || []).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Lightbulb className="w-3.5 h-3.5 text-purple-500" /> Ações Recomendadas
                </p>
                {fluxo.acoes_recomendadas.map((a, i) => (
                  <div key={i} className="flex gap-2 text-sm p-2.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800">
                    <span className="text-purple-500 font-bold shrink-0">{i + 1}.</span>
                    <p className="text-slate-700 dark:text-slate-200">{a}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Mini-tabela dos piores dias */}
            {(fluxo.projecaoDiaria || []).some(d => d.saldo_acumulado < 0) && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Dias Críticos (saldo negativo)</p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                      <tr>
                        <th className="text-left p-2 font-medium text-slate-500">Data</th>
                        <th className="text-right p-2 font-medium text-slate-500">Entradas</th>
                        <th className="text-right p-2 font-medium text-slate-500">Saídas</th>
                        <th className="text-right p-2 font-medium text-slate-500">Saldo Acum.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {fluxo.projecaoDiaria.filter(d => d.saldo_acumulado < 0).slice(0, 7).map((d, i) => (
                        <tr key={i} className="bg-red-50/50 dark:bg-red-900/10">
                          <td className="p-2 font-mono">{d.dia}</td>
                          <td className="p-2 text-right text-emerald-600">+R${d.entradas.toFixed(0)}</td>
                          <td className="p-2 text-right text-red-600">-R${d.saidas.toFixed(0)}</td>
                          <td className="p-2 text-right font-bold text-red-700">R${d.saldo_acumulado.toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <p className="text-xs text-slate-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Previsão registrada no Action Log
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}