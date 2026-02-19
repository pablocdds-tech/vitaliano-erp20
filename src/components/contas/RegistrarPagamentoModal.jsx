import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Plus, Trash2, SplitSquareHorizontal, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import { getEmpresaAtiva } from '@/components/services/tenantService';

// Cria lançamento no banco virtual reduzindo dívida da loja com o CD
async function abaterDividaBancoVirtual({ empresa_id, loja_id, cd_id, valor, descricao, conta_id }) {
  if (!loja_id || !cd_id || loja_id === cd_id) return;

  // Busca saldo atual da loja
  const lojaAtual = await base44.entities.Loja.filter({ id: loja_id });
  const loja = lojaAtual[0];
  if (!loja) return;

  const cdAtual = await base44.entities.Loja.filter({ id: cd_id });
  const cd = cdAtual[0];
  if (!cd) return;

  // Cria movimentação aprovada diretamente (pagamento real já foi feito)
  await base44.entities.BancoVirtual.create({
    empresa_id,
    loja_origem_id: loja_id,
    loja_destino_id: cd_id,
    tipo: 'pagamento_boleto_cd',
    valor,
    descricao: descricao || 'Abatimento de dívida via pagamento de conta',
    status: 'aprovado',
    data_aprovacao: new Date().toISOString(),
    referencia_conta_pagar_id: conta_id,
  });

  // Atualiza saldos imediatamente
  await base44.entities.Loja.update(loja_id, {
    saldo_banco_virtual: (loja.saldo_banco_virtual || 0) - valor,
  });
  await base44.entities.Loja.update(cd_id, {
    saldo_banco_virtual: (cd.saldo_banco_virtual || 0) + valor,
  });
}

export default function RegistrarPagamentoModal({ open, onClose, conta, contasBancarias, cofres, lojas }) {
  const queryClient = useQueryClient();

  const valorDevido = (conta?.valor_original || 0) - (conta?.valor_pago || 0);
  const cd = lojas?.find(l => l.tipo === 'cd');
  const isContaDoCD = conta?.loja_id && lojas?.find(l => l.id === conta.loja_id)?.tipo === 'cd';

  const emptyLine = { tipo_origem: 'conta_bancaria', origem_id: '', valor: '' };

  const [dataPagamento, setDataPagamento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [observacao, setObservacao] = useState('');
  const [linhas, setLinhas] = useState([{ ...emptyLine, valor: valorDevido || '' }]);

  // Reset quando abre
  React.useEffect(() => {
    if (open && conta) {
      const vd = (conta.valor_original || 0) - (conta.valor_pago || 0);
      setLinhas([{ ...emptyLine, valor: vd }]);
      setDataPagamento(format(new Date(), 'yyyy-MM-dd'));
      setObservacao('');
    }
  }, [open, conta?.id]);

  const totalLinhas = linhas.reduce((s, l) => s + (parseFloat(l.valor) || 0), 0);
  const isQuitado = totalLinhas >= (conta?.valor_original || 0) - (conta?.valor_pago || 0) - 0.01;
  const isParcial = totalLinhas > 0 && !isQuitado;

  const addLinha = () => setLinhas(p => [...p, { ...emptyLine }]);
  const removeLinha = (idx) => setLinhas(p => p.filter((_, i) => i !== idx));
  const updateLinha = (idx, field, val) => setLinhas(p => p.map((l, i) => i === idx ? { ...l, [field]: val } : l));

  const getOrigemOptions = (tipoOrigem) => {
    if (tipoOrigem === 'conta_bancaria') return contasBancarias || [];
    if (tipoOrigem === 'cofre_loja' || tipoOrigem === 'cofre_central') return cofres || [];
    return [];
  };

  const getOrigemLabel = (tipoOrigem, id) => {
    const opts = getOrigemOptions(tipoOrigem);
    const item = opts.find(o => o.id === id);
    if (!item) return '';
    return item.nome || item.banco || '';
  };

  const getLojaDeOrigem = (tipoOrigem, origemId) => {
    // Descobre qual loja está associada à conta bancária ou cofre
    if (tipoOrigem === 'conta_bancaria') {
      const cb = (contasBancarias || []).find(c => c.id === origemId);
      return cb?.loja_id || null;
    }
    if (tipoOrigem === 'cofre_loja') {
      const cf = (cofres || []).find(c => c.id === origemId);
      return cf?.loja_id || null;
    }
    return null;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!conta) throw new Error('Conta não encontrada');
      if (conta.status === 'pago') throw new Error('Esta conta já está quitada');
      if (linhas.some(l => !l.origem_id || !l.valor || parseFloat(l.valor) <= 0)) {
        throw new Error('Preencha todas as origens e valores');
      }
      if (totalLinhas <= 0) throw new Error('Total pago deve ser maior que zero');

      const empresa = await getEmpresaAtiva();
      const jaFoi = conta.valor_pago || 0;
      const novoTotalPago = jaFoi + totalLinhas;
      const novoStatus = novoTotalPago >= (conta.valor_original - 0.01) ? 'pago' : 'parcial';

      // Salva linhas de pagamento no campo pagamentos da conta
      const pagamentosExistentes = conta.pagamentos || [];
      const novaLinhas = linhas.map(l => ({
        tipo_origem: l.tipo_origem,
        origem_id: l.origem_id,
        origem_label: getOrigemLabel(l.tipo_origem, l.origem_id),
        valor: parseFloat(l.valor),
        data: dataPagamento,
      }));

      await base44.entities.ContaPagar.update(conta.id, {
        status: novoStatus,
        data_pagamento: dataPagamento,
        valor_pago: novoTotalPago,
        observacoes: observacao || conta.observacoes,
        pagamentos: [...pagamentosExistentes, ...novaLinhas],
      });

      // Debitar cada conta bancária real usada no pagamento
      for (const linha of linhas) {
        if (linha.tipo_origem === 'conta_bancaria' && linha.origem_id) {
          await base44.entities.TransacaoBancaria.create({
            conta_bancaria_id: linha.origem_id,
            data: dataPagamento,
            valor: -Math.abs(parseFloat(linha.valor)),
            tipo: 'debito',
            descricao: `Pagamento: ${conta.descricao}`,
            status: 'conciliado',
            conciliado_com_tipo: 'conta_pagar',
            conciliado_com_id: conta.id,
            conciliado_em: new Date().toISOString(),
          });
        }
      }

      // Se a conta é do CD → abater dívida no banco virtual para cada loja pagadora
      if (isContaDoCD && cd) {
        for (const linha of linhas) {
          const lojaId = getLojaDeOrigem(linha.tipo_origem, linha.origem_id);
          if (lojaId && lojaId !== cd.id) {
            await abaterDividaBancoVirtual({
              empresa_id: empresa.id,
              loja_id: lojaId,
              cd_id: cd.id,
              valor: parseFloat(linha.valor),
              descricao: `Pagamento: ${conta.descricao} (${dataPagamento})`,
              conta_id: conta.id,
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      queryClient.invalidateQueries({ queryKey: ['banco-virtual'] });
      queryClient.invalidateQueries({ queryKey: ['lojas'] });
      queryClient.invalidateQueries({ queryKey: ['transacoes-bancarias'] });
      toast.success(isQuitado ? 'Conta quitada com sucesso!' : 'Pagamento parcial registrado!');
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!conta) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SplitSquareHorizontal className="w-5 h-5 text-indigo-500" />
            Registrar Pagamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo da conta */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-4 space-y-1 text-sm">
            <p className="font-semibold text-slate-800 dark:text-white">{conta.descricao}</p>
            <div className="flex justify-between text-slate-500">
              <span>Valor original:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{formatMoney(conta.valor_original)}</span>
            </div>
            {(conta.valor_pago || 0) > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Já pago:</span>
                <span className="font-medium text-emerald-600">{formatMoney(conta.valor_pago)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1 mt-1">
              <span className="font-medium">Saldo devedor:</span>
              <span className="font-bold text-red-600">{formatMoney(valorDevido)}</span>
            </div>
          </div>

          {isContaDoCD && (
            <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Esta é uma despesa do CD. Ao registrar pagamento via conta bancária de uma loja, a dívida dessa loja no Banco Virtual será abatida automaticamente.</span>
            </div>
          )}

          {/* Data */}
          <div className="space-y-1">
            <Label>Data do Pagamento *</Label>
            <Input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} />
          </div>

          {/* Linhas de origem (split) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Origem do Dinheiro *</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addLinha} className="gap-1 text-indigo-600 hover:text-indigo-700 h-7 px-2">
                <Plus className="w-3.5 h-3.5" /> Split
              </Button>
            </div>

            {linhas.map((linha, idx) => (
              <div key={idx} className="border rounded-lg p-3 space-y-2 bg-white dark:bg-slate-900">
                <div className="flex gap-2">
                  <Select value={linha.tipo_origem} onValueChange={v => updateLinha(idx, 'tipo_origem', v)}>
                    <SelectTrigger className="flex-1 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conta_bancaria">Conta Bancária</SelectItem>
                      <SelectItem value="cofre_loja">Cofre da Loja</SelectItem>
                      <SelectItem value="cofre_central">Cofre Central</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number" min="0.01" step="0.01"
                    className="w-32 h-8 text-xs"
                    placeholder="Valor R$"
                    value={linha.valor}
                    onChange={e => updateLinha(idx, 'valor', e.target.value)}
                  />
                  {linhas.length > 1 && (
                    <button type="button" onClick={() => removeLinha(idx)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <Select value={linha.origem_id || '__none__'} onValueChange={v => updateLinha(idx, 'origem_id', v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione a conta / cofre..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Selecione...</SelectItem>
                    {getOrigemOptions(linha.tipo_origem).map(o => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.nome || o.banco} {o.loja_id ? `(${lojas?.find(l => l.id === o.loja_id)?.nome || ''})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {/* Totalizador */}
          <div className={`flex justify-between items-center rounded-lg px-4 py-3 text-sm font-medium border ${
            isQuitado ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
            isParcial ? 'bg-amber-50 border-amber-200 text-amber-700' :
            'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <span>Total a pagar agora:</span>
            <span className="text-lg font-bold">{formatMoney(totalLinhas)}</span>
          </div>

          {isParcial && (
            <p className="text-xs text-amber-600 text-center">⚠️ Pagamento parcial — conta ficará com status <strong>parcial</strong>. Saldo restante: {formatMoney(valorDevido - totalLinhas)}</p>
          )}

          {/* Observação */}
          <div className="space-y-1">
            <Label>Observação / Comprovante</Label>
            <Textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2} placeholder="Número do comprovante, observação..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={mutation.isPending || totalLinhas <= 0}
            onClick={() => mutation.mutate()}
            className={isQuitado ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            {mutation.isPending ? 'Registrando...' : isQuitado ? 'Quitar Conta' : 'Registrar Pagamento Parcial'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}