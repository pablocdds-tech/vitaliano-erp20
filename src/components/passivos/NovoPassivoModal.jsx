import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const TIPOS = [
  { value: 'cartao', label: 'Cartão' },
  { value: 'emprestimo', label: 'Empréstimo' },
  { value: 'financiamento', label: 'Financiamento' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'cheque_especial', label: 'Cheque Especial' },
  { value: 'acordo', label: 'Acordo' },
];

export default function NovoPassivoModal({ open, onClose, onSuccess, lojas }) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('novo'); // 'novo' ou 'em_andamento'
  const [form, setForm] = useState({
    title: '',
    type: '',
    creditor_name: '',
    responsible: '',
    loja_id: '',
    original_amount: '',
    amount_paid: '',
    interest_rate_monthly: '',
    total_installments: '',
    installment_value: '',
    has_variable_installments: false,
    start_date: '',
    first_due_date: '',
    notes: ''
  });
  const [installmentsInput, setInstallmentsInput] = useState(''); // JSON para parcelas variáveis

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title || !form.type || !form.original_amount || !form.total_installments || !form.first_due_date) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    
    if (!form.has_variable_installments && !form.installment_value) {
      toast.error('Indique valor da parcela ou marque como parcelas variáveis');
      return;
    }
    setLoading(true);
    try {
      let customInstallments = null;
      if (form.has_variable_installments && installmentsInput) {
        try {
          customInstallments = JSON.parse(installmentsInput);
          if (!Array.isArray(customInstallments) || customInstallments.length !== parseInt(form.total_installments)) {
            toast.error('JSON de parcelas inválido. Deve ser array com ' + form.total_installments + ' elementos');
            setLoading(false);
            return;
          }
        } catch {
          toast.error('JSON de parcelas inválido');
          setLoading(false);
          return;
        }
      }

      const resp = await base44.functions.invoke('criarPassivo', {
        liability: {
          ...form,
          original_amount: parseFloat(form.original_amount),
          amount_paid: form.amount_paid ? parseFloat(form.amount_paid) : 0,
          interest_rate_monthly: form.interest_rate_monthly ? parseFloat(form.interest_rate_monthly) : undefined,
          total_installments: parseInt(form.total_installments),
          installment_value: form.has_variable_installments ? undefined : parseFloat(form.installment_value),
          has_variable_installments: form.has_variable_installments
        },
        customInstallments
      });

      if (resp.data?.success) {
        toast.success(`Passivo criado! ${resp.data.installments_created} parcelas geradas.`);
        onSuccess();
        onClose();
        setMode('novo');
        setForm({ title: '', type: '', creditor_name: '', responsible: '', loja_id: '', original_amount: '', amount_paid: '', interest_rate_monthly: '', total_installments: '', installment_value: '', has_variable_installments: false, start_date: '', first_due_date: '', notes: '' });
        setInstallmentsInput('');
      } else {
        toast.error('Erro: ' + (resp.data?.error || 'Falha ao criar'));
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Passivo Financeiro</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-4 border-b">
          <button onClick={() => setMode('novo')} className={`px-4 py-2 font-medium border-b-2 ${mode === 'novo' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}>
            Do Zero
          </button>
          <button onClick={() => setMode('em_andamento')} className={`px-4 py-2 font-medium border-b-2 ${mode === 'em_andamento' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}>
            Já em Pagamento
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1">
            <Label>Nome da Dívida *</Label>
            <Input placeholder="Ex: PRONAMPE Banco X" value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Tipo *</Label>
            <Select value={form.type} onValueChange={v => set('type', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Credor</Label>
            <Input placeholder="Nome do banco/credor" value={form.creditor_name} onChange={e => set('creditor_name', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Responsável</Label>
            <Select value={form.responsible} onValueChange={v => set('responsible', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NB">NB</SelectItem>
                <SelectItem value="Praca">Praça</SelectItem>
                <SelectItem value="Pablo PF">Pablo PF</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Loja Vinculada</Label>
            <Select value={form.loja_id} onValueChange={v => set('loja_id', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {lojas?.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Valor Original (R$) *</Label>
            <Input type="number" placeholder="0,00" value={form.original_amount} onChange={e => set('original_amount', e.target.value)} />
          </div>
          {mode === 'em_andamento' && (
            <div className="space-y-1">
              <Label>Valor Já Pago (R$)</Label>
              <Input type="number" placeholder="0,00" value={form.amount_paid} onChange={e => set('amount_paid', e.target.value)} />
            </div>
          )}
          <div className="space-y-1">
            <Label>Taxa de Juros Mensal (%)</Label>
            <Input type="number" placeholder="1,5" value={form.interest_rate_monthly} onChange={e => set('interest_rate_monthly', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Total de Parcelas *</Label>
            <Input type="number" placeholder="42" value={form.total_installments} onChange={e => set('total_installments', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>
              <input type="checkbox" checked={form.has_variable_installments} onChange={e => set('has_variable_installments', e.target.checked)} className="mr-2" />
              Parcelas com valores variáveis?
            </Label>
          </div>
          {!form.has_variable_installments && (
            <div className="space-y-1">
              <Label>Valor da Parcela (R$) *</Label>
              <Input type="number" placeholder="0,00" value={form.installment_value} onChange={e => set('installment_value', e.target.value)} />
            </div>
          )}
          <div className="space-y-1">
            <Label>Data de Início</Label>
            <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Primeiro Vencimento *</Label>
            <Input type="date" value={form.first_due_date} onChange={e => set('first_due_date', e.target.value)} />
          </div>
          {form.has_variable_installments && (
            <div className="md:col-span-2 space-y-1">
              <Label>Valores das Parcelas (JSON) *</Label>
              <p className="text-xs text-slate-500 mb-1">Array com {form.total_installments || '?'} valores: [1000, 1050, 1000, ...]</p>
              <Textarea 
                rows={3} 
                placeholder='[1000, 1050, 1000, 1000, 1000]'
                value={installmentsInput} 
                onChange={e => setInstallmentsInput(e.target.value)} 
                className="font-mono text-sm"
              />
            </div>
          )}
          <div className="md:col-span-2 space-y-1">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {mode === 'em_andamento' ? 'Criar (Em Pagamento)' : 'Criar Passivo'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}