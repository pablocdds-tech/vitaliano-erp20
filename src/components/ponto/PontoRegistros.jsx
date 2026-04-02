import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { getTipoLabel } from './pontoUtils';
import { pontoInputLabel, pontoSectionText, pontoSectionTitle, pontoSurface, pontoToolbar } from './pontoStyles';

export default function PontoRegistros() {
  const [filtroFunc, setFiltroFunc] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroMetodo, setFiltroMetodo] = useState('todos');
  const [dataInicio, setDataInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [fotoModal, setFotoModal] = useState(null);

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['func-registros'],
    queryFn: () => base44.entities.Funcionario.filter({ status: 'ativo' }, 'nome'),
  });

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ['registros-ponto', dataInicio, dataFim, filtroFunc],
    queryFn: async () => {
      const filter = {};
      if (filtroFunc) filter.funcionario_id = filtroFunc;
      const all = await base44.entities.RegistroPonto.filter(filter, '-horario');
      return all.filter(r => {
        if (r.data < dataInicio || r.data > dataFim) return false;
        return true;
      });
    },
  });

  const filtered = registros.filter(r => {
    if (filtroTipo !== 'todos' && r.tipo !== filtroTipo) return false;
    if (filtroMetodo !== 'todos' && r.metodo_autenticacao !== filtroMetodo) return false;
    return true;
  });

  const getFuncNome = (id) => funcionarios.find(f => f.id === id)?.nome || '—';

  const getConfiancaBadge = (score) => {
    if (!score && score !== 0) return <Badge variant="outline">—</Badge>;
    if (score > 0.9) return <Badge className="bg-emerald-100 text-emerald-700">{(score * 100).toFixed(0)}%</Badge>;
    if (score > 0.7) return <Badge className="bg-amber-100 text-amber-700">{(score * 100).toFixed(0)}%</Badge>;
    return <Badge className="bg-red-100 text-red-700">{(score * 100).toFixed(0)}%</Badge>;
  };

  const exportCSV = () => {
    const headers = ['Funcionário', 'Data', 'Tipo', 'Horário', 'Confiança', 'Método'];
    const rows = filtered.map(r => [
      getFuncNome(r.funcionario_id),
      r.data,
      getTipoLabel(r.tipo),
      format(new Date(r.horario), 'HH:mm:ss'),
      r.confianca_reconhecimento ? `${(r.confianca_reconhecimento * 100).toFixed(0)}%` : '—',
      r.metodo_autenticacao || '—'
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registros_ponto_${dataInicio}_${dataFim}.csv`;
    a.click();
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className={pontoSectionTitle}>Registros do Ponto</h2>
        <p className={pontoSectionText}>Consulte, filtre e exporte as marcações com leitura mais limpa em telas grandes e controles confortáveis no celular.</p>
      </div>
      <Card className={pontoSurface}>
        <CardContent className="p-4 sm:p-5">
          <div className={pontoToolbar}>
            <div>
              <label className={pontoInputLabel}>Funcionário</label>
              <Select value={filtroFunc} onValueChange={setFiltroFunc}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos</SelectItem>
                  {funcionarios.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={pontoInputLabel}>Data Inicial</label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-40" />
            </div>
            <div>
              <label className={pontoInputLabel}>Data Final</label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-40" />
            </div>
            <div>
              <label className={pontoInputLabel}>Tipo</label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida_descanso">Saída Descanso</SelectItem>
                  <SelectItem value="volta_descanso">Volta Descanso</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={pontoInputLabel}>Método</label>
              <Select value={filtroMetodo} onValueChange={setFiltroMetodo}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="facial">Facial</SelectItem>
                  <SelectItem value="pin_backup">PIN</SelectItem>
                  <SelectItem value="manual_gestor">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={exportCSV} className="ml-auto h-11 gap-2 rounded-xl px-4">
              <Download className="w-4 h-4" /> Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className={pontoSurface}>
        <CardContent className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Foto</TableHead>
                <TableHead>Confiança</TableHead>
                <TableHead>Método</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
              ) : (
                filtered.slice(0, 100).map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{getFuncNome(r.funcionario_id)}</TableCell>
                    <TableCell><Badge variant="outline">{getTipoLabel(r.tipo)}</Badge></TableCell>
                    <TableCell>
                      <span className="text-xs">{r.data}</span>
                      <span className="text-sm font-medium ml-2">{format(new Date(r.horario), 'HH:mm:ss')}</span>
                    </TableCell>
                    <TableCell>
                      {r.foto_url ? (
                        <button onClick={() => setFotoModal(r.foto_url)} className="w-10 h-10 rounded-lg overflow-hidden border hover:opacity-80">
                          <img src={r.foto_url} className="w-full h-full object-cover" />
                        </button>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>{getConfiancaBadge(r.confianca_reconhecimento)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs capitalize">{r.metodo_autenticacao || '—'}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!fotoModal} onOpenChange={() => setFotoModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Foto da Marcação</DialogTitle></DialogHeader>
          {fotoModal && <img src={fotoModal} className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}