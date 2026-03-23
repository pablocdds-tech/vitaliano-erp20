import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui-custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Plus, ChevronLeft, ChevronRight, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TIPO_DIA_LABELS = {
  trabalho: { label: 'Trabalho', bg: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300' },
  folga: { label: 'Folga', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-600' },
  feriado: { label: 'Feriado', bg: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800' },
  ferias: { label: 'Férias', bg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800' },
  atestado: { label: 'Atestado', bg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800' },
  falta: { label: 'Falta', bg: 'bg-red-100 dark:bg-red-900/30 text-red-800' }
};

const TURNOS = [
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
  { value: 'integral', label: 'Integral' }
];

export default function RHEscalas() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [lojaId, setLojaId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({});
  const qc = useQueryClient();

  const baseDate = addDays(new Date(), weekOffset * 7);
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: lojas = [] } = useQuery({ queryKey: ['lojas'], queryFn: () => base44.entities.Loja.list() });
  const { data: funcionarios = [] } = useQuery({ queryKey: ['funcionarios'], queryFn: () => base44.entities.Funcionario.filter({ status: 'ativo' }) });

  const dateRange = days.map(d => format(d, 'yyyy-MM-dd'));
  const { data: escalas = [] } = useQuery({
    queryKey: ['escalas', lojaId, dateRange[0], dateRange[6]],
    queryFn: async () => {
      const q = {};
      if (lojaId) q.loja_id = lojaId;
      const all = await base44.entities.EscalaTrabalho.filter(q, 'data', 500);
      return all.filter(e => e.data >= dateRange[0] && e.data <= dateRange[6]);
    }
  });

  const funcsFiltrados = lojaId ? funcionarios.filter(f => f.loja_id === lojaId) : funcionarios;

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.EscalaTrabalho.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['escalas'] }); setShowModal(false); toast.success('Escala criada'); }
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.EscalaTrabalho.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['escalas'] }); toast.success('Removido'); }
  });

  const openNewEscala = (funcId, date) => {
    const func = funcionarios.find(f => f.id === funcId);
    setModalData({
      funcionario_id: funcId,
      nome_funcionario: func?.nome || '',
      loja_id: lojaId || func?.loja_id || '',
      data: format(date, 'yyyy-MM-dd'),
      tipo_dia: 'trabalho',
      turno: 'integral',
      hora_inicio: '08:00',
      hora_fim: '18:00',
      tipo_funcionario: func?.tipo === 'freelancer' ? 'freelancer' : 'fixo',
      funcao: func?.cargo || '',
      valor_diaria: '',
      observacao: ''
    });
    setShowModal(true);
  };

  const handleCreate = (e) => {
    e.preventDefault();
    createMut.mutate({ ...modalData, valor_diaria: Number(modalData.valor_diaria) || 0 });
  };

  return (
    <div>
      <PageHeader
        title="Escalas de Trabalho"
        subtitle="Programação de escalas, folgas e freelancers"
        icon={Calendar}
        breadcrumbs={[{ label: 'RH', href: '/RHFuncionarios' }, { label: 'Escalas' }]}
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={lojaId} onValueChange={setLojaId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todas as lojas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as lojas</SelectItem>
            {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w - 1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm font-medium min-w-[200px] text-center">
            {format(weekStart, "dd 'de' MMM", { locale: ptBR })} — {format(weekEnd, "dd 'de' MMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w + 1)}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>Hoje</Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800">
              <th className="p-2 text-left border min-w-[150px]">Funcionário</th>
              {days.map(d => (
                <th key={d.toISOString()} className={`p-2 text-center border min-w-[110px] ${isSameDay(d, new Date()) ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
                  <div className="text-xs">{format(d, 'EEE', { locale: ptBR })}</div>
                  <div className="font-bold">{format(d, 'dd/MM')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {funcsFiltrados.map(func => (
              <tr key={func.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="p-2 border">
                  <div className="font-medium text-xs">{func.nome}</div>
                  <div className="text-xs text-muted-foreground">{func.cargo} {func.tipo === 'freelancer' ? '🏷️' : ''}</div>
                </td>
                {days.map(d => {
                  const dateStr = format(d, 'yyyy-MM-dd');
                  const escala = escalas.find(e => e.funcionario_id === func.id && e.data === dateStr);
                  const cfg = escala ? TIPO_DIA_LABELS[escala.tipo_dia] : null;
                  return (
                    <td key={d.toISOString()} className={`p-1 border text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 ${isSameDay(d, new Date()) ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>
                      {escala ? (
                        <div className={`rounded p-1 text-xs ${cfg?.bg || ''}`}>
                          <div className="font-medium">{cfg?.label}</div>
                          {escala.tipo_dia === 'trabalho' && <div>{escala.hora_inicio}-{escala.hora_fim}</div>}
                          <div className="flex justify-center gap-1 mt-0.5">
                            <button onClick={() => deleteMut.mutate(escala.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => openNewEscala(func.id, d)} className="w-full p-2 text-muted-foreground hover:text-foreground">
                          <Plus className="w-3 h-3 mx-auto" />
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {funcsFiltrados.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum funcionário ativo {lojaId ? 'nesta loja' : ''}</p>
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Escala - {modalData.nome_funcionario}</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div><Label>Data</Label><Input type="date" value={modalData.data || ''} onChange={e => setModalData(p => ({ ...p, data: e.target.value }))} /></div>
            <div>
              <Label>Tipo do Dia</Label>
              <Select value={modalData.tipo_dia} onValueChange={v => setModalData(p => ({ ...p, tipo_dia: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_DIA_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {modalData.tipo_dia === 'trabalho' && (
              <>
                <div>
                  <Label>Turno</Label>
                  <Select value={modalData.turno} onValueChange={v => setModalData(p => ({ ...p, turno: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TURNOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Início</Label><Input type="time" value={modalData.hora_inicio || ''} onChange={e => setModalData(p => ({ ...p, hora_inicio: e.target.value }))} /></div>
                  <div><Label>Fim</Label><Input type="time" value={modalData.hora_fim || ''} onChange={e => setModalData(p => ({ ...p, hora_fim: e.target.value }))} /></div>
                </div>
              </>
            )}
            {modalData.tipo_funcionario === 'freelancer' && (
              <>
                <div><Label>Função</Label><Input value={modalData.funcao || ''} onChange={e => setModalData(p => ({ ...p, funcao: e.target.value }))} /></div>
                <div><Label>Valor Diária (R$)</Label><Input type="number" step="0.01" value={modalData.valor_diaria || ''} onChange={e => setModalData(p => ({ ...p, valor_diaria: e.target.value }))} /></div>
              </>
            )}
            <div><Label>Observação</Label><Textarea value={modalData.observacao || ''} onChange={e => setModalData(p => ({ ...p, observacao: e.target.value }))} rows={2} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}