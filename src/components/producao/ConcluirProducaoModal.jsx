/**
 * Modal de conclusão de Ordem de Produção.
 * Executa: baixa de insumos (OUT) + entrada do produto (IN) + custo real.
 */
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Package, AlertTriangle } from 'lucide-react';
import MoneyDisplay, { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import { concluirProducao } from '@/components/services/producaoService';
import { toast } from 'sonner';

export default function ConcluirProducaoModal({ open, onClose, producao, produtos, onSaved }) {
  const [qtdProduzida, setQtdProduzida] = useState(producao?.quantidade_planejada || 0);
  const [salvando, setSalvando] = useState(false);

  const produto = produtos?.find(p => p.id === producao?.produto_id);
  const custoEstimado = (producao?.insumos_utilizados || []).reduce(
    (s, i) => s + (i.quantidade_utilizada || 0) * (i.custo_unitario || 0), 0
  );
  const custoUnitEstimado = qtdProduzida > 0 ? custoEstimado / qtdProduzida : 0;

  const handleConcluir = async () => {
    if (!qtdProduzida || qtdProduzida <= 0) {
      toast.error('Informe a quantidade produzida.');
      return;
    }
    setSalvando(true);
    try {
      await concluirProducao(producao, Number(qtdProduzida));
      toast.success('Produção concluída! Estoque atualizado.');
      onSaved && onSaved();
      onClose();
    } catch (e) {
      toast.error('Erro: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  if (!producao) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" /> Concluir Produção
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-1">
            <p className="text-sm font-semibold">{produto?.nome || 'Produto'}</p>
            <p className="text-xs text-slate-500">Planejado: {producao.quantidade_planejada} {produto?.unidade_medida || 'un'}</p>
          </div>

          {/* Insumos que serão baixados */}
          {(producao.insumos_utilizados || []).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Baixa de insumos (saída OUT)</p>
              {producao.insumos_utilizados.map((ins, i) => (
                <div key={i} className="flex justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-slate-600">{ins.produto_id?.substring(0, 8)}…</span>
                  <span className="font-medium text-red-600">-{ins.quantidade_utilizada} × {formatMoney(ins.custo_unitario)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-1 font-semibold">
                <span>Custo total estimado</span>
                <MoneyDisplay value={custoEstimado} />
              </div>
            </div>
          )}

          {/* Quantidade real produzida */}
          <div className="space-y-1">
            <Label>Quantidade efetivamente produzida *</Label>
            <Input type="number" min={0.01} step="0.01" value={qtdProduzida} onChange={e => setQtdProduzida(e.target.value)} />
            <p className="text-xs text-slate-400">Custo unitário real: {formatMoney(custoUnitEstimado)} / {produto?.unidade_medida || 'un'}</p>
          </div>

          {Number(qtdProduzida) < producao.quantidade_planejada && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Perda de {(producao.quantidade_planejada - Number(qtdProduzida)).toFixed(2)} {produto?.unidade_medida || 'un'} será registrada.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConcluir} disabled={salvando} className="bg-emerald-600 hover:bg-emerald-700">
            {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Confirmar e Baixar Estoque
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}