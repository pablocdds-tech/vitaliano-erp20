import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getTipoLabel, getNovoStatus } from './pontoUtils';

export default function PontoAjustes() {
  const [addOpen, setAddOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [justificativa, setJustificativa] = useState('');
  const [novoRegistro, setNovoRegistro] = useState({ funcionario_id: '', tipo: 'entrada', data: format(new Date(), 'yyyy-MM-dd'), horario: '08:00', observacao: '' });
  const qc = useQueryClient();

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['func-ajustes'],
    queryFn: () => base44.entities.Funcionario.filter({ status: 'ativo' }, 'nome'),
  });

  const { data: registros = [] } = useQuery({
    queryKey: ['registros-ajustes'],
    queryFn: () => base44.entities.RegistroPonto.list('-horario', 50),
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const { funcionario_id, tipo, data, horario, observacao } = novoRegistro;
      if (!funcionario_id || !tipo || !data || !horario) throw new Error('Preencha todos os campos');
      const user = await base44.auth.me();
      
      await base44.entities.RegistroPonto.create({
        funcionario_id,
        tipo,
        data,
        horario: new Date(`${data}T${horario}`).toISOString(),
        metodo_autenticacao: 'manual_gestor',
        observacao,
        editado_por: user.full_name,
        editado_em: new Date().toISOString(),
      });

      // Update FuncionarioPonto status
      const fps = await base44.entities.FuncionarioPonto.filter({ funcionario_id });
      if (fps.length > 0) {
        await base44.entities.FuncionarioPonto.update(fps[0].id, { 
          status_atual: getNovoStatus(tipo), 
          ultima_marcacao: new Date().toISOString() 
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registros-ajustes'] });
      toast.success('Registro adicionado manualmente');
      setAddOpen(false);
      setNovoRegistro({ funcionario_id: '', tipo: 'entrada', data: format(new Date(), 'yyyy-MM-dd'), horario: '08:00', observacao: '' });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id) => {
      if (!justificativa.trim()) throw new Error('Justificativa obrigatória');
      const user = await base44.auth.me();
      // Log the deletion as an edit before deleting
      await base44.entities.RegistroPonto.update(id, {
        observacao: `[EXCLUÍDO por ${user.full_name}] Motivo: ${justificativa}`,
        editado_por: user.full_name,
        editado_em: new Date().toISOString(),
      });
      await base44.entities.RegistroPonto.delete(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registros-ajustes'] });
      toast.success('Registro excluído');
      setDeleteConfirm(null);
      setJustificativa('');
    },
    onError: (err) => toast.error(err.message),
  });

  const getFuncNome = (id) => funcionarios.find(f => f.id === id)?.nome || '—';

  const ajustesManuais = registros.filter(r => r.editado_por || r.metodo_autenticacao === 'manual_gestor');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Ajustes manuais feitos pelo gestor ficam registrados com log completo.</p>
        <Button onClick={() => setAddOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Adicionar Marcação</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Últimos Registros (com prioridade a ajustes manuais)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {registros.slice(0, 30).map(r => (
              <div key={r.id} className={`flex items-center gap-3 px-4 py-3 ${r.editado_por ? 'bg-amber-50/50 dark:bg-amber-950/30' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{getFuncNome(r.funcionario_id)} — <Badge variant="outline" className="text-xs">{getTipoLabel(r.tipo)}</Badge></p>
                  <p className="text-xs text-muted-foreground">{r.data} às {format(new Date(r.horario), 'HH:mm:ss')}</p>
                  {r.editado_por && <p className="text-xs text-amber-600 mt-1">Editado por {r.editado_por} em {r.editado_em ? format(new Date(r.editado_em), 'dd/MM HH:mm') : '—'}</p>}
                  {r.observacao && <p className="text-xs text-muted-foreground italic">{r.observacao}</p>}
                </div>
                <div className="flex gap-1">
                  <Badge variant="secondary" className="text-[10px] capitalize">{r.metodo_autenticacao || 'facial'}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => setDeleteConfirm(r)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal Adicionar */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Marcação Manual</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={novoRegistro.funcionario_id} onValueChange={v => setNovoRegistro(prev => ({ ...prev, funcionario_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione funcionário" /></SelectTrigger>
              <SelectContent>{funcionarios.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={novoRegistro.tipo} onValueChange={v => setNovoRegistro(prev => ({ ...prev, tipo: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida_descanso">Saída Descanso</SelectItem>
                <SelectItem value="volta_descanso">Volta Descanso</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" value={novoRegistro.data} onChange={e => setNovoRegistro(prev => ({ ...prev, data: e.target.value }))} />
              <Input type="time" value={novoRegistro.horario} onChange={e => setNovoRegistro(prev => ({ ...prev, horario: e.target.value }))} />
            </div>
            <Textarea placeholder="Observação / motivo do ajuste" value={novoRegistro.observacao} onChange={e => setNovoRegistro(prev => ({ ...prev, observacao: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={() => addMut.mutate()} disabled={addMut.isPending}>
              {addMut.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Exclusão */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => { setDeleteConfirm(null); setJustificativa(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="w-5 h-5" /> Excluir Registro</DialogTitle></DialogHeader>
          {deleteConfirm && (
            <div className="space-y-4">
              <p className="text-sm">{getFuncNome(deleteConfirm.funcionario_id)} — {getTipoLabel(deleteConfirm.tipo)} em {deleteConfirm.data} às {format(new Date(deleteConfirm.horario), 'HH:mm')}</p>
              <Textarea placeholder="Justificativa obrigatória para exclusão" value={justificativa} onChange={e => setJustificativa(e.target.value)} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteConfirm(null); setJustificativa(''); }}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteMut.mutate(deleteConfirm.id)} disabled={deleteMut.isPending || !justificativa.trim()}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}