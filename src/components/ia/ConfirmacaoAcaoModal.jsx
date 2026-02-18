import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Bot, CheckCircle2, Loader2 } from 'lucide-react';

const TIPO_LABELS = {
  processar_nf: 'Processamento de Nota Fiscal',
  criar_lancamento: 'Lançamento Financeiro',
  atualizar_estoque: 'Atualização de Estoque',
  gerar_relatorio: 'Geração de Relatório',
  criar_pedido: 'Criação de Pedido',
  outro: 'Ação Genérica',
};

// Ações que são críticas (alteram dados financeiros ou estoque)
const ACOES_CRITICAS = ['criar_lancamento', 'atualizar_estoque', 'processar_nf', 'criar_pedido'];

export default function ConfirmacaoAcaoModal({ acao, onConfirmar, onCancelar, loading }) {
  if (!acao) return null;

  const critica = ACOES_CRITICAS.includes(acao.tipo_acao);

  return (
    <Dialog open={!!acao} onOpenChange={() => !loading && onCancelar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-600" />
            IA quer executar uma ação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo da ação */}
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium uppercase tracking-wider">
            <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">
              {TIPO_LABELS[acao.tipo_acao] || acao.tipo_acao}
            </span>
          </div>

          {/* Descrição */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">O que será feito:</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{acao.descricao}</p>
          </div>

          {/* Payload resumido */}
          {acao.payload && Object.keys(acao.payload).length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2 bg-slate-50 dark:bg-slate-800">
                Parâmetros
              </p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {Object.entries(acao.payload).map(([k, v]) => (
                  <div key={k} className="flex justify-between px-4 py-2 text-sm">
                    <span className="text-slate-500">{k}</span>
                    <span className="font-medium text-slate-800 dark:text-white text-right max-w-[60%] truncate">
                      {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Aviso de ação crítica */}
          {critica && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Esta ação irá <strong>alterar dados reais</strong> do sistema. Confirme apenas se tiver certeza.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancelar} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirmar}
            disabled={loading}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Executando...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" /> Confirmar execução</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}