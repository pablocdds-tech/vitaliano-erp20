import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { eventosFinanceirosService } from '@/components/services/eventosFinanceirosService';
import {
  Bell,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Notificacoes() {
  const queryClient = useQueryClient();
  const [empresa_id, setEmpresa_id] = useState(null);

  useEffect(() => {
    async function getEmpresa() {
      try {
        const user = await base44.auth.me();
        setEmpresa_id(user.empresa_id);
      } catch {
        const empresas = await base44.entities.Empresa.list();
        if (empresas.length > 0) setEmpresa_id(empresas[0].id);
      }
    }
    getEmpresa();
  }, []);

  const { data: notificacoes = [], isLoading, refetch } = useQuery({
    queryKey: ['notificacoes', empresa_id],
    queryFn: () => empresa_id ? eventosFinanceirosService.listarAlertasAtivos(empresa_id) : [],
    enabled: !!empresa_id
  });

  const marcarLidaMutation = useMutation({
    mutationFn: (id) => eventosFinanceirosService.marcarComoLido(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
      toast.success('Notificação marcada como lida');
    }
  });

  const resolverMutation = useMutation({
    mutationFn: ({ id, acao }) => eventosFinanceirosService.resolverAlerta(id, acao),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
      toast.success('Notificação resolvida');
    }
  });

  const ativas = notificacoes.filter(n => n.status === 'ativa');
  const resolvidas = notificacoes.filter(n => n.status === 'resolvida');

  const getIcon = (gravidade) => {
    switch(gravidade) {
      case 'critica': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'alta': return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'media': return <AlertCircle className="w-5 h-5 text-amber-600" />;
      default: return <AlertCircle className="w-5 h-5 text-blue-600" />;
    }
  };

  const NotificacaoCard = ({ notif }) => (
    <Card className="mb-3">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="mt-1">
            {getIcon(notif.gravidade)}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-medium text-slate-900 dark:text-white">{notif.titulo}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{notif.descricao}</p>
              </div>
              <StatusBadge status={notif.gravidade} customLabel={notif.gravidade.toUpperCase()} size="xs" />
            </div>

            {notif.sugestao_ia && (
              <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                <p className="text-xs text-yellow-900 dark:text-yellow-200">
                  <strong>💡 IA sugere:</strong> {notif.sugestao_ia}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
              <span>{format(new Date(notif.created_date), 'dd/MM HH:mm')}</span>
            </div>
          </div>
        </div>

        {notif.status === 'ativa' && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button
              size="sm"
              variant="outline"
              onClick={() => marcarLidaMutation.mutate(notif.id)}
              disabled={marcarLidaMutation.isPending}
            >
              Marcar como lido
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-emerald-600 hover:text-emerald-700"
              onClick={() => resolverMutation.mutate({ id: notif.id, acao: 'resolvido' })}
              disabled={resolverMutation.isPending}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Resolver
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700"
              onClick={() => resolverMutation.mutate({ id: notif.id, acao: 'ignorado' })}
              disabled={resolverMutation.isPending}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificações"
        subtitle="Alertas e sugestões da IA financeira"
        icon={Bell}
        breadcrumbs={[
          { label: 'Dashboard', href: 'Dashboard' },
          { label: 'Notificações' }
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Atualizar
          </Button>
        }
      />

      {!empresa_id ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-slate-500">Carregando...</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="ativas" className="w-full">
          <TabsList>
            <TabsTrigger value="ativas">Ativas ({ativas.length})</TabsTrigger>
            <TabsTrigger value="resolvidas">Resolvidas ({resolvidas.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="ativas" className="mt-6">
            {ativas.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
                    <p className="text-slate-600 dark:text-slate-400">Nenhuma notificação ativa</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div>
                {ativas.map(notif => (
                  <NotificacaoCard key={notif.id} notif={notif} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="resolvidas" className="mt-6">
            {resolvidas.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <p className="text-slate-600 dark:text-slate-400">Nenhuma notificação resolvida</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div>
                {resolvidas.map(notif => (
                  <NotificacaoCard key={notif.id} notif={notif} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}