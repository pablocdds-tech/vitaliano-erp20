import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import MoneyDisplay, { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import EmptyState from '@/components/ui-custom/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FileText, Plus, Upload, Eye, CheckCircle2, Bot, Building2,
  Loader2, Sparkles, Trash2, Search, PackagePlus, Warehouse, ShoppingCart,
  Store
} from 'lucide-react';
import ImportarNFModal from '@/components/nf/ImportarNFModal';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { processarEntrada } from '@/components/services/estoqueService';
import { criarContasPagarNF } from '@/components/services/financeiroService';
import { getEmpresaAtiva } from '@/components/services/tenantService';

const UNIDADES = ['un', 'kg', 'g', 'l', 'ml', 'cx', 'pc', 'fd'];

// ─── Modal de novo produto inline ────────────────────────────────────────────
function NovoProdutoModal({ open, onClose, categorias, onSave }) {
  const [form, setForm] = useState({ nome: '', categoria_id: '', unidade_medida: 'un', tipo: 'insumo' });
  const queryClient = useQueryClient();

  const mut = useMutation({
    mutationFn: () => base44.entities.Produto.create({ ...form }),
    onSuccess: (prod) => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast.success('Produto criado!');
      onSave(prod);
      onClose();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Novo Produto</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Nome do produto" />
          </div>
          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select value={form.categoria_id || '__none__'} onValueChange={v => setForm({ ...form, categoria_id: v === '__none__' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhuma —</SelectItem>
                {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Unidade</Label>
              <Select value={form.unidade_medida} onValueChange={v => setForm({ ...form, unidade_medida: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="insumo">Insumo</SelectItem>
                  <SelectItem value="produto_final">Produto Final</SelectItem>
                  <SelectItem value="embalagem">Embalagem</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!form.nome || mut.isPending} onClick={() => mut.mutate()}>Criar Produto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Linha de item ─────────────────────────────────────────────────────────
function ItemRow({ item, idx, produtos, onUpdate, onRemove, onAddProduto }) {
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const produtoSelecionado = produtos.find(p => p.id === item.produto_id);
  const filteredProds = search.length >= 2
    ? produtos.filter(p => p.nome.toLowerCase().includes(search.toLowerCase()) || (p.codigo || '').toLowerCase().includes(search.toLowerCase()))
    : [];

  const selectProd = (p) => {
    onUpdate(idx, { produto_id: p.id, descricao_nf: p.nome, custo_unitario: p.custo_medio || 0, subtotal: item.quantidade * (p.custo_medio || 0) });
    setShowSearch(false);
    setSearch('');
  };

  const update = (field, value) => {
    const updated = { ...item, [field]: value };
    if (field === 'quantidade' || field === 'custo_unitario') {
      updated.subtotal = (parseFloat(updated.quantidade) || 0) * (parseFloat(updated.custo_unitario) || 0);
    }
    onUpdate(idx, updated);
  };

  return (
    <div className="grid grid-cols-12 gap-2 items-start border-b pb-3 last:border-0">
      <div className="col-span-5 space-y-1 relative">
        {produtoSelecionado ? (
          <div className="flex items-center gap-2 p-2 border rounded-md bg-slate-50 dark:bg-slate-800">
            <span className="text-sm flex-1 truncate">{produtoSelecionado.nome}</span>
            <button type="button" className="text-slate-400 hover:text-red-500 text-xs" onClick={() => onUpdate(idx, { produto_id: '', descricao_nf: '' })}>✕</button>
          </div>
        ) : (
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <Input className="pl-7 text-xs h-8" placeholder="Buscar produto..." value={search} onChange={e => { setSearch(e.target.value); setShowSearch(true); }} onFocus={() => setShowSearch(true)} />
            </div>
            {showSearch && search.length >= 2 && (
              <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {filteredProds.map(p => (
                  <button key={p.id} type="button" className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs" onClick={() => selectProd(p)}>
                    <span className="font-medium">{p.nome}</span>
                    {p.codigo && <span className="ml-2 text-slate-400">{p.codigo}</span>}
                  </button>
                ))}
                <button type="button" className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-xs text-indigo-600 font-medium flex items-center gap-2 border-t" onClick={() => { onAddProduto(idx); setShowSearch(false); setSearch(''); }}>
                  <PackagePlus className="w-3.5 h-3.5" /> Criar novo produto
                </button>
              </div>
            )}
          </div>
        )}
        <Input className="text-xs h-7" placeholder="Descrição na NF" value={item.descricao_nf || ''} onChange={e => update('descricao_nf', e.target.value)} />
      </div>
      <div className="col-span-2">
        <Input type="number" className="text-xs h-8" value={item.quantidade} min="0.001" step="0.001" onChange={e => update('quantidade', parseFloat(e.target.value) || 0)} />
      </div>
      <div className="col-span-2">
        <Input type="number" className="text-xs h-8" value={item.custo_unitario} min="0" step="0.01" onChange={e => update('custo_unitario', parseFloat(e.target.value) || 0)} />
      </div>
      <div className="col-span-2 flex items-center">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatMoney(item.subtotal || 0)}</span>
      </div>
      <div className="col-span-1 flex items-center">
        <button type="button" onClick={() => onRemove(idx)} className="text-red-400 hover:text-red-600">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Seletor de Tipo de Lançamento ────────────────────────────────────────
function TipoLancamentoSelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onChange('compra_cd')}
        className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
          value === 'compra_cd'
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
        }`}
      >
        <Warehouse className={`w-6 h-6 mt-0.5 shrink-0 ${value === 'compra_cd' ? 'text-indigo-600' : 'text-slate-400'}`} />
        <div>
          <p className={`font-semibold text-sm ${value === 'compra_cd' ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
            Compra para CD
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Gera entrada de estoque no CD + Conta a Pagar</p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onChange('compra_direta_loja')}
        className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
          value === 'compra_direta_loja'
            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
        }`}
      >
        <ShoppingCart className={`w-6 h-6 mt-0.5 shrink-0 ${value === 'compra_direta_loja' ? 'text-amber-600' : 'text-slate-400'}`} />
        <div>
          <p className={`font-semibold text-sm ${value === 'compra_direta_loja' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-700 dark:text-slate-300'}`}>
            Compra Direta Loja
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Financeiro/DRE apenas — SEM estoque no CD</p>
        </div>
      </button>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────
export default function NotasFiscais() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [importarModalOpen, setImportarModalOpen] = useState(false);
  const [viewModal, setViewModal] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [novoProdutoForIdx, setNovoProdutoForIdx] = useState(null);
  const [lancando, setLancando] = useState(false);
  // Filtros
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroLoja, setFiltroLoja] = useState('todas');

  const emptyForm = {
    tipo_lancamento: 'compra_cd',
    loja_id: '',             // para CD: é o CD; para direta: loja responsável
    loja_responsavel_id: '', // sempre = loja que gerou a despesa
    faturado_para_id: '',    // loja/entidade faturada (opcional — ID)
    faturado_para_nome: '',  // nome livre caso não seja loja cadastrada
    categoria_dre_id: '',
    fornecedor_id: '',
    numero: '', serie: '1',
    data_emissao: format(new Date(), 'yyyy-MM-dd'),
    data_entrada: format(new Date(), 'yyyy-MM-dd'),
    valor_total: 0, chave_acesso: '',
    itens: [],
    num_parcelas: 1,
    primeiro_vencimento: format(new Date(), 'yyyy-MM-dd'),
    forma_pagamento: 'boleto',
    documento_tipo: 'nota_fiscal',
    lancado_no_pdv: false,
    observacoes: '',
  };
  const [formData, setFormData] = useState(emptyForm);

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ['notas-fiscais'],
    queryFn: () => base44.entities.NotaFiscal.list('-created_date', 100)
  });
  const { data: lojas = [] } = useQuery({ queryKey: ['lojas'], queryFn: () => base44.entities.Loja.list() });
  const { data: fornecedores = [] } = useQuery({ queryKey: ['fornecedores'], queryFn: () => base44.entities.Fornecedor.list() });
  const { data: produtos = [] } = useQuery({ queryKey: ['produtos'], queryFn: () => base44.entities.Produto.list() });
  const { data: categorias = [] } = useQuery({ queryKey: ['categorias'], queryFn: () => base44.entities.Categoria.list() });
  const { data: categoriasDRE = [] } = useQuery({ queryKey: ['categorias-dre'], queryFn: () => base44.entities.CategoriaDRE.list() });

  const cd = lojas.find(l => l.tipo === 'cd');
  const lojasLojas = lojas.filter(l => l.tipo !== 'cd');

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const empresa = await getEmpresaAtiva();
      const total = data.itens?.length > 0
        ? data.itens.reduce((s, i) => s + (i.subtotal || 0), 0)
        : data.valor_total;
      // loja_id armazenada: para CD = CD, para direta = loja_responsavel_id
      const lojaIdFinal = data.tipo_lancamento === 'compra_cd'
        ? (data.loja_id || cd?.id)
        : data.loja_responsavel_id;
      return base44.entities.NotaFiscal.create({
        ...data,
        empresa_id: empresa.id,
        loja_id: lojaIdFinal,
        valor_total: total,
        status: 'pendente',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] });
      setModalOpen(false);
      setFormData(emptyForm);
      toast.success('NF cadastrada! Clique em "Lançar" para processar.');
    },
    onError: (e) => toast.error('Erro ao cadastrar: ' + e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.NotaFiscal.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] }),
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  // ── Upload XML / IA ──────────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUploading(false);
    setProcessing(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Extraia os dados desta nota fiscal XML/PDF e retorne JSON estruturado.`,
      response_json_schema: {
        type: 'object',
        properties: {
          numero: { type: 'string' }, serie: { type: 'string' },
          data_emissao: { type: 'string' }, fornecedor_cnpj: { type: 'string' },
          fornecedor_nome: { type: 'string' }, valor_total: { type: 'number' },
          chave_acesso: { type: 'string' },
          itens: { type: 'array', items: { type: 'object', properties: {
            descricao: { type: 'string' }, quantidade: { type: 'number' },
            valor_unitario: { type: 'number' }, valor_total: { type: 'number' }
          }}}
        }
      },
      file_urls: [file_url],
    });
    setProcessing(false);
    if (result) {
      setFormData(prev => ({
        ...prev, numero: result.numero || '', serie: result.serie || '',
        data_emissao: result.data_emissao || '', data_entrada: format(new Date(), 'yyyy-MM-dd'),
        valor_total: result.valor_total || 0, chave_acesso: result.chave_acesso || '',
        itens: (result.itens || []).map(i => ({
          produto_id: '', descricao_nf: i.descricao || '',
          quantidade: i.quantidade || 1, custo_unitario: i.valor_unitario || 0,
          subtotal: i.valor_total || 0,
        })),
      }));
      toast.success('Nota processada pela IA! Vincule os produtos e escolha o tipo de lançamento.');
    }
  };

  // ── Lançar NF ────────────────────────────────────────────────────────────
  const handleLancar = async (nota) => {
    if (nota.status === 'lancada') { toast.info('Esta nota já foi lançada.'); return; }
    if (lancando) return;
    setLancando(true);
    try {
      const empresa = await getEmpresaAtiva();
      await updateMutation.mutateAsync({ id: nota.id, data: { status: 'lancada' } });

      const tipoLancamento = nota.tipo_lancamento || 'compra_cd';

      // Fluxo A: Compra CD → gera estoque no CD
      if (tipoLancamento === 'compra_cd' && nota.itens?.length > 0) {
        const lojaEstoque = nota.loja_id; // deve ser o CD
        for (const item of nota.itens) {
          if (!item.produto_id || !item.quantidade) continue;
          await processarEntrada({
            empresa_id: empresa.id,
            loja_id: lojaEstoque,
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            custo_unitario: item.custo_unitario || 0,
            documento_tipo: 'nota_fiscal',
            documento_id: nota.id,
            observacao: `Entrada via NF ${nota.numero}/${nota.serie || '1'}`,
          });
        }
      }
      // Fluxo B: Compra Direta Loja → NÃO gera estoque

      // Ambos os fluxos: gera Conta(s) a Pagar
      await criarContasPagarNF({
        empresa_id: empresa.id,
        loja_id: nota.loja_id,
        fornecedor_id: nota.fornecedor_id,
        nota,
      });

      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      queryClient.invalidateQueries({ queryKey: ['estoque'] });

      const msg = tipoLancamento === 'compra_cd'
        ? 'NF lançada! Estoque do CD e conta a pagar atualizados.'
        : 'NF lançada! Conta a pagar gerada. Nenhum estoque movimentado no CD.';
      toast.success(msg);
    } catch (err) {
      toast.error('Erro ao lançar: ' + err.message);
    } finally {
      setLancando(false);
    }
  };

  const handleConferir = async (nota) => {
    if (nota.status !== 'pendente') { toast.info('Esta nota já foi conferida.'); return; }
    await updateMutation.mutateAsync({ id: nota.id, data: { status: 'conferida' } });
    toast.success('Nota conferida!');
  };

  const addItem = () => setFormData(prev => ({ ...prev, itens: [...prev.itens, { produto_id: '', descricao_nf: '', quantidade: 1, custo_unitario: 0, subtotal: 0 }] }));

  const updateItem = (idx, patch) => {
    setFormData(prev => {
      const itens = prev.itens.map((it, i) => i === idx ? { ...it, ...patch } : it);
      return { ...prev, itens, valor_total: itens.reduce((s, i) => s + (i.subtotal || 0), 0) };
    });
  };

  const removeItem = (idx) => {
    setFormData(prev => {
      const itens = prev.itens.filter((_, i) => i !== idx);
      return { ...prev, itens, valor_total: itens.reduce((s, i) => s + (i.subtotal || 0), 0) };
    });
  };

  const handleNovoProdutoSalvo = (prod) => {
    if (novoProdutoForIdx !== null) {
      updateItem(novoProdutoForIdx, { produto_id: prod.id, descricao_nf: prod.nome, custo_unitario: 0, subtotal: 0 });
      setNovoProdutoForIdx(null);
    }
  };

  const getLoja = (id) => lojas.find(l => l.id === id);
  const getFornecedor = (id) => fornecedores.find(f => f.id === id);

  // Validação do formulário
  const canSubmit = () => {
    if (!formData.numero) return false;
    if (formData.tipo_lancamento === 'compra_cd') {
      return !!formData.loja_id;
    }
    // compra_direta_loja
    return !!(formData.loja_responsavel_id && formData.categoria_dre_id && formData.primeiro_vencimento);
  };

  // Filtros aplicados
  const notasFiltradas = notas.filter(n => {
    const okTipo = filtroTipo === 'todos' || n.tipo_lancamento === filtroTipo || (!n.tipo_lancamento && filtroTipo === 'compra_cd');
    const okLoja = filtroLoja === 'todas' || n.loja_id === filtroLoja || n.loja_responsavel_id === filtroLoja;
    return okTipo && okLoja;
  });

  // ── Colunas ───────────────────────────────────────────────────────────────
  const columns = [
    {
      key: 'numero', label: 'NF', sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${row.tipo_lancamento === 'compra_direta_loja' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
            <FileText className={`w-4 h-4 ${row.tipo_lancamento === 'compra_direta_loja' ? 'text-amber-600' : 'text-blue-600'}`} />
          </div>
          <div>
            <p className="font-medium text-slate-800 dark:text-white">{value || '(manual)'}</p>
            <p className="text-xs text-slate-500">Série {row.serie || '1'}</p>
          </div>
        </div>
      )
    },
    {
      key: 'tipo_lancamento', label: 'Tipo',
      render: (v) => {
        const isLoja = v === 'compra_direta_loja';
        return (
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${isLoja ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'}`}>
            {isLoja ? <ShoppingCart className="w-3 h-3" /> : <Warehouse className="w-3 h-3" />}
            {isLoja ? 'Loja Direta' : 'CD'}
          </span>
        );
      }
    },
    {
      key: 'fornecedor_id', label: 'Fornecedor',
      render: (value, row) => {
        const f = getFornecedor(value);
        const nome = f ? (f.nome_fantasia || f.razao_social) : (row.faturado_para_nome || '—');
        return <div className="flex items-center gap-2 text-sm"><Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{nome}</span></div>;
      }
    },
    {
      key: 'loja_id', label: 'Loja Responsável',
      render: (v, row) => {
        const loja = getLoja(row.loja_responsavel_id || v);
        return loja ? <div className="flex items-center gap-1.5 text-sm"><Store className="w-3.5 h-3.5 text-slate-400" />{loja.nome}</div> : <span className="text-slate-400">—</span>;
      }
    },
    {
      key: 'faturado_para_nome', label: 'Faturado para',
      render: (v, row) => {
        const loja = getLoja(row.faturado_para_id);
        return <span className="text-sm text-slate-600">{loja?.nome || v || '—'}</span>;
      }
    },
    { key: 'data_entrada', label: 'Entrada', sortable: true, render: (v) => v ? format(new Date(v + 'T12:00:00'), 'dd/MM/yy') : '-' },
    { key: 'valor_total', label: 'Total', sortable: true, render: (v) => <MoneyDisplay value={v || 0} size="sm" /> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notas Fiscais / Compras"
        subtitle="Compras CD (estoque) e Compras Diretas Loja (financeiro)"
        icon={FileText}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Notas Fiscais' }]}
        actions={
          <Button onClick={() => { setFormData(emptyForm); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nova NF
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pendentes', color: 'amber', status: 'pendente' },
          { label: 'Conferidas', color: 'blue', status: 'conferida' },
          { label: 'Lançadas', color: 'emerald', status: 'lancada' },
        ].map(({ label, color, status }) => (
          <Card key={status} className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className={`text-2xl font-bold text-${color}-600`}>{notas.filter(n => n.status === status).length}</p>
              </div>
              <div className={`p-2 rounded-lg bg-${color}-100 dark:bg-${color}-900/30`}>
                <FileText className={`w-5 h-5 text-${color}-600`} />
              </div>
            </CardContent>
          </Card>
        ))}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Compra Direta Loja</p>
              <p className="text-2xl font-bold text-amber-600">{notas.filter(n => n.tipo_lancamento === 'compra_direta_loja').length}</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30"><ShoppingCart className="w-5 h-5 text-amber-600" /></div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-slate-500 whitespace-nowrap">Tipo:</Label>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="compra_cd">CD (com estoque)</SelectItem>
              <SelectItem value="compra_direta_loja">Loja Direta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-slate-500 whitespace-nowrap">Loja:</Label>
          <Select value={filtroLoja} onValueChange={setFiltroLoja}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {(filtroTipo !== 'todos' || filtroLoja !== 'todas') && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFiltroTipo('todos'); setFiltroLoja('todas'); }}>Limpar filtros</Button>
        )}
      </div>

      {notas.length === 0 && !isLoading ? (
        <EmptyState icon={FileText} title="Nenhuma nota fiscal" description="Cadastre manualmente ou importe XMLs." actionLabel="Nova NF" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable
          columns={columns} data={notasFiltradas} loading={isLoading}
          searchPlaceholder="Buscar notas..." emptyIcon={FileText} emptyTitle="Nenhuma nota"
          onRowClick={(row) => setViewModal(row)}
          rowActions={(row) => [
            { label: 'Visualizar', icon: Eye, onClick: () => setViewModal(row) },
            ...(row.status === 'pendente' ? [{ label: 'Conferir', icon: CheckCircle2, onClick: () => handleConferir(row) }] : []),
            ...(row.status === 'conferida' ? [{ label: lancando ? 'Lançando...' : 'Lançar no Sistema', icon: CheckCircle2, onClick: () => handleLancar(row), disabled: lancando }] : []),
          ]}
        />
      )}

      {/* ── Modal de Cadastro ─────────────────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={(v) => { setModalOpen(v); if (!v) setFormData(emptyForm); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Nota Fiscal / Compra</DialogTitle>
          </DialogHeader>

          <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
            {/* Tipo de Lançamento */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Tipo de Lançamento *</Label>
              <TipoLancamentoSelector
                value={formData.tipo_lancamento}
                onChange={v => setFormData({ ...formData, tipo_lancamento: v })}
              />
            </div>

            {/* Importar NF por imagem/PDF via Gemini */}
            <button
              type="button"
              onClick={() => setImportarModalOpen(true)}
              className="w-full border-2 border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50/50 dark:border-indigo-700 dark:hover:bg-indigo-900/20 rounded-xl p-4 flex items-center gap-3 transition-all"
            >
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 shrink-0">
                <Upload className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-sm text-slate-800 dark:text-white">Importar Nota Fiscal</p>
                <p className="text-xs text-slate-500">Envie uma imagem ou PDF — os dados serão extraídos e preenchidos automaticamente</p>
              </div>
            </button>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t border-slate-200" />
              <span className="text-xs text-slate-400 uppercase">ou preencha manualmente</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            {/* ── FLUXO A: Compra CD ── */}
            {formData.tipo_lancamento === 'compra_cd' && (
              <div className="space-y-4">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg p-3 text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                  <Warehouse className="w-4 h-4 shrink-0" />
                  <span>Esta compra gerará <strong>entrada de estoque no CD</strong> e uma Conta a Pagar.</span>
                </div>
              </div>
            )}

            {/* ── FLUXO B: Compra Direta Loja ── */}
            {formData.tipo_lancamento === 'compra_direta_loja' && (
              <div className="space-y-4">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 shrink-0" />
                  <span>Compra direta da loja. <strong>Nenhum estoque será movimentado no CD.</strong> Gera AP + DRE/CMV para a loja.</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Loja Responsável *</Label>
                    <Select value={formData.loja_responsavel_id || '__none__'} onValueChange={v => setFormData({ ...formData, loja_responsavel_id: v === '__none__' ? '' : v })}>
                      <SelectTrigger><SelectValue placeholder="Qual loja fez a compra?" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Selecione...</SelectItem>
                        {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Faturado para *</Label>
                    <Input value={formData.faturado_para_nome} onChange={e => setFormData({ ...formData, faturado_para_nome: e.target.value })} placeholder="NB / Praça / Pablo PF..." />
                  </div>
                  <div className="space-y-1">
                    <Label>Categoria DRE/CMV *</Label>
                    <Select value={formData.categoria_dre_id || '__none__'} onValueChange={v => setFormData({ ...formData, categoria_dre_id: v === '__none__' ? '' : v })}>
                      <SelectTrigger><SelectValue placeholder="CMV > Compra Direta..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Selecione...</SelectItem>
                        {categoriasDRE.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 flex flex-col justify-end">
                    <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-white dark:bg-slate-900 cursor-pointer" onClick={() => setFormData(p => ({ ...p, lancado_no_pdv: !p.lancado_no_pdv }))}>
                      <input type="checkbox" checked={formData.lancado_no_pdv} readOnly className="w-4 h-4" />
                      <label className="text-sm cursor-pointer">Lançado no PDV da loja</label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dados comuns */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Fornecedor</Label>
                <Select value={formData.fornecedor_id || '__none__'} onValueChange={v => setFormData({ ...formData, fornecedor_id: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Nenhum —</SelectItem>
                    {fornecedores.map(f => <SelectItem key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Faturado para</Label>
                {formData.tipo_lancamento === 'compra_cd' ? (
                  <Select value={formData.faturado_para_id || '__none__'} onValueChange={v => {
                    const loja = lojas.find(l => l.id === v);
                    setFormData({ ...formData, faturado_para_id: v === '__none__' ? '' : v, faturado_para_nome: loja?.nome || '', loja_id: cd?.id || '' });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Selecione...</SelectItem>
                      {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={formData.faturado_para_nome} onChange={e => setFormData({ ...formData, faturado_para_nome: e.target.value })} placeholder="NB / Praça / Pablo PF..." />
                )}
              </div>
              <div className="space-y-1">
                <Label>Número da NF *</Label>
                <Input value={formData.numero} onChange={e => setFormData({ ...formData, numero: e.target.value })} placeholder="000001" required />
              </div>
              <div className="space-y-1">
                <Label>Série</Label>
                <Input value={formData.serie} onChange={e => setFormData({ ...formData, serie: e.target.value })} placeholder="1" />
              </div>
              <div className="space-y-1">
                <Label>Data Emissão</Label>
                <Input type="date" value={formData.data_emissao} onChange={e => setFormData({ ...formData, data_emissao: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Data Entrada</Label>
                <Input type="date" value={formData.data_entrada} onChange={e => setFormData({ ...formData, data_entrada: e.target.value })} />
              </div>
            </div>

            {/* Itens (só obrigatório para CD, opcional para direta) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  Itens da Nota
                  {formData.tipo_lancamento === 'compra_direta_loja' && <span className="ml-2 text-xs font-normal text-slate-400">(opcional — só para referência)</span>}
                </Label>
              </div>
              {formData.itens.length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
                  <p className="text-sm text-slate-400 mb-3">Nenhum item. Clique em "Adicionar Item" ou importe XML.</p>
                  <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1 mx-auto">
                    <Plus className="w-3.5 h-3.5" /> Adicionar Item
                  </Button>
                </div>
              ) : (
                <div className="border rounded-lg p-3 space-y-3">
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 uppercase pb-1 border-b">
                    <div className="col-span-5">Produto / Descrição NF</div>
                    <div className="col-span-2">Qtd</div>
                    <div className="col-span-2">Custo Unit.</div>
                    <div className="col-span-2">Subtotal</div>
                    <div className="col-span-1"></div>
                  </div>
                  {formData.itens.map((item, idx) => (
                    <ItemRow key={idx} item={item} idx={idx} produtos={produtos} onUpdate={updateItem} onRemove={removeItem} onAddProduto={(i) => setNovoProdutoForIdx(i)} />
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1">
                      <Plus className="w-3.5 h-3.5" /> Adicionar Item
                    </Button>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 uppercase">Total da NF</p>
                      <p className="text-xl font-bold">{formatMoney(formData.valor_total)}</p>
                    </div>
                  </div>
                </div>
              )}
              {/* Se não tem itens mas tem tipo direta, permite digitar valor total manualmente */}
              {formData.itens.length === 0 && (
                <div className="space-y-1">
                  <Label>Valor Total da NF (R$)</Label>
                  <Input type="number" min="0.01" step="0.01" value={formData.valor_total || ''} onChange={e => setFormData({ ...formData, valor_total: parseFloat(e.target.value) || 0 })} placeholder="0,00" />
                </div>
              )}
            </div>

            {/* Conta a Pagar */}
            <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50 space-y-3">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Conta a Pagar gerada ao Lançar</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Forma de Pagamento</Label>
                  <Select value={formData.forma_pagamento || 'boleto'} onValueChange={v => setFormData({ ...formData, forma_pagamento: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>1º Vencimento {formData.tipo_lancamento === 'compra_direta_loja' ? '*' : ''}</Label>
                  <Input type="date" value={formData.primeiro_vencimento} onChange={e => setFormData({ ...formData, primeiro_vencimento: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Número de Parcelas</Label>
                  <Input type="number" min="1" max="48" value={formData.num_parcelas} onChange={e => setFormData({ ...formData, num_parcelas: parseInt(e.target.value) || 1 })} />
                </div>
              </div>
              <p className="text-xs text-slate-400">Ao clicar em "Lançar" na lista, será criada(s) a(s) conta(s) a pagar automaticamente.</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button
                type="button"
                disabled={createMutation.isPending || !canSubmit()}
                onClick={() => createMutation.mutate(formData)}
                className={formData.tipo_lancamento === 'compra_direta_loja' ? 'bg-amber-600 hover:bg-amber-700' : ''}
              >
                {createMutation.isPending ? 'Salvando...' : 'Cadastrar NF'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal de Visualização ──────────────────────────────────────────── */}
      <Dialog open={!!viewModal} onOpenChange={() => setViewModal(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              Nota Fiscal {viewModal?.numero || '(manual)'}
              {viewModal?.tipo_lancamento === 'compra_direta_loja' ? (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Loja Direta</span>
              ) : (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">CD</span>
              )}
            </DialogTitle>
          </DialogHeader>
          {viewModal && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><p className="text-xs text-slate-500">Número/Série</p><p className="font-medium">{viewModal.numero}/{viewModal.serie || '1'}</p></div>
                <div><p className="text-xs text-slate-500">Data Emissão</p><p className="font-medium">{viewModal.data_emissao ? format(new Date(viewModal.data_emissao + 'T12:00:00'), 'dd/MM/yyyy') : '-'}</p></div>
                <div><p className="text-xs text-slate-500">Valor Total</p><MoneyDisplay value={viewModal.valor_total || 0} size="lg" /></div>
                <div><p className="text-xs text-slate-500">Status</p><StatusBadge status={viewModal.status} /></div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                {viewModal.loja_responsavel_id && (
                  <div><p className="text-xs text-slate-500">Loja Responsável</p><p className="font-medium">{getLoja(viewModal.loja_responsavel_id)?.nome || '-'}</p></div>
                )}
                {viewModal.faturado_para_nome && (
                  <div><p className="text-xs text-slate-500">Faturado para</p><p className="font-medium">{viewModal.faturado_para_nome}</p></div>
                )}
                {viewModal.tipo_lancamento === 'compra_direta_loja' && (
                  <div><p className="text-xs text-slate-500">Lançado no PDV</p><p className="font-medium">{viewModal.lancado_no_pdv ? '✅ Sim' : '❌ Não'}</p></div>
                )}
              </div>

              {viewModal.itens?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Itens da Nota</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                          <th className="text-left p-3">Descrição</th>
                          <th className="text-right p-3">Qtd</th>
                          <th className="text-right p-3">Custo Unit.</th>
                          <th className="text-right p-3">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewModal.itens.map((item, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-3">{item.descricao_nf || item.descricao}</td>
                            <td className="p-3 text-right">{item.quantidade}</td>
                            <td className="p-3 text-right"><MoneyDisplay value={item.custo_unitario || 0} size="xs" /></td>
                            <td className="p-3 text-right"><MoneyDisplay value={item.subtotal || 0} size="xs" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <DialogFooter>
                {viewModal.status === 'pendente' && (
                  <Button onClick={() => { handleConferir(viewModal); setViewModal(null); }}>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Conferir
                  </Button>
                )}
                {viewModal.status === 'conferida' && (
                  <Button
                    onClick={() => { handleLancar(viewModal); setViewModal(null); }}
                    className={viewModal.tipo_lancamento === 'compra_direta_loja' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {viewModal.tipo_lancamento === 'compra_direta_loja' ? 'Lançar (Financeiro-Only)' : 'Lançar no Sistema'}
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal Importar NF (Gemini) ───────────────────────────────────────── */}
      <ImportarNFModal
        open={importarModalOpen}
        onClose={() => setImportarModalOpen(false)}
        fornecedores={fornecedores}
        lojas={lojas}
        onConfirm={(dadosExtraidos) => {
          setFormData(prev => ({ ...prev, ...dadosExtraidos }));
          setImportarModalOpen(false);
          // abre o modal principal já com dados preenchidos
          setModalOpen(true);
        }}
      />

      {/* Modal de novo produto inline */}
      <NovoProdutoModal
        open={novoProdutoForIdx !== null}
        onClose={() => setNovoProdutoForIdx(null)}
        categorias={categorias}
        onSave={handleNovoProdutoSalvo}
      />
    </div>
  );
}