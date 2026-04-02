import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Printer, ChevronDown } from 'lucide-react';
import { pontoInputLabel, pontoSectionText, pontoSectionTitle, pontoStatCardClasses, pontoSurface, pontoToolbar } from './pontoStyles';
import { format, eachDayOfInterval, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calcularMinutosTrabalhados, formatarMinutos, getTipoLabel } from './pontoUtils';

export default function PontoRelatorio() {
  const [funcId, setFuncId] = useState('');
  const [mesAno, setMesAno] = useState(format(new Date(), 'yyyy-MM'));

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['func-relatorio'],
    queryFn: () => base44.entities.Funcionario.filter({ status: 'ativo' }, 'nome'),
  });

  const { data: escalas = [] } = useQuery({
    queryKey: ['escalas-relatorio'],
    queryFn: () => base44.entities.EscalaPonto.list(),
  });

  const dataInicio = `${mesAno}-01`;
  const dataFimObj = endOfMonth(parseISO(`${mesAno}-01`));
  const dataFim = format(dataFimObj, 'yyyy-MM-dd');

  const { data: registros = [] } = useQuery({
    queryKey: ['registros-relatorio', mesAno, funcId],
    queryFn: async () => {
      const filter = {};
      if (funcId) filter.funcionario_id = funcId;
      const all = await base44.entities.RegistroPonto.filter(filter, 'horario');
      return all.filter(r => r.data >= dataInicio && r.data <= dataFim);
    },
    enabled: !!funcId,
  });

  const diasSemana = { 0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab' };

  const relatorio = useMemo(() => {
    if (!funcId || !registros.length) return null;
    
    const inicio = parseISO(`${mesAno}-01`);
    const fim = dataFimObj > new Date() ? new Date() : dataFimObj;
    const dias = eachDayOfInterval({ start: inicio, end: fim });
    
    const escalasFunc = escalas.filter(e => e.funcionario_id === funcId);
    
    let totalTrabalhado = 0;
    let totalPrevisto = 0;
    let atrasos = 0;
    let saidasAntecipadas = 0;
    
    const detalheDias = dias.map(dia => {
      const diaStr = format(dia, 'yyyy-MM-dd');
      const diaSemana = diasSemana[dia.getDay()];
      const escala = escalasFunc.find(e => e.dia_semana === diaSemana);
      const pontosDia = registros.filter(r => r.data === diaStr);
      
      const minTrabalhados = calcularMinutosTrabalhados(pontosDia);
      const cargaPrevista = escala?.carga_horaria_minutos || 0;
      
      totalTrabalhado += minTrabalhados;
      totalPrevisto += cargaPrevista;
      
      // Check atraso
      const entrada = pontosDia.find(p => p.tipo === 'entrada');
      let atraso = false;
      if (entrada && escala?.hora_entrada_prevista) {
        const horaEntrada = format(new Date(entrada.horario), 'HH:mm');
        const diff = timeToMinutes(horaEntrada) - timeToMinutes(escala.hora_entrada_prevista);
        if (diff > 5) atraso = true;
        if (diff > 5) atrasos++;
      }
      
      // Check saída antecipada
      const saida = pontosDia.find(p => p.tipo === 'saida');
      let saidaAntecipada = false;
      if (saida && escala?.hora_saida_prevista) {
        const horaSaida = format(new Date(saida.horario), 'HH:mm');
        const diff = timeToMinutes(escala.hora_saida_prevista) - timeToMinutes(horaSaida);
        if (diff > 5) saidaAntecipada = true;
        if (diff > 5) saidasAntecipadas++;
      }
      
      return { dia, diaStr, diaSemana, escala, pontosDia, minTrabalhados, cargaPrevista, atraso, saidaAntecipada };
    });
    
    const saldo = totalTrabalhado - totalPrevisto;
    const horasExtras = saldo > 15 ? saldo : 0;
    
    return { detalheDias, totalTrabalhado, totalPrevisto, saldo, atrasos, saidasAntecipadas, horasExtras };
  }, [funcId, registros, escalas, mesAno]);

  function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className={pontoSectionTitle}>Relatório de Jornada</h2>
        <p className={pontoSectionText}>Visual corporativo mais limpo para acompanhamento de horas, desvios e detalhe diário, com boa leitura também no celular.</p>
      </div>
      <Card className={pontoSurface}>
        <CardContent className="p-4 sm:p-5">
          <div className={pontoToolbar}>
            <div>
              <label className={pontoInputLabel}>Funcionário</label>
              <Select value={funcId} onValueChange={setFuncId}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{funcionarios.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className={pontoInputLabel}>Competência</label>
              <Input type="month" value={mesAno} onChange={e => setMesAno(e.target.value)} className="w-44" />
            </div>
            <Button variant="outline" size="sm" className="ml-auto h-11 gap-2 rounded-xl px-4" onClick={() => window.print()}>
              <Printer className="w-4 h-4" /> Imprimir
            </Button>
          </div>
        </CardContent>
      </Card>

      {relatorio && (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Card className={pontoStatCardClasses('slate')}><CardContent className="p-4 text-center sm:p-5">
              <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatarMinutos(relatorio.totalTrabalhado)}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Horas Trabalhadas</p>
            </CardContent></Card>
            <Card className={pontoStatCardClasses('slate')}><CardContent className="p-4 text-center sm:p-5">
              <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatarMinutos(relatorio.totalPrevisto)}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Horas Previstas</p>
            </CardContent></Card>
            <Card className={pontoStatCardClasses(relatorio.saldo >= 0 ? 'emerald' : 'red')}><CardContent className="p-4 text-center sm:p-5">
              <p className={`text-2xl font-semibold tabular-nums ${relatorio.saldo >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{formatarMinutos(relatorio.saldo)}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Saldo do Período</p>
            </CardContent></Card>
            <Card className={pontoStatCardClasses('amber')}><CardContent className="p-4 text-center sm:p-5">
              <p className="text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">{relatorio.atrasos}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Atrasos</p>
            </CardContent></Card>
            <Card className={pontoStatCardClasses('blue')}><CardContent className="p-4 text-center sm:p-5">
              <p className="text-2xl font-semibold tabular-nums text-blue-700 dark:text-blue-400">{formatarMinutos(relatorio.horasExtras)}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Horas Extras</p>
            </CardContent></Card>
          </div>

          {/* Detalhe Diário */}
          <Card className={pontoSurface}>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100">Detalhamento Diário</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {relatorio.detalheDias.map(d => (
                  <Collapsible key={d.diaStr}>
                    <CollapsibleTrigger className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900 text-left">
                      <span className="text-xs font-medium w-24">{format(d.dia, 'dd/MM (EEE)', { locale: ptBR })}</span>
                      <div className="flex-1 flex items-center gap-2">
                        {d.atraso && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Atraso</Badge>}
                        {d.saidaAntecipada && <Badge className="bg-blue-100 text-blue-700 text-[10px]">Saída antecipada</Badge>}
                        {d.pontosDia.length === 0 && d.cargaPrevista > 0 && <Badge className="bg-red-100 text-red-700 text-[10px]">Sem registro</Badge>}
                      </div>
                      <span className="text-xs font-medium w-20 text-right">{d.minTrabalhados > 0 ? formatarMinutos(d.minTrabalhados) : '—'}</span>
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-6 py-2 bg-slate-50 dark:bg-slate-950 space-y-1">
                        {d.escala && <p className="text-xs text-muted-foreground">Escala: {d.escala.hora_entrada_prevista} — {d.escala.hora_saida_prevista} ({formatarMinutos(d.cargaPrevista)})</p>}
                        {d.pontosDia.map(p => (
                          <p key={p.id} className="text-xs">
                            <Badge variant="outline" className="text-[10px] mr-2">{getTipoLabel(p.tipo)}</Badge>
                            {format(new Date(p.horario), 'HH:mm:ss')}
                            {p.metodo_autenticacao && p.metodo_autenticacao !== 'facial' && (
                              <span className="text-amber-600 ml-2">({p.metodo_autenticacao})</span>
                            )}
                          </p>
                        ))}
                        {d.pontosDia.length === 0 && <p className="text-xs text-muted-foreground italic">Nenhum registro neste dia</p>}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}