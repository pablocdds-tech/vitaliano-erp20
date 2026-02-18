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
import { Plus, Trash2, SplitSquareHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import { getEmpresaAtiva } from '@/components/services/tenantService';

export default function RegistrarRecebimentoModal({ open, onClose, conta, contasBancarias, cofres, lojas }) {
  const queryClient = useQueryClient();

  const valorDue = (conta?.valor_original || 0) - (conta?.valor_recebido || 0);

  const emptyLine = { tipo_destino: 'conta_bancaria', destino_id: '', valor: '' };

  const [dataRecebimento, setDataRecebimento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [observacao, setObservacao] = useState('');
  const [linhas, setLinhas] = useState([{ ...emptyLine, valor: valorDue || '' }]);

  // Reset quando abre
  React.useEffect(() => {
    if (open && conta) {
      const vd = (conta.valor_original || 0) - (conta.valor_recebido || 0);
      setLinhas([{ ...emptyLine, valor: vd }]);
      setDataRecebimento(format(new Date(), 'yyyy-MM-dd'));
      setObservacao('');
    }
  }, [open, conta?.id]);

  const totalLinhas = linhas.reduce((s, l) => s + (parseFloat(l.valor) || 0), 0);
  const isQuitado = totalLinhas >= (conta?.valor_original || 0) - (conta?.valor_recebido || 0) - 0.01;
  const isParcial = totalLinhas > 0 && !isQuitado;

  const addLinha = () => setLinhas(p => [...p, { ...emptyLine }]);
  const removeLinha = (idx) => setLinhas(p => p.filter((_, i) => i !== idx));
  const updateLinha = (idx, field, val) => setLinhas(p => p.map((l, i) => i === idx ? { ...l, [field]: val } : l));

  const getDestinoOptions = (tipoDestino) => {
    if (tipoDestino === 'conta_bancaria') return contasBancarias || [];
    if (tipoDestino === 'cofre_loja' || tipoDestino === 'cofre_central') return cofres || [];
    return [];
  };

  const getDestinoLabel = (tipoDestino, id) => {
    const opts = getDestinoOptions(tipoDestino);
    const item = opts.find(o => o.id === id);
    if (!item) return '';
    return item.nome || item.banco || '';
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!conta) throw new Error('Conta não encontrada');
      if (linhas.some(l => !l.destino_id || !l.valor || parseFloat(l.valor) <= 0)) {
        throw new Error('Preencha todos os destinos e valores');
      }
      if (totalLinhas <= 0) throw new Error('Total a receber deve ser maior que zero');

      const jaFoi = conta.valor_recebido || 0;
      const novoTotalRecebido = jaFoi + totalLinhas;
      const novoStatus = novoTotalRecebido >= (conta.valor_original - 0.01) ? 'recebido' : 'parcial';

      // Salva linhas de recebimento no campo (mantém estrutura simples)
      const novaLinhas = linhas.map(l => ({
        tipo_destino: l.tipo_destino,
        destino_id: l.destino_id,
        destino_label: getDestinoLabel(l.tipo_destino, l.destino_id),
        valor: parseFloat(l.valor),
        data: dataRecebimento,
      }));

      await base44.entities.ContaReceber.update(conta.id, {
        status: novoStatus,
        data_recebimento: dataRecebimento,
        valor_recebido: novoTotalRecebido,
        observacoes: observacao || conta.observacoes,
      });

      // Creditar cada conta bancária real usada no recebimento
      for (const linha of linhas) {
        if (linha.tipo_destino === 'conta_bancaria' && linha.destino_id) {
          await base44.entities.TransacaoBancaria.create({
            conta_bancaria_id: linha.destino_id,
            data: dataRecebimento,
            valor: Math.abs(parseFloat(linha.valor)),
            tipo: 'credito',
            descricao: `Recebimento: ${conta.descricao}`,
            status: 'conciliado',
            conciliado_com_tipo: 'conta_receber',
            conciliado_com_id: conta.id,
            conciliado_em: new Date().toISOString(),
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contasReceber'] });
      queryClient.invalidateQueries({ queryKey: ['contasBancarias'] });
      toast.success(isQuitado ? 'Conta recebida com sucesso!' : 'Recebimento parcial registrado!');
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
            <SplitSquareHorizontal className="w-5 h-5 text-emerald-500" />
            Registrar Recebimento
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
            {(conta.valor_recebido || 0) > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Já recebido:</span>
                <span className="font-medium text-emerald-600">{formatMoney(conta.valor_recebido)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1 mt-1">
              <span className="font-medium">Saldo a receber:</span>
              <span className="font-bold text-emerald-600">{formatMoney(valorDue)}</span>
            </div>
          </div>

          {/* Data */}
          <div className="space-y-1">
            <Label>Data do Recebimento *</Label>
            <Input type="date" value={dataRecebimento} onChange={e => setDataRecebimento(e.target.value)} />
          </div>

          {/* Linhas de destino (split) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Destino do Dinheiro *</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addLinha} className="gap-1 text-emerald-600 hover:text-emerald-700 h-7 px-2">
                <Plus className="w-3.5 h-3.5" /> Split
              </Button>
            </div>

            {linhas.map((linha, idx) => (
              <div key={idx} className="border rounded-lg p-3 space-y-2 bg-white dark:bg-slate-900">
                <div className="flex gap-2">
                  <Select value={linha.tipo_destino} onValueChange={v => updateLinha(idx, 'tipo_destino', v)}>
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

                <Select value={linha.destino_id || '__none__'} onValueChange={v => updateLinha(idx, 'destino_id', v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione a conta / cofre..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Selecione...</SelectItem>
                    {getDestinoOptions(linha.tipo_destino).map(o => (
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
            <span>Total a receber agora:</span>
            <span className="text-lg font-bold">{formatMoney(totalLinhas)}</span>
          </div>

          {isParcial && (
            <p className="text-xs text-amber-600 text-center">⚠️ Recebimento parcial — conta ficará com status <strong>parcial</strong>. Saldo restante: {formatMoney(valorDue - totalLinhas)}</p>
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
            {mutation.isPending ? 'Registrando...' : isQuitado ? 'Receber Completo' : 'Registrar Recebimento Parcial'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}