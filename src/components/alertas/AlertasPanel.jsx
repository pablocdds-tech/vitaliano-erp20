import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventosFinanceirosService } from '@/components/services/eventosFinanceirosService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import MoneyDisplay from '@/components/ui-custom/MoneyDisplay';
import {
  AlertTriangle,
  AlertCircle,
  Bell,
  CheckCircle2,
  X,
  Zap,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const gravidadeConfig = {
  baixa: { icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  media: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  alta: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  critica: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' }
};

export default function AlertasPanel({ empresa_id, loja_id }) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState(null);

  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ['alertas-ativos', empresa_id],
    queryFn: async () => {
      const verificacoes = await eventosFinanceirosService.executarVerificacoes(empresa_id, loja_id);
      
      // Registrar novos alertas
      for (const alerta of verificacoes) {
        // Verificar se já existe
        const existentes = await base44.entities.Notificacao.filter({
          tipo_alerta: alerta.tipo_alerta,
          entidade_id: alerta.entidade_id,
          status: 'ativa'
        });
        
        if (existentes.length === 0) {
          await eventosFinanceirosService.registrarAlerta(alerta);
        }
      }

      // Retornar alertas ativos
      return await eventosFinanceirosService.listarAlertasAtivos(empresa_id, loja_id);
    },
    refetchInterval: 5 * 60 * 1000 // 5 minutos
  });

  const marcarComoLidoMutation = useMutation({
    mutationFn: (alerta_id) => eventosFinanceirosService.marcarComoLido(alerta_id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alertas-ativos'] })
  });

  const resolverAlertaMutation = useMutation({
    mutationFn: ({ alerta_id, acao }) => eventosFinanceirosService.resolverAlerta(alerta_id, acao),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alertas-ativos'] })
  });

  if (isLoading) {
    return (
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Alertas de IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <div className="animate-spin w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-600" />
            Analisando dados...
          </div>
        </CardContent>
      </Card>
    );
  }

  const alertasCriticas = alertas.filter(a => a.gravidade === 'critica');
  const alertasAltas = alertas.filter(a => a.gravidade === 'alta');

  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Alertas de IA
            {alertas.length > 0 && (
              <span className="ml-2 px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-semibold">
                {alertas.length}
              </span>
            )}
          </CardTitle>
          {alertas.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['alertas-ativos'] })}
            >
              Atualizar
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {alertas.length === 0 ? (
          <div className="py-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 mb-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Nenhum alerta ativo. Tudo em ordem!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alertasCriticas.length > 0 && (
              <div className="border-b border-red-200 dark:border-red-900/30 pb-3 mb-3">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider mb-2">
                  ⚠️ Crítico
                </p>
                <div className="space-y-2">
                  {alertasCriticas.map(alerta => (
                    <AlertaItem
                      key={alerta.id}
                      alerta={alerta}
                      expanded={expandedId === alerta.id}
                      onToggleExpand={() => setExpandedId(expandedId === alerta.id ? null : alerta.id)}
                      onMarcarLido={() => marcarComoLidoMutation.mutate(alerta.id)}
                      onResolver={(acao) => resolverAlertaMutation.mutate({ alerta_id: alerta.id, acao })}
                    />
                  ))}
                </div>
              </div>
            )}

            {alertasAltas.length > 0 && (
              <div className="border-b border-orange-200 dark:border-orange-900/30 pb-3 mb-3">
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wider mb-2">
                  ⚠️ Alto
                </p>
                <div className="space-y-2">
                  {alertasAltas.map(alerta => (
                    <AlertaItem
                      key={alerta.id}
                      alerta={alerta}
                      expanded={expandedId === alerta.id}
                      onToggleExpand={() => setExpandedId(expandedId === alerta.id ? null : alerta.id)}
                      onMarcarLido={() => marcarComoLidoMutation.mutate(alerta.id)}
                      onResolver={(acao) => resolverAlertaMutation.mutate({ alerta_id: alerta.id, acao })}
                    />
                  ))}
                </div>
              </div>
            )}

            {alertas.filter(a => a.gravidade === 'media' || a.gravidade === 'baixa').length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Informações
                </p>
                <div className="space-y-2">
                  {alertas.filter(a => a.gravidade === 'media' || a.gravidade === 'baixa').map(alerta => (
                    <AlertaItem
                      key={alerta.id}
                      alerta={alerta}
                      expanded={expandedId === alerta.id}
                      onToggleExpand={() => setExpandedId(expandedId === alerta.id ? null : alerta.id)}
                      onMarcarLido={() => marcarComoLidoMutation.mutate(alerta.id)}
                      onResolver={(acao) => resolverAlertaMutation.mutate({ alerta_id: alerta.id, acao })}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertaItem({ alerta, expanded, onToggleExpand, onMarcarLido, onResolver }) {
  const config = gravidadeConfig[alerta.gravidade];
  const Icon = config.icon;

  return (
    <div className={cn('rounded-lg p-3 border transition-all', config.bg, 'border-transparent')}>
      <div className="flex items-start gap-3">
        <Icon className={cn('w-4 h-4 flex-shrink-0 mt-0.5', config.color)} />
        
        <div className="flex-1 min-w-0">
          <button
            onClick={onToggleExpand}
            className="text-left w-full hover:opacity-75 transition-opacity"
          >
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {alerta.titulo}
            </p>
            {expanded && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                {alerta.descricao}
              </p>
            )}
          </button>

          {expanded && alerta.sugestao_ia && (
            <div className="mt-3 p-2 bg-white/50 dark:bg-slate-900/50 rounded border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-2">
                <Zap className="w-3 h-3 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">Sugestão IA:</span> {alerta.sugestao_ia}
                </p>
              </div>
            </div>
          )}

          {expanded && (
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                size="xs"
                onClick={() => onResolver('ignorado')}
                className="text-xs"
              >
                <X className="w-3 h-3 mr-1" />
                Ignorar
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => onResolver('resolvido')}
                className="text-xs"
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Resolver
              </Button>
            </div>
          )}
        </div>

        <button
          onClick={onToggleExpand}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <ArrowRight className={cn('w-4 h-4 transition-transform', expanded && 'rotate-90')} />
        </button>
      </div>
    </div>
  );
}