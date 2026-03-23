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

const TIPOS = [
  { value: 'clt', label: 'CLT' },
  { value: 'pj', label: 'PJ' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'estagiario', label: 'Estagiário' },
  { value: 'temporario', label: 'Temporário' }
];

const STATUS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'ferias', label: 'Férias' },
  { value: 'afastado', label: 'Afastado' },
  { value: 'desligado', label: 'Desligado' }
];

export default function FuncionarioModal({ open, onClose, funcionario, lojas = [] }) {
  const isEdit = !!funcionario;
  const [form, setForm] = useState({
    nome: funcionario?.nome || '',
    cpf: funcionario?.cpf || '',
    rg: funcionario?.rg || '',
    data_nascimento: funcionario?.data_nascimento || '',
    telefone: funcionario?.telefone || '',
    email: funcionario?.email || '',
    cargo: funcionario?.cargo || '',
    departamento: funcionario?.departamento || '',
    tipo: funcionario?.tipo || 'clt',
    loja_id: funcionario?.loja_id || '',
    data_admissao: funcionario?.data_admissao || '',
    salario: funcionario?.salario || '',
    pix: funcionario?.pix || '',
    banco: funcionario?.banco || '',
    agencia: funcionario?.agencia || '',
    conta: funcionario?.conta || '',
    observacoes: funcionario?.observacoes || '',
    status: funcionario?.status || 'ativo'
  });

  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data) => isEdit ? base44.entities.Funcionario.update(funcionario.id, data) : base44.entities.Funcionario.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['funcionarios'] }); toast.success(isEdit ? 'Atualizado' : 'Cadastrado'); onClose(); }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate({ ...form, salario: Number(form.salario) || 0 });
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar' : 'Novo'} Funcionário</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => set('nome', e.target.value)} required /></div>
            <div><Label>CPF</Label><Input value={form.cpf} onChange={e => set('cpf', e.target.value)} /></div>
            <div><Label>RG</Label><Input value={form.rg} onChange={e => set('rg', e.target.value)} /></div>
            <div><Label>Data Nascimento</Label><Input type="date" value={form.data_nascimento} onChange={e => set('data_nascimento', e.target.value)} /></div>
            <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => set('telefone', e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
            <div><Label>Cargo *</Label><Input value={form.cargo} onChange={e => set('cargo', e.target.value)} required /></div>
            <div><Label>Departamento</Label><Input value={form.departamento} onChange={e => set('departamento', e.target.value)} /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => set('tipo', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Loja</Label>
              <Select value={form.loja_id} onValueChange={v => set('loja_id', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Data Admissão</Label><Input type="date" value={form.data_admissao} onChange={e => set('data_admissao', e.target.value)} /></div>
            <div><Label>Salário</Label><Input type="number" step="0.01" value={form.salario} onChange={e => set('salario', e.target.value)} /></div>
            <div><Label>PIX</Label><Input value={form.pix} onChange={e => set('pix', e.target.value)} /></div>
            <div><Label>Banco</Label><Input value={form.banco} onChange={e => set('banco', e.target.value)} /></div>
            <div><Label>Agência</Label><Input value={form.agencia} onChange={e => set('agencia', e.target.value)} /></div>
            <div><Label>Conta</Label><Input value={form.conta} onChange={e => set('conta', e.target.value)} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} /></div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}