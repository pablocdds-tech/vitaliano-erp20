import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import { Plus, Trash2, Package } from 'lucide-react';
import { format } from 'date-fns';

export default function PedidoForm({ onSave, onCancel, saving, pedidoInicial }) {
  const [lojaDestinoId, setLojaDestinoId] = useState(pedidoInicial?.loja_destino_id || '');
  const [data, setData] = useState(pedidoInicial?.data || format(new Date(), 'yyyy-MM-dd'));
  const [observacoes, setObservacoes] = useState(pedidoInicial?.observacoes || '');
  const [itens, setItens] = useState(pedidoInicial?.itens || []);
  const [search, setSearch] = useState('');

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list('nome'),
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos-ativos'],
    queryFn: () => base44.entities.Produto.filter({ status: 'ativo' }, 'nome', 200),
  });

  const cd = lojas.find(l => l.tipo === 'cd');
  const lojasDestino = lojas.filter(l => l.tipo === 'loja');

  const produtosFiltrados = produtos.filter(p =>
    !search || p.nome.toLowerCase().includes(search.toLowerCase()) || (p.codigo || '').toLowerCase().includes(search.toLowerCase())
  );

  const adicionarItem = (produto) => {
    if (itens.find(i => i.produto_id === produto.id)) return;
    setItens(prev => [...prev, {
      produto_id: produto.id,
      produto_nome: produto.nome,
      quantidade: 1,
      preco_unitario: produto.custo_medio || produto.preco_venda || 0,
      subtotal: produto.custo_medio || produto.preco_venda || 0,
    }]);
    setSearch('');
  };

  const atualizarItem = (idx, campo, valor) => {
    setItens(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const atualizado = { ...item, [campo]: valor };
      atualizado.subtotal = atualizado.quantidade * atualizado.preco_unitario;
      return atualizado;
    }));
  };

  const removerItem = (idx) => setItens(prev => prev.filter((_, i) => i !== idx));

  const valorTotal = itens.reduce((s, i) => s + i.subtotal, 0);
  const totalItens = itens.reduce((s, i) => s + i.quantidade, 0);

  const handleSave = () => {
    if (!cd) { alert('Nenhum CD cadastrado.'); return; }
    if (!lojaDestinoId) { alert('Selecione a loja destino.'); return; }
    if (itens.length === 0) { alert('Adicione pelo menos um item.'); return; }
    onSave({ cd_id: cd.id, loja_destino_id: lojaDestinoId, data, observacoes, itens, total_itens: totalItens, valor_total: valorTotal, status: 'draft' });
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label>CD de Origem</Label>
          <Input value={cd?.nome || 'Nenhum CD cadastrado'} disabled className="bg-slate-50" />
        </div>
        <div className="space-y-1">
          <Label>Loja Destino *</Label>
          <Select value={lojaDestinoId} onValueChange={setLojaDestinoId}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {lojasDestino.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Data *</Label>
          <Input type="date" value={data} onChange={e => setData(e.target.value)} />
        </div>
      </div>

      {/* Busca de produtos */}
      <div className="space-y-2">
        <Label>Adicionar Produto</Label>
        <Input
          placeholder="Buscar produto por nome ou código..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search.length > 0 && (
          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-white shadow-lg z-10">
            {produtosFiltrados.slice(0, 10).map(p => (
              <button
                key={p.id}
                onClick={() => adicionarItem(p)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 text-left border-b last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium">{p.nome}</span>
                  {p.codigo && <span className="text-xs text-slate-400">({p.codigo})</span>}
                </div>
                <span className="text-xs text-slate-500">{formatMoney(p.custo_medio || 0)}/un</span>
              </button>
            ))}
            {produtosFiltrados.length === 0 && (
              <div className="px-4 py-3 text-sm text-slate-400 text-center">Nenhum produto encontrado</div>
            )}
          </div>
        )}
      </div>

      {/* Tabela de itens */}
      {itens.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Produto</th>
                <th className="text-center px-4 py-2.5 font-medium text-slate-600 w-28">Qtd</th>
                <th className="text-center px-4 py-2.5 font-medium text-slate-600 w-36">Preço Unit.</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600 w-32">Subtotal</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item, idx) => (
                <tr key={idx} className="border-b last:border-b-0">
                  <td className="px-4 py-2.5 font-medium">{item.produto_nome}</td>
                  <td className="px-4 py-2.5">
                    <Input
                      type="number"
                      min="0.001"
                      step="any"
                      value={item.quantidade}
                      onChange={e => atualizarItem(idx, 'quantidade', parseFloat(e.target.value) || 0)}
                      className="w-full text-center h-8"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.preco_unitario}
                      onChange={e => atualizarItem(idx, 'preco_unitario', parseFloat(e.target.value) || 0)}
                      className="w-full text-center h-8"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">
                    {formatMoney(item.subtotal)}
                  </td>
                  <td className="px-2 py-2.5">
                    <button onClick={() => removerItem(idx)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right font-semibold text-slate-700">
                  Total ({totalItens} itens):
                </td>
                <td className="px-4 py-3 text-right text-lg font-bold text-emerald-700">
                  {formatMoney(valorTotal)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {itens.length === 0 && (
        <div className="border-2 border-dashed border-slate-200 rounded-lg py-10 text-center text-slate-400">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Busque e adicione produtos acima</p>
        </div>
      )}

      <div className="space-y-1">
        <Label>Observações</Label>
        <Input value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional..." />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : (pedidoInicial ? 'Salvar Alterações' : 'Salvar como Rascunho')}
        </Button>
      </div>
    </div>
  );
}