import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

const tipoOptions = [
  { value: 'cartao', label: 'Cartão' },
  { value: 'emprestimo', label: 'Empréstimo' },
  { value: 'financiamento', label: 'Financiamento' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'cheque_especial', label: 'Cheque Especial' },
  { value: 'acordo', label: 'Acordo' },
];

const responsavelOptions = [
  { value: 'NB', label: 'NB' },
  { value: 'Praca', label: 'Praça' },
  { value: 'Pablo_PF', label: 'Pablo PF' },
];

export default function PassivoForm({ open, onClose, onSubmit, loading }) {
  const [form, setForm] = useState({
    titulo: '', tipo: 'emprestimo', credor_nome: '', responsavel: 'NB',
    valor_original: '', taxa_juros_mensal: '', total_parcelas: '',
    valor_parcela: '', data_inicio: '', primeiro_vencimento: '', observacoes: ''
  });

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      valor_original: Number(form.valor_original),
      taxa_juros_mensal: form.taxa_juros_mensal ? Number(form.taxa_juros_mensal) : undefined,
      total_parcelas: Number(form.total_parcelas),
      valor_parcela: Number(form.valor_parcela),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Passivo Financeiro</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="md:col-span-2">
            <Label>Título da Dívida *</Label>
            <Input placeholder="Ex: PRONAMPE Banco X" value={form.titulo} onChange={e => handleChange('titulo', e.target.value)} required />
          </div>
          <div>
            <Label>Tipo *</Label>
            <Select value={form.tipo} onValueChange={v => handleChange('tipo', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{tipoOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsável *</Label>
            <Select value={form.responsavel} onValueChange={v => handleChange('responsavel', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{responsavelOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Credor *</Label>
            <Input placeholder="Nome do credor" value={form.credor_nome} onChange={e => handleChange('credor_nome', e.target.value)} required />
          </div>
          <div>
            <Label>Valor Original (R$) *</Label>
            <Input type="number" step="0.01" min="0" value={form.valor_original} onChange={e => handleChange('valor_original', e.target.value)} required />
          </div>
          <div>
            <Label>Taxa Juros Mensal (%)</Label>
            <Input type="number" step="0.01" min="0" value={form.taxa_juros_mensal} onChange={e => handleChange('taxa_juros_mensal', e.target.value)} />
          </div>
          <div>
            <Label>Total de Parcelas *</Label>
            <Input type="number" min="1" value={form.total_parcelas} onChange={e => handleChange('total_parcelas', e.target.value)} required />
          </div>
          <div>
            <Label>Valor da Parcela (R$) *</Label>
            <Input type="number" step="0.01" min="0" value={form.valor_parcela} onChange={e => handleChange('valor_parcela', e.target.value)} required />
          </div>
          <div>
            <Label>Data Início</Label>
            <Input type="date" value={form.data_inicio} onChange={e => handleChange('data_inicio', e.target.value)} />
          </div>
          <div>
            <Label>Primeiro Vencimento *</Label>
            <Input type="date" value={form.primeiro_vencimento} onChange={e => handleChange('primeiro_vencimento', e.target.value)} required />
          </div>
          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => handleChange('observacoes', e.target.value)} />
          </div>
          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Passivo e Gerar Parcelas
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}