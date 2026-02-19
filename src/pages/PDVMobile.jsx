/**
 * PDV MOBILE — CD → Lojas
 * Interface mobile-first para criação rápida de pedidos internos.
 * Reutiliza 100% a lógica do B12 (pedidoInternoService, estoqueService, bancoVirtual).
 * Objetivo: pedido criado e confirmado em < 30 segundos.
 */
import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { confirmarPedidoInterno } from '@/components/services/pedidoInternoService';
import { getEmpresaAtiva } from '@/components/services/tenantService';
import { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ImprimirPedidoModal from '@/components/pdv/ImprimirPedidoModal';
import {
  Store, Search, Plus, Minus, Trash2, CheckCircle2,
  ChevronDown, Package, ShoppingBag, ArrowLeft, Loader2, Printer
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';

export default function PDVMobile() {
  const qc = useQueryClient();
  const searchRef = useRef(null);
  const lojaRef = useRef(null);
  const produtoRef = useRef(null);

  const [lojaDestinoId, setLojaDestinoId] = useState('');
  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState([]);          // { produto_id, produto_nome, quantidade, preco_unitario, subtotal }
  const [confirmando, setConfirmando] = useState(false);
  const [sucesso, setSucesso] = useState(null);    // pedido confirmado { id, loja, cd, total, itens, itensData }
  const [mostrarLojas, setMostrarLojas] = useState(false);
  const [modalImprimir, setModalImprimir] = useState(false);
  // Flag de idempotência: impede criar novo pedido se já há um em confirmação
  const confirmandoRef = useRef(false);

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list('nome'),
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos-ativos'],
    queryFn: () => base44.entities.Produto.filter({ status: 'ativo' }, 'nome', 500),
  });

  const cd = lojas.find(l => l.tipo === 'cd');
  const lojasDestino = lojas.filter(l => l.tipo === 'loja');
  const lojaDestino = lojasDestino.find(l => l.id === lojaDestinoId);

  // Foca busca ao montar
  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 300);
  }, []);

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (lojaRef.current && !lojaRef.current.contains(e.target)) {
        setMostrarLojas(false);
      }
      if (produtoRef.current && !produtoRef.current.contains(e.target)) {
        setBusca('');
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMostrarLojas(false);
        setBusca('');
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Produtos filtrados pela busca
  const produtosFiltrados = busca.trim().length >= 1
    ? produtos.filter(p =>
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (p.codigo || '').toLowerCase().includes(busca.toLowerCase())
      ).slice(0, 8)
    : [];

  const addItem = (produto) => {
    setBusca('');
    searchRef.current?.focus();
    setItens(prev => {
      const exist = prev.find(i => i.produto_id === produto.id);
      if (exist) {
        return prev.map(i => i.produto_id === produto.id
          ? { ...i, quantidade: i.quantidade + 1, subtotal: (i.quantidade + 1) * i.preco_unitario }
          : i
        );
      }
      const preco = produto.custo_medio || 0;
      return [...prev, {
        produto_id: produto.id,
        produto_nome: produto.nome,
        quantidade: 1,
        preco_unitario: preco,
        subtotal: preco,
      }];
    });
  };

  const updateQtd = (produto_id, delta) => {
    setItens(prev => prev
      .map(i => i.produto_id === produto_id
        ? { ...i, quantidade: Math.max(0, i.quantidade + delta), subtotal: Math.max(0, i.quantidade + delta) * i.preco_unitario }
        : i
      )
      .filter(i => i.quantidade > 0)
    );
  };

  const setQtdManual = (produto_id, val) => {
    const qtd = parseFloat(val) || 0;
    setItens(prev => prev
      .map(i => i.produto_id === produto_id
        ? { ...i, quantidade: qtd, subtotal: qtd * i.preco_unitario }
        : i
      )
      .filter(i => i.quantidade > 0)
    );
  };

  const removerItem = (produto_id) => {
    setItens(prev => prev.filter(i => i.produto_id !== produto_id));
  };

  const totalPedido = itens.reduce((s, i) => s + (i.subtotal || 0), 0);
  const totalItens = itens.reduce((s, i) => s + i.quantidade, 0);

  const handleConfirmar = async () => {
    // Anti-duplo-clique: impede re-submission enquanto estiver confirmando
    if (confirmandoRef.current) return;
    if (!lojaDestinoId) { toast.error('Selecione a loja destino.'); return; }
    if (!cd) { toast.error('Nenhum CD cadastrado.'); return; }
    if (itens.length === 0) { toast.error('Adicione pelo menos um item.'); return; }

    // Captura dados ANTES de qualquer await para uso posterior
    const itensCapturados = [...itens];
    const totalCapturado = totalPedido;
    const lojaDestinoCapturada = lojaDestino;
    const lojaDestinoIdCapturado = lojaDestinoId;

    confirmandoRef.current = true;
    setConfirmando(true);

    // Limpa carrinho IMEDIATAMENTE para feedback visual instantâneo
    setItens([]);
    setLojaDestinoId('');
    setBusca('');

    try {
      const empresa = await getEmpresaAtiva();
      const user = await base44.auth.me().catch(() => null);
      const hoje = format(new Date(), 'yyyy-MM-dd');

      // Cria rascunho
      const pedidoRascunho = await base44.entities.PedidoInterno.create({
        empresa_id: empresa.id,
        cd_id: cd.id,
        loja_destino_id: lojaDestinoIdCapturado,
        data: hoje,
        itens: itensCapturados,
        total_itens: itensCapturados.length,
        valor_total: totalCapturado,
        status: 'draft',
      });

      // Confirma imediatamente (reutiliza serviço B12 — idempotente por status)
      await confirmarPedidoInterno(pedidoRascunho, lojas, user);

      // Invalida caches
      qc.invalidateQueries({ queryKey: ['pedidos-internos'] });
      qc.invalidateQueries({ queryKey: ['lojas'] });
      qc.invalidateQueries({ queryKey: ['banco-virtual'] });
      qc.invalidateQueries({ queryKey: ['movimentacoes-estoque'] });

      setSucesso({
        id: pedidoRascunho.id,
        loja: lojaDestinoCapturada?.nome,
        lojaDestino: lojaDestinoCapturada?.nome,
        cd: cd?.nome,
        total: totalCapturado,
        itens: itensCapturados.length,
        itensData: itensCapturados,
      });
    } catch (e) {
      // Se falhou, devolve o carrinho para o usuário
      setItens(itensCapturados);
      setLojaDestinoId(lojaDestinoIdCapturado);
      toast.error(e.message || 'Erro ao confirmar pedido.');
    } finally {
      setConfirmando(false);
      confirmandoRef.current = false;
    }
  };

  const resetar = () => {
    setSucesso(null);
    setItens([]);
    setBusca('');
    setLojaDestinoId('');
    setTimeout(() => searchRef.current?.focus(), 200);
  };

  // Tela de sucesso
  if (sucesso) {
    const pedidoParaImprimir = {
      id: sucesso.id,
      cd: sucesso.cd,
      lojaDestino: sucesso.lojaDestino,
      total: sucesso.total,
      itens: sucesso.itensData || [],
    };

    return (
      <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6 gap-6">
        <ImprimirPedidoModal
          open={modalImprimir}
          onClose={() => setModalImprimir(false)}
          pedido={pedidoParaImprimir}
        />

        <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
          <CheckCircle2 className="w-12 h-12 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-emerald-800">Pedido Confirmado!</h1>
          <p className="text-emerald-600 mt-1">{sucesso.cd} → {sucesso.loja}</p>
          <p className="text-xs text-emerald-500 font-mono mt-1">Ref: #{sucesso.id?.slice(-6).toUpperCase()}</p>
          <p className="text-3xl font-bold text-emerald-700 mt-3">{formatMoney(sucesso.total)}</p>
          <p className="text-sm text-emerald-500">{sucesso.itens} item(ns) — estoque e banco virtual atualizados</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button
            onClick={() => setModalImprimir(true)}
            variant="outline"
            className="h-12 border-emerald-300 text-emerald-700 hover:bg-emerald-100 gap-2"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
          <Button onClick={resetar} className="bg-emerald-600 hover:bg-emerald-700 h-14 text-base font-semibold gap-2">
            <Plus className="w-5 h-5" /> Novo Pedido
          </Button>
          <Button variant="outline" onClick={() => window.location.href = createPageUrl('PedidosInternos')} className="h-12 gap-2">
            <ArrowLeft className="w-4 h-4" /> Ver pedido no CD → Lojas
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col w-full">
      {/* TOPO FIXO */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <button
            className="p-1 rounded-lg hover:bg-slate-100"
            onClick={() => window.location.href = createPageUrl('PedidosInternos')}
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <ShoppingBag className="w-5 h-5 text-indigo-500" />
          <span className="font-semibold text-slate-800">PDV CD → Loja</span>
          {cd && <span className="ml-auto text-xs text-slate-400 truncate max-w-[100px]">{cd.nome}</span>}
        </div>

        {/* Seletor de loja destino */}
        <div className="px-4 py-3" ref={lojaRef}>
          <button
            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${
              lojaDestinoId ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50'
            }`}
            onClick={() => setMostrarLojas(!mostrarLojas)}
          >
            <Store className={`w-6 h-6 flex-shrink-0 ${lojaDestinoId ? 'text-indigo-500' : 'text-slate-400'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500">Loja destino</p>
              <p className={`font-semibold truncate ${lojaDestinoId ? 'text-indigo-700' : 'text-slate-400'}`}>
                {lojaDestino?.nome || 'Selecionar loja...'}
              </p>
            </div>
            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${mostrarLojas ? 'rotate-180' : ''}`} />
          </button>

          {mostrarLojas && (
            <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden shadow-lg bg-white">
              {lojasDestino.map(l => (
                <button
                  key={l.id}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left border-b last:border-0 transition-colors ${
                    l.id === lojaDestinoId ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => { setLojaDestinoId(l.id); setMostrarLojas(false); searchRef.current?.focus(); }}
                >
                  <Store className="w-5 h-5 text-teal-500" />
                  <span className="font-medium">{l.nome}</span>
                </button>
              ))}
              {lojasDestino.length === 0 && (
                <p className="px-4 py-3 text-sm text-slate-400">Nenhuma loja cadastrada</p>
              )}
            </div>
          )}
        </div>

        {/* Busca de produto */}
        <div className="px-4 pb-3 relative" ref={produtoRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              ref={searchRef}
              type="search"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-base focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              autoComplete="off"
            />
          </div>

          {/* Dropdown de resultados */}
          {produtosFiltrados.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-y-auto max-h-72 md:max-h-96">
              {produtosFiltrados.map(p => (
                <button
                  key={p.id}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-b last:border-0 active:bg-indigo-50 hover:bg-slate-50 transition-colors"
                  onMouseDown={(e) => { e.preventDefault(); addItem(p); }}
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{p.nome}</p>
                    <p className="text-xs text-slate-400">{p.codigo || 'sem código'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600">{formatMoney(p.custo_medio || 0)}</p>
                    <Plus className="w-4 h-4 text-indigo-400 ml-auto mt-0.5" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ÁREA CENTRAL — Lista de itens */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-48 md:pb-40">
        {itens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <Package className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-400 font-medium">Nenhum item adicionado</p>
            <p className="text-sm text-slate-300">Use a busca acima para adicionar produtos</p>
          </div>
        ) : (
          itens.map(item => (
            <div
              key={item.produto_id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className="font-semibold text-slate-800 text-base leading-tight flex-1">{item.produto_nome}</p>
                <button
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors"
                  onClick={() => removerItem(item.produto_id)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                {/* Stepper */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                  <button
                    className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center active:scale-95 transition-transform"
                    onClick={() => updateQtd(item.produto_id, -1)}
                  >
                    <Minus className="w-4 h-4 text-slate-600" />
                  </button>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={item.quantidade}
                    onChange={e => setQtdManual(item.produto_id, e.target.value)}
                    className="w-14 text-center font-bold text-lg bg-transparent border-none outline-none"
                  />
                  <button
                    className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center active:scale-95 transition-transform"
                    onClick={() => updateQtd(item.produto_id, 1)}
                  >
                    <Plus className="w-4 h-4 text-slate-600" />
                  </button>
                </div>

                {/* Preço e subtotal */}
                <div className="text-right">
                  <p className="text-xs text-slate-400">{formatMoney(item.preco_unitario)} / un</p>
                  <p className="text-lg font-bold text-emerald-600">{formatMoney(item.subtotal)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* RODAPÉ FIXO */}
      <div className="fixed bottom-0 left-0 right-0 w-full lg:max-w-lg lg:mx-auto bg-white border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] px-4 py-4 z-40">
        {/* Total */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-slate-500">Total do pedido</p>
            <p className="text-2xl font-bold text-slate-800">{formatMoney(totalPedido)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">{itens.length} produto(s)</p>
            <p className="text-sm font-medium text-slate-500">{totalItens} un</p>
          </div>
        </div>

        {/* Botão confirmar */}
        <button
          onClick={handleConfirmar}
          disabled={confirmando || itens.length === 0 || !lojaDestinoId}
          className={`w-full h-14 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
            itens.length > 0 && lojaDestinoId && !confirmando
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-600'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {confirmando ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Confirmando...</>
          ) : (
            <><CheckCircle2 className="w-6 h-6" /> CONFIRMAR PEDIDO</>
          )}
        </button>

        {(!lojaDestinoId || itens.length === 0) && (
          <p className="text-center text-xs text-slate-400 mt-2">
            {!lojaDestinoId ? 'Selecione a loja destino' : 'Adicione pelo menos um produto'}
          </p>
        )}
      </div>
    </div>
  );
}