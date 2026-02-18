import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Calculator } from 'lucide-react';
import MoneyDisplay, { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import { calcularLinha, calcularDataRecebimento } from '@/components/services/fechamentoService';
import { format } from 'date-fns';

function LinhaFechamento({ linha, formas, onChange, onRemove }) {
  const forma = formas.find(f => f.id === linha.forma_pagamento_id);

  const handleFormaChange = (id) => {
    const fp = formas.find(f => f.id === id);
    if (!fp) return;
    const { valorTaxa, valorLiquido } = calcularLinha(linha.valor_bruto || 0, fp.taxa_percentual || 0);
    onChange({
      ...linha,
      forma_pagamento_id: id,
      forma_pagamento_nome: fp.nome,
      taxa_percentual: fp.taxa_percentual || 0,
      valor_taxa: valorTaxa,
      valor_liquido: valorLiquido,
    });
  };

  const handleValorChange = (val) => {
    const vb = parseFloat(val) || 0;
    const taxa = linha.taxa_percentual || 0;
    const { valorTaxa, valorLiquido } = calcularLinha(vb, taxa);
    onChange({ ...linha, valor_bruto: vb, valor_taxa: valorTaxa, valor_liquido: valorLiquido });
  };

  const handleTaxaChange = (val) => {
    const taxa = parseFloat(val) || 0;
    const { valorTaxa, valorLiquido } = calcularLinha(linha.valor_bruto || 0, taxa);
    onChange({ ...linha, taxa_percentual: taxa, valor_taxa: valorTaxa, valor_liquido: valorLiquido });
  };

  return (
    <div className="grid grid-cols-12 gap-2 items-center py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
      {/* Forma */}
      <div className="col-span-4">
        <Select value={linha.forma_pagamento_id || ''} onValueChange={handleFormaChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Forma de pgto..." />
          </SelectTrigger>
          <SelectContent>
            {formas.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {/* Valor Bruto */}
      <div className="col-span-2">
        <Input
          type="number" step="0.01" min="0"
          className="h-8 text-xs text-right"
          placeholder="R$ 0,00"
          value={linha.valor_bruto || ''}
          onChange={e => handleValorChange(e.target.value)}
        />
      </div>
      {/* Taxa */}
      <div className="col-span-2">
        <Input
          type="number" step="0.01" min="0" max="100"
          className="h-8 text-xs text-right"
          placeholder="0%"
          value={linha.taxa_percentual ?? ''}
          onChange={e => handleTaxaChange(e.target.value)}
        />
      </div>
      {/* Líquido */}
      <div className="col-span-2 text-right pr-1">
        <span className="text-xs font-medium text-emerald-600">
          {formatMoney(linha.valor_liquido || 0)}
        </span>
      </div>
      {/* Data prevista */}
      <div className="col-span-1 text-right">
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {linha.data_prevista_recebimento
            ? linha.data_prevista_recebimento.substring(5).replace('-', '/')
            : '—'}
        </span>
      </div>
      {/* Remove */}
      <div className="col-span-1 flex justify-end">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={onRemove}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

const LINHA_VAZIA = () => ({
  _key: Math.random(),
  forma_pagamento_id: '',
  forma_pagamento_nome: '',
  valor_bruto: 0,
  taxa_percentual: 0,
  valor_taxa: 0,
  valor_liquido: 0,
  data_prevista_recebimento: '',
});

export default function FechamentoModal({ open, onClose, fechamentoParaVer }) {
  const readOnly = !!fechamentoParaVer;

  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [lojaId, setLojaId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [linhas, setLinhas] = useState([LINHA_VAZIA()]);
  const [saving, setSaving] = useState(false);

  const { data: lojas = [] } = useQuery({ queryKey: ['lojas'], queryFn: () => base44.entities.Loja.list() });
  const { data: formas = [] } = useQuery({ queryKey: ['formas-pagamento'], queryFn: () => base44.entities.FormaPagamento.list('nome') });

  // Ao abrir em modo visualização, preenche os campos
  useEffect(() => {
    if (fechamentoParaVer) {
      setData(fechamentoParaVer.data || '');
      setLojaId(fechamentoParaVer.loja_id || '');
      setObservacoes(fechamentoParaVer.observacoes || '');
      setLinhas(fechamentoParaVer.linhas_fechamento?.length
        ? fechamentoParaVer.linhas_fechamento.map(l => ({ ...l, _key: Math.random() }))
        : []);
    } else {
      setData(format(new Date(), 'yyyy-MM-dd'));
      setLojaId('');
      setObservacoes('');
      setLinhas([LINHA_VAZIA()]);
    }
  }, [fechamentoParaVer, open]);

  // Recalcular datas previstas quando data ou formas mudam
  const linhasComData = linhas.map(l => {
    const forma = formas.find(f => f.id === l.forma_pagamento_id);
    if (!forma || !data) return l;
    const dataPrevista = calcularDataRecebimento(data, forma.regra_recebimento, forma.dia_semana_pagamento ?? 3);
    return { ...l, data_prevista_recebimento: dataPrevista };
  });

  const totalBruto = linhasComData.reduce((s, l) => s + (l.valor_bruto || 0), 0);
  const totalTaxa = linhasComData.reduce((s, l) => s + (l.valor_taxa || 0), 0);
  const totalLiquido = linhasComData.reduce((s, l) => s + (l.valor_liquido || 0), 0);

  const updateLinha = (idx, nova) => {
    const novas = [...linhasComData];
    novas[idx] = nova;
    setLinhas(novas);
  };
  const removeLinha = (idx) => setLinhas(linhasComData.filter((_, i) => i !== idx));
  const addLinha = () => setLinhas([...linhasComData, LINHA_VAZIA()]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!lojaId) { alert('Selecione a loja.'); return; }
    const linhasValidas = linhasComData.filter(l => l.forma_pagamento_id && l.valor_bruto > 0);
    if (linhasValidas.length === 0) { alert('Adicione pelo menos uma linha com valor.'); return; }

    setSaving(true);
    try {
      // 1. Salva o fechamento
      const fechamento = await base44.entities.Venda.create({
        loja_id: lojaId,
        data,
        valor_bruto: totalBruto,
        valor_liquido: totalLiquido,
        linhas_fechamento: linhasValidas,
        observacoes,
      });

      // 2. Gera contas a receber
      for (const linha of linhasValidas) {
        await base44.entities.ContaReceber.create({
          loja_id: lojaId,
          descricao: `Fechamento ${data} — ${linha.forma_pagamento_nome}`,
          origem: 'venda',
          fechamento_id: fechamento.id,
          forma_pagamento_id: linha.forma_pagamento_id,
          cliente_nome: linha.forma_pagamento_nome,
          data_emissao: data,
          data_vencimento: linha.data_prevista_recebimento || data,
          valor_original: linha.valor_liquido,
          valor_bruto: linha.valor_bruto,
          valor_taxa: linha.valor_taxa,
          status: 'pendente',
        });
      }

      onClose(true); // true = refresh
    } catch (err) {
      alert('Erro ao salvar: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose(false)}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            {readOnly ? 'Visualizar Fechamento' : 'Novo Fechamento de Caixa'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={readOnly ? e => e.preventDefault() : handleSave}>
          {/* Cabeçalho */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="space-y-1">
              <Label>Data do Fechamento *</Label>
              <Input type="date" value={data} onChange={e => setData(e.target.value)} disabled={readOnly} required />
            </div>
            <div className="space-y-1">
              <Label>Loja *</Label>
              <Select value={lojaId} onValueChange={setLojaId} disabled={readOnly}>
                <SelectTrigger><SelectValue placeholder="Selecione a loja..." /></SelectTrigger>
                <SelectContent>{lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Cabeçalho da planilha */}
          <div className="grid grid-cols-12 gap-2 px-0 pb-1 border-b-2 border-slate-300 dark:border-slate-600">
            <div className="col-span-4 text-xs font-semibold text-slate-500 uppercase">Forma de Pagamento</div>
            <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase text-right">Valor Bruto</div>
            <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase text-right">Taxa %</div>
            <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase text-right">Líquido</div>
            <div className="col-span-1 text-xs font-semibold text-slate-500 uppercase text-right">Receb.</div>
            <div className="col-span-1"></div>
          </div>

          {/* Linhas */}
          <div className="min-h-[120px]">
            {linhasComData.map((linha, idx) =>
              readOnly ? (
                <div key={linha._key || idx} className="grid grid-cols-12 gap-2 items-center py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div className="col-span-4 text-sm">{linha.forma_pagamento_nome || '-'}</div>
                  <div className="col-span-2 text-right text-sm">{formatMoney(linha.valor_bruto || 0)}</div>
                  <div className="col-span-2 text-right text-sm text-slate-500">{linha.taxa_percentual || 0}%</div>
                  <div className="col-span-2 text-right text-sm text-emerald-600 font-medium">{formatMoney(linha.valor_liquido || 0)}</div>
                  <div className="col-span-2 text-right text-xs text-slate-500">
                    {linha.data_prevista_recebimento ? linha.data_prevista_recebimento.substring(5).replace('-', '/') : '—'}
                  </div>
                </div>
              ) : (
                <LinhaFechamento
                  key={linha._key || idx}
                  linha={linha}
                  formas={formas}
                  onChange={(nova) => updateLinha(idx, nova)}
                  onRemove={() => removeLinha(idx)}
                />
              )
            )}
          </div>

          {!readOnly && (
            <Button type="button" variant="outline" size="sm" className="mt-2 gap-1 w-full" onClick={addLinha}>
              <Plus className="w-4 h-4" />Adicionar Linha
            </Button>
          )}

          {/* Totais */}
          <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Total Bruto</p>
              <MoneyDisplay value={totalBruto} size="lg" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Total Taxas</p>
              <MoneyDisplay value={totalTaxa} size="lg" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Total Líquido</p>
              <MoneyDisplay value={totalLiquido} size="lg" />
            </div>
          </div>

          {!readOnly && (
            <div className="space-y-1 mt-4">
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} placeholder="Opcional..." />
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onClose(false)}>Fechar</Button>
            {!readOnly && (
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Fechamento e Gerar Recebíveis'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}