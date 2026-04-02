import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Coffee, AlertTriangle, ExternalLink, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { calcularMinutosTrabalhados, formatarMinutos } from './pontoUtils';
import { pontoSectionText, pontoSectionTitle, pontoStatCardClasses, pontoSurface } from './pontoStyles';

export default function PontoQuiosqueAoVivo() {
  const hoje = format(new Date(), 'yyyy-MM-dd');

  const { data: funcPontos = [] } = useQuery({
    queryKey: ['func-pontos-live'],
    queryFn: () => base44.entities.FuncionarioPonto.list(),
    refetchInterval: 10000,
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['funcionarios-ponto'],
    queryFn: () => base44.entities.Funcionario.filter({ status: 'ativo' }, 'nome'),
  });

  const { data: pontosHoje = [] } = useQuery({
    queryKey: ['pontos-hoje-live', hoje],
    queryFn: () => base44.entities.RegistroPonto.filter({ data: hoje }),
    refetchInterval: 10000,
  });

  const getFuncNome = (id) => funcionarios.find(f => f.id === id)?.nome || '—';
  const getFuncCargo = (id) => funcionarios.find(f => f.id === id)?.cargo || '';

  const trabalhando = funcPontos.filter(fp => fp.status_atual === 'trabalhando');
  const descanso = funcPontos.filter(fp => fp.status_atual === 'descanso');
  const fora = funcPontos.filter(fp => !fp.status_atual || fp.status_atual === 'fora');

  const getPontosFunc = (funcId) => pontosHoje.filter(p => p.funcionario_id === funcId);

  const getEntrada = (funcId) => {
    const entrada = pontosHoje.find(p => p.funcionario_id === funcId && p.tipo === 'entrada');
    return entrada ? format(new Date(entrada.horario), 'HH:mm') : '—';
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h2 className={pontoSectionTitle}>Monitoramento do Quiosque</h2>
          <p className={pontoSectionText}>Acompanhe a operação do ponto em tempo real com leitura clara no desktop e navegação simples no celular.</p>
        </div>
        <Button variant="outline" onClick={() => window.open('/ponto-kiosk', '_blank')} className="h-11 gap-2 rounded-xl px-4 self-start lg:self-auto">
          <ExternalLink className="w-4 h-4" /> Abrir Quiosque
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className={pontoStatCardClasses('emerald')}>
          <CardContent className="flex items-center gap-3 p-4 sm:p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white"><Users className="w-5 h-5" /></div>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{trabalhando.length}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Em atividade</p>
            </div>
          </CardContent>
        </Card>
        <Card className={pontoStatCardClasses('amber')}>
          <CardContent className="flex items-center gap-3 p-4 sm:p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-white"><Coffee className="w-5 h-5" /></div>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{descanso.length}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Em pausa</p>
            </div>
          </CardContent>
        </Card>
        <Card className={pontoStatCardClasses('slate')}>
          <CardContent className="flex items-center gap-3 p-4 sm:p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-500 text-white"><AlertTriangle className="w-5 h-5" /></div>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{fora.length}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Fora do turno</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trabalhando */}
      {trabalhando.length > 0 && (
        <Card className={pontoSurface}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Trabalhando Agora</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {trabalhando.map(fp => (
                <div key={fp.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-sm font-bold text-emerald-700">
                    {fp.foto_perfil_url ? <img src={fp.foto_perfil_url} className="w-full h-full rounded-full object-cover" /> : getFuncNome(fp.funcionario_id).charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{getFuncNome(fp.funcionario_id)}</p>
                    <p className="text-xs text-muted-foreground">{getFuncCargo(fp.funcionario_id)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Entrada: {getEntrada(fp.funcionario_id)}</p>
                    <p className="text-xs font-medium text-emerald-600">{formatarMinutos(calcularMinutosTrabalhados(getPontosFunc(fp.funcionario_id)))}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Descanso */}
      {descanso.length > 0 && (
        <Card className={pontoSurface}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><Coffee className="w-4 h-4 text-amber-500" /> Em Descanso</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {descanso.map(fp => (
                <div key={fp.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center text-sm font-bold text-amber-700">
                    {getFuncNome(fp.funcionario_id).charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{getFuncNome(fp.funcionario_id)}</p>
                  </div>
                  <Badge variant="outline" className="text-amber-600 border-amber-300">Em descanso</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ausentes */}
      {fora.length > 0 && (
        <Card className={pontoSurface}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300"><Clock className="w-4 h-4" /> Ainda não chegaram</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {fora.map(fp => (
                <div key={fp.id} className="flex items-center gap-3 px-6 py-3 opacity-60">
                  <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-500">
                    {getFuncNome(fp.funcionario_id).charAt(0)}
                  </div>
                  <p className="text-sm font-medium truncate">{getFuncNome(fp.funcionario_id)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}