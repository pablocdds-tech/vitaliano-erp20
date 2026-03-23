import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import ReactQuill from 'react-quill';

const TIPOS = [
  { value: 'admissao', label: 'Admissão' },
  { value: 'experiencia', label: 'Experiência' },
  { value: 'aditivo', label: 'Aditivo' },
  { value: 'rescisao', label: 'Rescisão' },
  { value: 'confidencialidade', label: 'Confidencialidade' },
  { value: 'outro', label: 'Outro' }
];

export default function ContratoModal({ open, onClose, contrato, funcionarios = [] }) {
  const isEdit = !!contrato;
  const [form, setForm] = useState({
    titulo: contrato?.titulo || '',
    tipo: contrato?.tipo || 'admissao',
    funcionario_id: contrato?.funcionario_id || '',
    conteudo_html: contrato?.conteudo_html || '',
    data_inicio: contrato?.data_inicio || '',
    data_fim: contrato?.data_fim || '',
    observacoes: contrato?.observacoes || ''
  });

  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data) => isEdit ? base44.entities.ContratoRH.update(contrato.id, data) : base44.entities.ContratoRH.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contratos'] }); toast.success(isEdit ? 'Contrato atualizado' : 'Contrato criado'); onClose(); }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate({ ...form, status: contrato?.status || 'rascunho' });
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const funcAtivos = funcionarios.filter(f => f.status !== 'desligado');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar' : 'Novo'} Contrato</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Título *</Label><Input value={form.titulo} onChange={e => set('titulo', e.target.value)} required /></div>
            <div>
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={v => set('tipo', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Funcionário *</Label>
              <Select value={form.funcionario_id} onValueChange={v => set('funcionario_id', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{funcAtivos.map(f => <SelectItem key={f.id} value={f.id}>{f.nome} - {f.cargo}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Início</Label><Input type="date" value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)} /></div>
              <div><Label>Fim</Label><Input type="date" value={form.data_fim} onChange={e => set('data_fim', e.target.value)} /></div>
            </div>
          </div>

          <div>
            <Label>Conteúdo do Contrato</Label>
            <div className="mt-1">
              <ReactQuill theme="snow" value={form.conteudo_html} onChange={v => set('conteudo_html', v)} style={{ minHeight: 200 }} />
            </div>
          </div>

          <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}