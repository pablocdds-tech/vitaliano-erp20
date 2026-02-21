import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Upload, Loader2, CheckCircle2, AlertTriangle, FileImage,
  Trash2, Plus, X
} from 'lucide-react';
import { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import { toast } from 'sonner';
import { format } from 'date-fns';

const UNIDADES = ['un', 'kg', 'g', 'l', 'ml', 'cx', 'pc', 'fd'];

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // strip the data:...;base64, prefix
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ImportarNFModal({ open, onClose, onConfirm, fornecedores = [], lojas = [] }) {
  const [step, setStep] = useState('upload'); // 'upload' | 'review'
  const [loadingGemini, setLoadingGemini] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileName, setFileName] = useState('');
  const [extracted, setExtracted] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const reset = () => {
    setStep('upload');
    setLoadingGemini(false);
    setPreviewUrl(null);
    setFileName('');
    setExtracted(null);
    setSaving(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !isPdf) {
      toast.error('Selecione uma imagem (JPG, PNG) ou PDF');
      return;
    }

    setFileName(file.name);
    if (isImage) setPreviewUrl(URL.createObjectURL(file));

    setLoadingGemini(true);
    try {
      const base64 = await toBase64(file);
      const mimeType = file.type;

      const response = await base44.functions.invoke('lerNotaFiscal', {
        image_base64: base64,
        mime_type: mimeType,
      });

      const data = response.data?.data;
      if (!data) throw new Error('Resposta inesperada da função');

      // Monta o estado editável
      setExtracted({
        fornecedor_razao_social: data.fornecedor?.razao_social || '',
        fornecedor_cnpj: data.fornecedor?.cnpj || '',
        fornecedor_id: matchFornecedor(fornecedores, data.fornecedor?.cnpj, data.fornecedor?.razao_social),
        numero: data.numero || '',
        serie: data.serie || '1',
        chave_acesso: data.chave_acesso || '',
        data_emissao: data.data_emissao || format(new Date(), 'yyyy-MM-dd'),
        data_vencimento: data.data_vencimento || '',
        forma_pagamento: data.forma_pagamento || 'boleto',
        valor_produtos: data.valor_produtos ?? null,
        valor_frete: data.valor_frete ?? 0,
        valor_desconto: data.valor_desconto ?? 0,
        valor_total_declarado: data.valor_total ?? 0,
        observacoes: data.observacoes || '',
        itens: (data.itens || []).map(item => ({
          descricao_nf: item.descricao || '',
          quantidade: item.quantidade ?? 1,
          custo_unitario: item.valor_unitario ?? 0,
          subtotal: item.subtotal ?? (item.quantidade * item.valor_unitario) ?? 0,
          produto_id: '',
        })),
      });

      setStep('review');
      toast.success('NF lida com sucesso! Revise os dados antes de confirmar.');
    } catch (err) {
      toast.error('Erro ao processar: ' + err.message);
    } finally {
      setLoadingGemini(false);
      e.target.value = '';
    }
  };

  function matchFornecedor(lista, cnpj, nome) {
    if (!lista?.length) return '';
    if (cnpj) {
      const cnpjClean = cnpj.replace(/\D/g, '');
      const found = lista.find(f => (f.cnpj || '').replace(/\D/g, '') === cnpjClean);
      if (found) return found.id;
    }
    if (nome) {
      const found = lista.find(f =>
        (f.razao_social || '').toLowerCase().includes(nome.toLowerCase()) ||
        (f.nome_fantasia || '').toLowerCase().includes(nome.toLowerCase())
      );
      if (found) return found.id;
    }
    return '';
  }

  const updateItem = (idx, field, value) => {
    setExtracted(prev => {
      const itens = prev.itens.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, [field]: value };
        if (field === 'quantidade' || field === 'custo_unitario') {
          updated.subtotal = (parseFloat(updated.quantidade) || 0) * (parseFloat(updated.custo_unitario) || 0);
        }
        return updated;
      });
      return { ...prev, itens };
    });
  };

  const removeItem = (idx) => setExtracted(prev => ({ ...prev, itens: prev.itens.filter((_, i) => i !== idx) }));
  const addItem = () => setExtracted(prev => ({ ...prev, itens: [...prev.itens, { descricao_nf: '', quantidade: 1, custo_unitario: 0, subtotal: 0, produto_id: '' }] }));

  // Validação de totais
  const somaItens = extracted?.itens?.reduce((s, it) => s + (parseFloat(it.subtotal) || 0), 0) ?? 0;
  const totalDeclarado = parseFloat(extracted?.valor_total_declarado) || 0;
  const divergencia = extracted ? Math.abs(somaItens - totalDeclarado) > 0.05 : false;

  const handleConfirmar = async () => {
    if (!extracted?.numero) { toast.error('Número da NF é obrigatório'); return; }
    setSaving(true);
    try {
      const payload = {
        fornecedor_id: extracted.fornecedor_id || undefined,
        numero: extracted.numero,
        serie: extracted.serie,
        chave_acesso: extracted.chave_acesso,
        data_emissao: extracted.data_emissao,
        data_entrada: format(new Date(), 'yyyy-MM-dd'),
        valor_total: somaItens || totalDeclarado,
        valor_frete: extracted.valor_frete || 0,
        valor_desconto: extracted.valor_desconto || 0,
        forma_pagamento: extracted.forma_pagamento,
        observacoes: extracted.observacoes,
        itens: extracted.itens.map(it => ({
          produto_id: it.produto_id || '',
          descricao_nf: it.descricao_nf,
          quantidade: parseFloat(it.quantidade) || 0,
          custo_unitario: parseFloat(it.custo_unitario) || 0,
          subtotal: parseFloat(it.subtotal) || 0,
          vinculado: !!it.produto_id,
        })),
        processada_ia: true,
      };
      onConfirm(payload);
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileImage className="w-5 h-5 text-indigo-600" />
            Importar Nota Fiscal por Imagem / PDF
          </DialogTitle>
        </DialogHeader>

        {/* STEP: UPLOAD */}
        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileSelect} />

            {loadingGemini ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <div className="text-center">
                  <p className="font-medium text-slate-800">Lendo a nota fiscal...</p>
                  <p className="text-sm text-slate-500 mt-1">O Gemini está extraindo os dados. Aguarde.</p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 rounded-xl p-12 flex flex-col items-center gap-4 transition-all"
              >
                <div className="h-16 w-16 rounded-2xl bg-indigo-100 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-indigo-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-slate-800">Clique para selecionar</p>
                  <p className="text-sm text-slate-500 mt-1">JPG, PNG ou PDF da nota fiscal</p>
                </div>
              </button>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>Os dados serão extraídos via <strong>Google Gemini</strong> e exibidos para revisão antes de salvar. Nenhum dado é criado automaticamente.</span>
            </div>
          </div>
        )}

        {/* STEP: REVIEW */}
        {step === 'review' && extracted && (
          <div className="space-y-5 py-2">

            {/* Alerta de divergência */}
            {divergencia && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-xl p-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">
                  <strong>Atenção: divergência de valores!</strong>
                  <br />
                  Soma dos itens: <strong>{formatMoney(somaItens)}</strong> · Total declarado na NF: <strong>{formatMoney(totalDeclarado)}</strong> · Diferença: <strong>{formatMoney(Math.abs(somaItens - totalDeclarado))}</strong>
                </div>
              </div>
            )}

            {/* Preview imagem */}
            {previewUrl && (
              <div className="flex justify-center">
                <img src={previewUrl} alt="NF" className="max-h-40 rounded-lg border shadow-sm object-contain" />
              </div>
            )}

            {fileName && !previewUrl && (
              <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border rounded-lg px-3 py-2">
                <FileImage className="w-4 h-4 text-slate-400" />{fileName}
              </div>
            )}

            {/* Fornecedor */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Fornecedor no Sistema</Label>
                <Select
                  value={extracted.fornecedor_id || '__none__'}
                  onValueChange={v => setExtracted(p => ({ ...p, fornecedor_id: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Vincular fornecedor..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Não vincular —</SelectItem>
                    {fornecedores.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {extracted.fornecedor_razao_social && (
                  <p className="text-xs text-slate-400">Extraído: {extracted.fornecedor_razao_social} {extracted.fornecedor_cnpj ? `· CNPJ: ${extracted.fornecedor_cnpj}` : ''}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Forma de Pagamento</Label>
                <Select value={extracted.forma_pagamento || 'boleto'} onValueChange={v => setExtracted(p => ({ ...p, forma_pagamento: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['boleto','pix','transferencia','dinheiro','cartao','cheque'].map(v => (
                      <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dados principais */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Número NF *</Label>
                <Input value={extracted.numero} onChange={e => setExtracted(p => ({ ...p, numero: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Série</Label>
                <Input value={extracted.serie} onChange={e => setExtracted(p => ({ ...p, serie: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Data Emissão</Label>
                <Input type="date" value={extracted.data_emissao} onChange={e => setExtracted(p => ({ ...p, data_emissao: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Chave de Acesso</Label>
              <Input value={extracted.chave_acesso} onChange={e => setExtracted(p => ({ ...p, chave_acesso: e.target.value }))} placeholder="44 dígitos" className="font-mono text-xs" />
            </div>

            {/* Itens */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Itens Extraídos ({extracted.itens.length})</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1 h-7 text-xs">
                  <Plus className="w-3 h-3" /> Adicionar
                </Button>
              </div>

              {extracted.itens.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4 border-2 border-dashed rounded-lg">Nenhum item extraído. Adicione manualmente.</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left p-2 pl-3 font-medium text-slate-500">Descrição</th>
                        <th className="text-right p-2 font-medium text-slate-500 w-20">Qtd</th>
                        <th className="text-right p-2 font-medium text-slate-500 w-28">Custo Unit.</th>
                        <th className="text-right p-2 font-medium text-slate-500 w-28">Subtotal</th>
                        <th className="w-8 p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {extracted.itens.map((item, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="p-2 pl-3">
                            <Input
                              value={item.descricao_nf}
                              onChange={e => updateItem(idx, 'descricao_nf', e.target.value)}
                              className="h-7 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number" min="0.001" step="0.001"
                              value={item.quantidade}
                              onChange={e => updateItem(idx, 'quantidade', parseFloat(e.target.value) || 0)}
                              className="h-7 text-xs text-right w-20"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number" min="0" step="0.01"
                              value={item.custo_unitario}
                              onChange={e => updateItem(idx, 'custo_unitario', parseFloat(e.target.value) || 0)}
                              className="h-7 text-xs text-right w-28"
                            />
                          </td>
                          <td className="p-2 text-right font-semibold text-slate-700">
                            {formatMoney(item.subtotal || 0)}
                          </td>
                          <td className="p-2">
                            <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t">
                      <tr>
                        <td colSpan={3} className="p-2 pl-3 text-right text-xs text-slate-500 font-medium">
                          Soma dos itens
                          {divergencia && <span className="ml-2 text-red-500">⚠️ difere do total declarado ({formatMoney(totalDeclarado)})</span>}
                        </td>
                        <td className={`p-2 text-right font-bold text-sm ${divergencia ? 'text-red-600' : 'text-emerald-600'}`}>
                          {formatMoney(somaItens)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Botão trocar arquivo */}
            <button
              type="button"
              onClick={() => { setStep('upload'); setPreviewUrl(null); setFileName(''); setExtracted(null); }}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Trocar arquivo
            </button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          {step === 'review' && (
            <Button
              onClick={handleConfirmar}
              disabled={saving || !extracted?.numero}
              className="bg-indigo-600 hover:bg-indigo-700 gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirmar e usar dados
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}