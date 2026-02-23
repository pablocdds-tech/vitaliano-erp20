import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Layers } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { toast } from 'sonner';
import { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getEmpresaAtiva } from '@/components/services/tenantService';

const FORMAS = ['boleto', 'pix', 'transferencia', 'dinheiro', 'cartao', 'cheque'];
const TIPO_CREDOR = ['fornecedor', 'banco', 'servico', 'aluguel', 'outro'];

function gerarParcelas(valor, numParcelas, primeiroVencimento) {
  const parcelas = [];
  const vlr = parseFloat((valor / numParcelas).toFixed(2));
  let diff = valor - vlr * numParcelas;
  for (let i = 0; i < numParcelas; i++) {
    const venc = addMonths(new Date(primeiroVencimento + 'T12:00:00'), i);
    parcelas.push({
      numero: i + 1,
      vencimento: format(venc, 'yyyy-MM-dd'),
      valor: i === numParcelas - 1 ? parseFloat((vlr + diff).toFixed(2)) : vlr,
    });
  }
  return parcelas;
}

const emptyForm = {
  descricao: '', credor_nome: '', credor_tipo: 'fornecedor', fornecedor_id: '',
  loja_id: '', categoria_dre_id: '', documento_numero: '',
  data_emissao: format(new Date(), 'yyyy-MM-dd'), data_vencimento: '',
  valor_original: '', forma_pagamento: 'boleto', observacoes: '',
  parcelar: false, num_parcelas: 2, primeiro_vencimento: '',
};

export default function ContaPagarFormModal({ open, onClose, editingItem, lojas, fornecedores, categoriasDRE }) {
  const queryClient = useQueryClient();

  const getInitialForm = () => {
    if (!editingItem) return { ...emptyForm };
    return {
      ...emptyForm,
      descricao: editingItem.descricao || '',
      credor_nome: editingItem.credor_nome || '',
      credor_tipo: editingItem.credor_tipo || 'fornecedor',
      fornecedor_id: editingItem.fornecedor_id || '',
      loja_id: editingItem.loja_id || '',
      categoria_dre_id: editingItem.categoria_dre_id || '',
      documento_numero: editingItem.documento_numero || '',
      data_emissao: editingItem.data_emissao || '',
      data_vencimento: editingItem.data_vencimento || '',
      valor_original: editingItem.valor_original || '',
      forma_pagamento: editingItem.forma_pagamento || 'boleto',
      observacoes: editingItem.observacoes || '',
    };
  };

  const [formData, setFormData] = useState(getInitialForm);

  React.useEffect(() => {
    if (open) setFormData(getInitialForm());
  }, [open, editingItem?.id]);

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
  const catsDespesa = (categoriasDRE || []).filter(c => ['custo', 'despesa_fixa', 'despesa_variavel'].includes(c.tipo));

  const createMutation = useMutation({
    mutationFn: async (form) => {
      const empresa = await getEmpresaAtiva();
      const base = {
        empresa_id: empresa.id, loja_id: form.loja_id,
        fornecedor_id: form.fornecedor_id || null, categoria_dre_id: form.categoria_dre_id || null,
        descricao: form.descricao, credor_nome: form.credor_nome || null,
        credor_tipo: form.credor_tipo || null, documento_numero: form.documento_numero || null,
        data_emissao: form.data_emissao || null, forma_pagamento: form.forma_pagamento,
        observacoes: form.observacoes || null, status: 'pendente',
      };
      if (form.parcelar && form.num_parcelas > 1) {
        const parcelas = gerarParcelas(parseFloat(form.valor_original), form.num_parcelas, form.primeiro_vencimento);
        for (const p of parcelas) {
          await base44.entities.ContaPagar.create({
            ...base, data_vencimento: p.vencimento, valor_original: p.valor,
            parcela_atual: p.numero, total_parcelas: form.num_parcelas,
          });
        }
      } else {
        await base44.entities.ContaPagar.create({
          ...base, data_vencimento: form.data_vencimento,
          valor_original: parseFloat(form.valor_original), parcela_atual: 1, total_parcelas: 1,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      toast.success('Conta(s) cadastrada(s)!');
      onClose();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ContaPagar.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      toast.success('Conta atualizada!');
      onClose();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const handleSubmit = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    
    const desc = (formData.descricao || '').trim();
    const loja = (formData.loja_id || '').trim();
    const valor = parseFloat(formData.valor_original) || 0;
    
    if (!desc) { toast.error('Informe a descrição'); return; }
    if (!loja || loja === '__none__') { toast.error('Selecione a loja/CD'); return; }
    if (valor <= 0) { toast.error('Informe o valor'); return; }
    if (!editingItem && formData.parcelar && !formData.primeiro_vencimento) { toast.error('Informe o primeiro vencimento'); return; }
    if (!editingItem && !formData.parcelar && !formData.data_vencimento) { toast.error('Informe o vencimento'); return; }
    if (editingItem && !formData.data_vencimento) { toast.error('Informe o vencimento'); return; }

    if (editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        data: {
          descricao: desc, credor_nome: formData.credor_nome,
          credor_tipo: formData.credor_tipo, fornecedor_id: formData.fornecedor_id || null,
          loja_id: loja, categoria_dre_id: formData.categoria_dre_id || null,
          data_vencimento: formData.data_vencimento, valor_original: valor,
          forma_pagamento: formData.forma_pagamento, observacoes: formData.observacoes,
        }
      });
    } else {
      createMutation.mutate({ ...formData, descricao: desc, loja_id: loja, valor_original: valor });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Editar Conta' : 'Nova Conta a Pagar'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Descrição */}
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição *</Label>
            <Input value={formData.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Ex: Aluguel, Boleto fornecedor..." />
          </div>

          {/* Credor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo Credor</Label>
              <Select value={formData.credor_tipo} onValueChange={v => set('credor_tipo', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_CREDOR.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do Credor</Label>
              <Input value={formData.credor_nome} onChange={e => set('credor_nome', e.target.value)} placeholder="Banco, Fornecedor..." />
            </div>
          </div>

          {formData.credor_tipo === 'fornecedor' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Fornecedor cadastrado (opcional)</Label>
              <Select value={formData.fornecedor_id || '__none__'} onValueChange={v => set('fornecedor_id', v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhum —</SelectItem>
                  {(fornecedores || []).map(f => <SelectItem key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Loja + Categoria */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Loja / CD *</Label>
              <Select value={formData.loja_id || '__none__'} onValueChange={v => set('loja_id', v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione...</SelectItem>
                  {(lojas || []).map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria DRE</Label>
              <Select value={formData.categoria_dre_id || '__none__'} onValueChange={v => set('categoria_dre_id', v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhuma —</SelectItem>
                  {catsDespesa.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Emissão + Documento */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Data Emissão</Label>
              <Input type="date" value={formData.data_emissao} onChange={e => set('data_emissao', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nº Documento</Label>
              <Input value={formData.documento_numero} onChange={e => set('documento_numero', e.target.value)} placeholder="NF-001..." />
            </div>
          </div>

          {/* Valor + Forma */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Valor (R$) *</Label>
              <Input type="number" value={formData.valor_original} onChange={e => set('valor_original', e.target.value)} min="0.01" step="0.01" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Forma Pagamento</Label>
              <Select value={formData.forma_pagamento} onValueChange={v => set('forma_pagamento', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAS.map(f => <SelectItem key={f} value={f} className="capitalize">{f.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Parcelamento / Vencimento */}
          {!editingItem && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3 bg-slate-50 dark:bg-slate-800/50">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={formData.parcelar} onChange={e => set('parcelar', e.target.checked)} className="w-4 h-4 rounded" />
                <Layers className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-medium">Parcelar</span>
              </label>
              {formData.parcelar ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nº Parcelas</Label>
                    <Input type="number" min="2" max="48" value={formData.num_parcelas} onChange={e => set('num_parcelas', parseInt(e.target.value) || 2)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">1º Vencimento *</Label>
                    <Input type="date" value={formData.primeiro_vencimento} onChange={e => set('primeiro_vencimento', e.target.value)} />
                  </div>
                  {formData.valor_original && formData.num_parcelas >= 2 && (
                    <p className="col-span-2 text-xs text-slate-500 bg-white dark:bg-slate-900 rounded p-2 border">
                      <strong>{formData.num_parcelas}x</strong> de ~<strong>{formatMoney(parseFloat(formData.valor_original) / formData.num_parcelas)}</strong>
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">Data de Vencimento *</Label>
                  <Input type="date" value={formData.data_vencimento} onChange={e => set('data_vencimento', e.target.value)} />
                </div>
              )}
            </div>
          )}

          {editingItem && (
            <div className="space-y-1.5">
              <Label className="text-xs">Data de Vencimento *</Label>
              <Input type="date" value={formData.data_vencimento} onChange={e => set('data_vencimento', e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea value={formData.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={isSaving} onClick={handleSubmit}>
            {isSaving ? 'Salvando...' : editingItem ? 'Salvar' : formData.parcelar ? `Gerar ${formData.num_parcelas} Parcelas` : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}