import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileDown, Loader2, Moon, Clock, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import RelatorioPontoTabela from './RelatorioPontoTabela';

function calcularHorasDia(registrosDia) {
  const entrada = registrosDia.find(r => r.tipo === 'entrada');
  const saidaAlmoco = registrosDia.find(r => r.tipo === 'saida_almoco');
  const voltaAlmoco = registrosDia.find(r => r.tipo === 'volta_almoco');
  const saida = registrosDia.find(r => r.tipo === 'saida');

  let totalMinutos = 0;
  let noturnos = 0;

  const periodos = [];
  if (entrada && saidaAlmoco) periodos.push({ ini: new Date(entrada.horario), fim: new Date(saidaAlmoco.horario) });
  if (voltaAlmoco && saida) periodos.push({ ini: new Date(voltaAlmoco.horario), fim: new Date(saida.horario) });
  if (entrada && saida && !saidaAlmoco && !voltaAlmoco) periodos.push({ ini: new Date(entrada.horario), fim: new Date(saida.horario) });

  for (const p of periodos) {
    totalMinutos += differenceInMinutes(p.fim, p.ini);
    noturnos += calcularMinutosNoturnos(p.ini, p.fim);
  }

  return { totalMinutos, noturnos };
}

function calcularMinutosNoturnos(inicio, fim) {
  let minutos = 0;
  const current = new Date(inicio);
  while (current < fim) {
    const h = current.getHours();
    if (h >= 22 || h < 5) {
      minutos++;
    }
    current.setMinutes(current.getMinutes() + 1);
  }
  return minutos;
}

function formatMinutos(min) {
  if (!min || min <= 0) return '00:00';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function RelatorioPonto() {
  const [funcId, setFuncId] = useState('');
  const [mesAno, setMesAno] = useState(format(new Date(), 'yyyy-MM'));
  const [exportando, setExportando] = useState(false);

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['funcionarios-rel'],
    queryFn: () => base44.entities.Funcionario.list()
  });

  const mesInicio = `${mesAno}-01`;
  const mesFim = format(endOfMonth(parseISO(mesInicio)), 'yyyy-MM-dd');

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ['pontos-relatorio', funcId, mesAno],
    queryFn: async () => {
      if (!funcId) return [];
      const todos = await base44.entities.RegistroPonto.filter({ funcionario_id: funcId }, '-data', 1000);
      return todos.filter(r => r.data >= mesInicio && r.data <= mesFim);
    },
    enabled: !!funcId
  });

  const dias = useMemo(() => {
    if (!funcId || !mesAno) return [];
    const start = parseISO(mesInicio);
    const end = endOfMonth(start);
    const todosDias = eachDayOfInterval({ start, end });

    return todosDias.map(dia => {
      const diaStr = format(dia, 'yyyy-MM-dd');
      const regs = registros.filter(r => r.data === diaStr);
      const entrada = regs.find(r => r.tipo === 'entrada');
      const saidaAlmoco = regs.find(r => r.tipo === 'saida_almoco');
      const voltaAlmoco = regs.find(r => r.tipo === 'volta_almoco');
      const saida = regs.find(r => r.tipo === 'saida');
      const { totalMinutos, noturnos } = calcularHorasDia(regs);

      return {
        data: diaStr,
        diaSemana: format(dia, 'EEE', { locale: ptBR }),
        entrada: entrada ? format(new Date(entrada.horario), 'HH:mm') : '-',
        saidaAlmoco: saidaAlmoco ? format(new Date(saidaAlmoco.horario), 'HH:mm') : '-',
        voltaAlmoco: voltaAlmoco ? format(new Date(voltaAlmoco.horario), 'HH:mm') : '-',
        saida: saida ? format(new Date(saida.horario), 'HH:mm') : '-',
        totalMinutos,
        noturnos,
        totalFormatado: formatMinutos(totalMinutos),
        noturnoFormatado: formatMinutos(noturnos),
        temRegistro: regs.length > 0
      };
    });
  }, [registros, funcId, mesAno, mesInicio]);

  const totais = useMemo(() => {
    const totalMin = dias.reduce((s, d) => s + d.totalMinutos, 0);
    const totalNoturno = dias.reduce((s, d) => s + d.noturnos, 0);
    const diasTrabalhados = dias.filter(d => d.temRegistro).length;
    return {
      totalHoras: formatMinutos(totalMin),
      totalNoturno: formatMinutos(totalNoturno),
      diasTrabalhados
    };
  }, [dias]);

  const funcNome = funcionarios.find(f => f.id === funcId)?.nome || '';
  const mesLabel = mesAno ? format(parseISO(mesInicio), 'MMMM yyyy', { locale: ptBR }) : '';

  const exportarPDF = async () => {
    if (!funcId) { toast.error('Selecione um funcionário'); return; }
    setExportando(true);
    try {
      const response = await base44.functions.invoke('exportarRelatorioPonto', {
        funcionario_id: funcId,
        funcionario_nome: funcNome,
        mes_ano: mesAno,
        dias,
        totais
      });
      // response.data é o arraybuffer do PDF
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_ponto_${funcNome.replace(/\s/g, '_')}_${mesAno}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Relatório exportado!');
    } catch (e) {
      toast.error('Erro ao exportar: ' + e.message);
    }
    setExportando(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Relatório Mensal de Ponto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-64">
              <Label>Funcionário</Label>
              <Select value={funcId} onValueChange={setFuncId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {funcionarios.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nome} - {f.cargo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mês/Ano</Label>
              <Input type="month" value={mesAno} onChange={e => setMesAno(e.target.value)} className="w-44" />
            </div>
            <Button onClick={exportarPDF} disabled={!funcId || exportando} variant="outline" className="gap-2">
              {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Exportar PDF
            </Button>
          </div>

          {funcId && (
            <div className="flex flex-wrap gap-3">
              <Badge variant="outline" className="gap-1 text-sm px-3 py-1.5">
                <Clock className="w-3.5 h-3.5" />
                Total: <strong>{totais.totalHoras}</strong>
              </Badge>
              <Badge variant="outline" className="gap-1 text-sm px-3 py-1.5 border-purple-300 text-purple-700">
                <Moon className="w-3.5 h-3.5" />
                Adic. Noturno: <strong>{totais.totalNoturno}</strong>
              </Badge>
              <Badge variant="outline" className="gap-1 text-sm px-3 py-1.5">
                Dias Trabalhados: <strong>{totais.diasTrabalhados}</strong>
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {funcId && !isLoading && (
        <RelatorioPontoTabela dias={dias} funcNome={funcNome} mesLabel={mesLabel} />
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}