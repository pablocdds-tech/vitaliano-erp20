/**
 * Banner de aviso de assinatura vencida/bloqueada.
 * Exibido globalmente no Layout quando assinatura inválida.
 */
import React from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

export default function BloqueioAssinatura({ status, motivo, onDismiss }) {
  const isBloqueada = status === 'bloqueada';
  const isVencida = status === 'vencida';

  if (!isBloqueada && !isVencida) return null;

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium ${isBloqueada ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
      {isBloqueada ? <Lock className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
      <span className="flex-1">
        {isBloqueada
          ? `Empresa bloqueada: ${motivo}`
          : `Assinatura vencida. Operações críticas estão limitadas. ${motivo}`
        }
      </span>
      <a href={createPageUrl('AdminSaaS')} className="underline text-white/90 hover:text-white text-xs">
        Ver planos
      </a>
    </div>
  );
}

/** Overlay que bloqueia um recurso específico quando plano não permite */
export function RecursoBloqueado({ recurso, mensagem }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
        <Lock className="w-8 h-8 text-slate-400" />
      </div>
      <div>
        <p className="text-lg font-semibold text-slate-700">Recurso não disponível</p>
        <p className="text-sm text-slate-500 mt-1 max-w-xs">{mensagem || `O recurso "${recurso}" não está disponível no seu plano atual.`}</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => window.location.href = createPageUrl('AdminSaaS')}>
        Ver planos disponíveis
      </Button>
    </div>
  );
}