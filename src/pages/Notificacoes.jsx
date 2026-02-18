import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import EmptyState from '@/components/ui-custom/EmptyState';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Bell, CheckCircle2, AlertCircle, AlertTriangle, AlertOctagon, Eye } from 'lucide-react';
import { toast } from 'sonner';

const gravityConfig = {
  baixa: { icon: Bell, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  media: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  alta: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  critica: { icon: AlertOctagon, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' }
};

export default function Notificacoes() {
  const queryClient = useQueryClient();
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: notificacoes = [], isLoading } = useQuery({
    queryKey: ['notificacoes'],
    queryFn: () => base44.entities.Notificacao.list('-updated_date', 100)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Notificacao.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
      toast.success('Notificação atualizada!');
    }
  });

  const handleMarkAsRead = (notif) => {
    updateMutation.mutate({ id: notif.id, data: { lida: true } });
  };

  const handleResolve = (notif) => {
    updateMutation.mutate({ id: notif.id, data: { status: 'resolvida', acao_tomada: 'resolvida' } });
  };

  const handleIgnore = (notif) => {
    updateMutation.mutate({ id: notif.id, data: { status: 'ignorada', acao_tomada: 'ignorada' } });
  };

  const ativas = notificacoes.filter(n => n.status === 'ativa');
  const resolvidas = notificacoes.filter(n => n.status === 'resolvida');
  const ignoradas = notificacoes.filter(n => n.status === 'ignorada');

  const renderNotificacaoItem = (notif) => {
    const config = gravityConfig[notif.gravidade] || gravityConfig.media;
    const Icon = config.icon;

    return (
      <div
        key={notif.id}
        className={`flex gap-4 p-4 rounded-lg border transition-all ${notif.lida ? 'bg-slate-50 dark:bg-slate-900/30' : 'bg-white dark:bg-slate-900 border-l-4'} ${config.bg} border`}
        style={!notif.lida ? { borderLeftColor: 'inherit' } : {}}
      >
        <div className={`flex-shrink-0 ${config.color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className={`text-sm font-medium ${notif.lida ? 'text-slate-600' : 'text-slate-900 dark:text-white'}`}>
                {notif.titulo}
              </p>
              <p className="text-xs text-slate-500 mt-1">{notif.descricao}</p>
            </div>
            {!notif.lida && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />}
          </div>
          <div className="flex gap-2 mt-3">
            {!notif.lida && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                onClick={() => handleMarkAsRead(notif)}
              >
                <Eye className="w-3 h-3" />
                Marcar como lida
              </Button>
            )}
            {notif.status === 'ativa' && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => handleResolve(notif)}
                >
                  Resolver
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-slate-500"
                  onClick={() => handleIgnore(notif)}
                >
                  Ignorar
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs ml-auto"
              onClick={() => {
                setSelectedNotif(notif);
                setDetailsOpen(true);
              }}
            >
              Detalhes
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificações"
        subtitle="Alertas de IA financeira e operacional"
        icon={Bell}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Notificações' }]}
      />

      {notificacoes.length === 0 && !isLoading ? (
        <EmptyState icon={Bell} title="Sem notificações" description="Você está em dia com tudo!" />
      ) : (
        <div className="space-y-6">
          {ativas.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Ativas ({ativas.length})</h2>
              </div>
              <div className="space-y-2">
                {ativas.map(renderNotificacaoItem)}
              </div>
            </div>
          )}

          {resolvidas.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-600">
                <h2 className="text-sm font-medium">Resolvidas ({resolvidas.length})</h2>
              </div>
              <div className="space-y-2">
                {resolvidas.map(renderNotificacaoItem)}
              </div>
            </div>
          )}

          {ignoradas.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-500">
                <h2 className="text-sm font-medium">Ignoradas ({ignoradas.length})</h2>
              </div>
              <div className="space-y-2 opacity-60">
                {ignoradas.map(renderNotificacaoItem)}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedNotif && (
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedNotif.titulo}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Severidade</p>
                <StatusBadge status={selectedNotif.gravidade} size="md" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Descrição</p>
                <p className="text-sm text-slate-800 dark:text-white">{selectedNotif.descricao}</p>
              </div>
              {selectedNotif.sugestao_ia && (
                <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Sugestão IA</p>
                  <p className="text-sm text-slate-800 dark:text-white">{selectedNotif.sugestao_ia}</p>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Tipo</p>
                <p className="text-sm capitalize">{selectedNotif.tipo_alerta?.replace(/_/g, ' ')}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}