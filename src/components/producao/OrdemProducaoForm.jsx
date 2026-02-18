/**
 * Formulário de criação/edição de Ordem de Produção.
 * Ao selecionar a ficha técnica, popula automaticamente os insumos com custo médio atual.
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { calcularCustoFicha } from '@/components/services/producaoService';
import CustoFichaPanel from './CustoFichaPanel';
import { toast } from 'sonner';

export default function OrdemProducaoForm({ open, onClose, onSaved, empresaId }) {
  const [form, setForm] = useState({
    produto_id: '',
    ficha_tecnica_id: '',
    loja_id: '',
    quantidade_planejada: 1,
    data_planejada: new Date().toISOString().split('T')[0],
    responsavel: '',
    observacoes: '',
  });
  const [salvando, setSalvando] = useState(false);

  const { data: fichas = [] } = useQuery({ queryKey: ['fichas-tecnicas'], queryFn: () => base44.entities.FichaTecnica.filter({ status: 'ativo' }) });
  const { data: produtos = [] } = useQuery({ queryKey: ['produtos'], queryFn: () => base44.entities.Produto.list() });
  const { data: lojas = [] } = useQuery({ queryKey: ['lojas'], queryFn: () => base44.entities.Loja.list() });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Ao selecionar ficha, auto-preenche produto
  const onFichaChange = (fichaId) => {
    const ficha = fichas.find(f => f.id === fichaId);
    set('ficha_tecnica_id', fichaId);
    if (ficha?.produto_id) set('produto_id', ficha.produto_id);
  };

  const handleSalvar = async () => {
    if (!form.produto_id || !form.loja_id || !form.quantidade_planejada) {
      toast.error('Preencha produto, loja e quantidade.');
      return;
    }
    setSalvando(true);
    try {
      // Calcular insumos com custo atual para gravar na ordem
      let insumos_utilizados = [];
      if (form.ficha_tecnica_id && form.loja_id && empresaId) {
        const r = await calcularCustoFicha(form.ficha_tecnica_id, form.loja_id, empresaId);
        const proporcao = form.quantidade_planejada / (r.ficha.rendimento || 1);
        insumos_utilizados = r.ingredientes_com_custo.map(ing => ({
          produto_id: ing.produto_id,
          quantidade_prevista: (ing.quantidade || 0) * proporcao,
          quantidade_utilizada: (ing.quantidade || 0) * proporcao,
          custo_unitario: ing.custo_unitario,
        }));
      }

      await base44.entities.Producao.create({
        empresa_id: empresaId,
        loja_id: form.loja_id,
        produto_id: form.produto_id,
        ficha_tecnica_id: form.ficha_tecnica_id || null,
        quantidade_planejada: Number(form.quantidade_planejada),
        data_planejada: form.data_planejada,
        responsavel: form.responsavel,
        observacoes: form.observacoes,
        insumos_utilizados,
        status: 'planejada',
        numero: `OP-${Date.now()}`,
      });

      toast.success('Ordem de produção criada!');
      onSaved && onSaved();
      onClose();
    } catch (e) {
      toast.error('Erro: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Ordem de Produção</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Ficha Técnica</Label>
              <Select value={form.ficha_tecnica_id} onValueChange={onFichaChange}>
                <SelectTrigger><SelectValue placeholder="Selecione a receita..." /></SelectTrigger>
                <SelectContent>
                  {fichas.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 col-span-2">
              <Label>Produto Final *</Label>
              <Select value={form.produto_id} onValueChange={v => set('produto_id', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o produto..." /></SelectTrigger>
                <SelectContent>
                  {produtos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Loja / CD *</Label>
              <Select value={form.loja_id} onValueChange={v => set('loja_id', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Quantidade a Produzir *</Label>
              <Input type="number" min={1} value={form.quantidade_planejada} onChange={e => set('quantidade_planejada', e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>Data Planejada</Label>
              <Input type="date" value={form.data_planejada} onChange={e => set('data_planejada', e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>Responsável</Label>
              <Input value={form.responsavel} onChange={e => set('responsavel', e.target.value)} placeholder="Nome..." />
            </div>

            <div className="space-y-1 col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2} />
            </div>
          </div>

          {/* Custo calculado automaticamente */}
          {form.ficha_tecnica_id && (
            <CustoFichaPanel
              fichaTecnicaId={form.ficha_tecnica_id}
              lojaId={form.loja_id}
              empresaId={empresaId}
              quantidade={Number(form.quantidade_planejada) || 1}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Criar Ordem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}