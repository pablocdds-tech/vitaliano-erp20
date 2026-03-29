import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Coffee, AlertTriangle, ExternalLink, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { calcularMinutosTrabalhados, formatarMinutos } from './pontoUtils';

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
    <div className="space-y-6">
      {/* Contadores */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center"><Users className="w-5 h-5" /></div>
            <div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{trabalhando.length}</p>
              <p className="text-xs text-emerald-600">Trabalhando</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center"><Coffee className="w-5 h-5" /></div>
            <div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{descanso.length}</p>
              <p className="text-xs text-amber-600">Descanso</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-400 text-white flex items-center justify-center"><AlertTriangle className="w-5 h-5" /></div>
            <div>
              <p className="text-2xl font-bold text-slate-700 dark:text-slate-400">{fora.length}</p>
              <p className="text-xs text-slate-600">Ausentes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => window.open('/ponto-kiosk', '_blank')} className="gap-2">
          <ExternalLink className="w-4 h-4" /> Abrir Quiosque
        </Button>
      </div>

      {/* Trabalhando */}
      {trabalhando.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Trabalhando Agora</CardTitle>
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
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Coffee className="w-4 h-4 text-amber-500" /> Em Descanso</CardTitle>
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
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-slate-500"><Clock className="w-4 h-4" /> Ainda não chegaram</CardTitle>
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