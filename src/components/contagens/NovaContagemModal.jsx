import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Loader2, Package } from 'lucide-react';

export default function NovaContagemModal({ open, onClose, lojas, produtos, categorias, onSubmit, loading }) {
  const [lojaId, setLojaId] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [grupo, setGrupo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [busca, setBusca] = useState('');
  const [catFiltro, setCatFiltro] = useState('all');
  const [selecionados, setSelecionados] = useState([]);

  const produtosFiltrados = useMemo(() => {
    let list = produtos.filter(p => p.status === 'ativo');
    if (catFiltro && catFiltro !== 'all') {
      list = list.filter(p => p.categoria_id === catFiltro);
    }
    if (busca.length >= 2) {
      const q = busca.toLowerCase();
      list = list.filter(p => p.nome?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q));
    }
    return list;
  }, [produtos, catFiltro, busca]);

  const toggleProduto = (id) => {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selecionarTodos = () => {
    const ids = produtosFiltrados.map(p => p.id);
    setSelecionados(prev => {
      const novos = ids.filter(id => !prev.includes(id));
      return novos.length > 0 ? [...prev, ...novos] : prev.filter(id => !ids.includes(id));
    });
  };

  const handleSubmit = () => {
    if (!lojaId || !responsavel || selecionados.length === 0) return;
    onSubmit({ loja_id: lojaId, responsavel_nome: responsavel, grupo, observacoes, produto_ids: selecionados });
  };

  const todosVisiveis = produtosFiltrados.length > 0 && produtosFiltrados.every(p => selecionados.includes(p.id));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Contagem de Estoque</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Loja / CD *</Label>
              <Select value={lojaId || '__none__'} onValueChange={v => setLojaId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione...</SelectItem>
                  {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável *</Label>
              <Input placeholder="Nome de quem vai contar" value={responsavel} onChange={e => setResponsavel(e.target.value)} />
            </div>
            <div>
              <Label>Grupo / Setor</Label>
              <Input placeholder="Ex: Insumos, Embalagens" value={grupo} onChange={e => setGrupo(e.target.value)} />
            </div>
            <div>
              <Label>Observações</Label>
              <Input placeholder="Notas opcionais" value={observacoes} onChange={e => setObservacoes(e.target.value)} />
            </div>
          </div>

          {/* Seleção de produtos */}
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Produtos para contar ({selecionados.length} selecionados)</Label>
              <Button type="button" variant="ghost" size="sm" onClick={selecionarTodos}>
                {todosVisiveis ? 'Desmarcar visíveis' : 'Selecionar visíveis'}
              </Button>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                <Input className="pl-8" placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} />
              </div>
              <Select value={catFiltro} onValueChange={setCatFiltro}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1">
              {produtosFiltrados.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-6">Nenhum produto encontrado</p>
              )}
              {produtosFiltrados.map(p => (
                <label key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                  <Checkbox checked={selecionados.includes(p.id)} onCheckedChange={() => toggleProduto(p.id)} />
                  <Package className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm flex-1">{p.nome}</span>
                  <span className="text-xs text-slate-400">{p.unidade_medida || 'un'}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || !lojaId || !responsavel || selecionados.length === 0}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...</> : `Criar Contagem (${selecionados.length} itens)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}