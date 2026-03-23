import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, MapPin, Clock } from 'lucide-react';
import { format } from 'date-fns';

const tipoLabels = { entrada: '🟢 Entrada', saida_almoco: '🟡 Saída Intervalo', volta_almoco: '🔵 Volta Intervalo', saida: '🔴 Saída' };

export default function PontoHistorico() {
  const [funcId, setFuncId] = useState('');
  const [dataFiltro, setDataFiltro] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [detalhe, setDetalhe] = useState(null);

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['funcionarios'],
    queryFn: () => base44.entities.Funcionario.list()
  });

  const query = {};
  if (funcId) query.funcionario_id = funcId;
  if (dataFiltro) query.data = dataFiltro;

  const { data: registros = [] } = useQuery({
    queryKey: ['pontos-hist', funcId, dataFiltro],
    queryFn: () => base44.entities.RegistroPonto.filter(query, '-horario', 100),
    enabled: !!(funcId || dataFiltro)
  });

  const funcMap = Object.fromEntries(funcionarios.map(f => [f.id, f.nome]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="w-64">
          <Label>Funcionário</Label>
          <Select value={funcId} onValueChange={setFuncId}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {funcionarios.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Data</Label><Input type="date" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} /></div>
      </div>

      {registros.length === 0 && <p className="text-muted-foreground text-sm p-4">Nenhum registro encontrado</p>}

      <div className="grid gap-2">
        {registros.map(r => (
          <div key={r.id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setDetalhe(r)}>
            {r.foto_url && <img src={r.foto_url} className="w-12 h-12 rounded object-cover" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{funcMap[r.funcionario_id] || 'Desconhecido'}</p>
              <p className="text-xs text-muted-foreground">{tipoLabels[r.tipo]} • {r.horario ? format(new Date(r.horario), 'HH:mm:ss') : '-'}</p>
            </div>
            <div className="text-xs text-muted-foreground text-right">
              {r.latitude && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" />{Number(r.latitude).toFixed(4)}, {Number(r.longitude).toFixed(4)}</div>}
            </div>
            <Eye className="w-4 h-4 text-muted-foreground" />
          </div>
        ))}
      </div>

      {detalhe && (
        <Dialog open={!!detalhe} onOpenChange={() => setDetalhe(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Detalhes do Registro</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {detalhe.foto_url && <img src={detalhe.foto_url} className="w-full rounded-lg" />}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><strong>Funcionário:</strong> {funcMap[detalhe.funcionario_id]}</div>
                <div><strong>Tipo:</strong> {tipoLabels[detalhe.tipo]}</div>
                <div><strong>Horário:</strong> {detalhe.horario ? format(new Date(detalhe.horario), 'dd/MM/yyyy HH:mm:ss') : '-'}</div>
                <div><strong>Data:</strong> {detalhe.data}</div>
                <div><strong>Latitude:</strong> {detalhe.latitude || '-'}</div>
                <div><strong>Longitude:</strong> {detalhe.longitude || '-'}</div>
                <div className="col-span-2"><strong>Dispositivo:</strong> <span className="text-xs break-all">{detalhe.dispositivo || '-'}</span></div>
                <div className="col-span-2"><strong>Validado:</strong> {detalhe.validado ? '✅ Sim' : '❌ Não'}</div>
              </div>
              {detalhe.latitude && detalhe.longitude && (
                <a href={`https://www.google.com/maps?q=${detalhe.latitude},${detalhe.longitude}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Ver no Google Maps
                </a>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}