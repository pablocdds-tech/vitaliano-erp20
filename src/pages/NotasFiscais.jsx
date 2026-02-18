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
  Loader2, Sparkles, Trash2, Search, PackagePlus
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { processarEntrada } from '@/components/services/estoqueService';
import { criarContasPagarNF } from '@/components/services/financeiroService';
import { getEmpresaAtiva } from '@/components/services/tenantService';

const UNIDADES = ['un', 'kg', 'g', 'l', 'ml', 'cx', 'pc', 'fd'];

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

function ItemRow({ item, idx, produtos, onUpdate, onRemove, onAddProduto }) {
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const produtoSelecionado = produtos.find(p => p.id === item.produto_id);
  const filteredProds = search.length >= 2
    ? produtos.filter(p => p.nome.toLowerCase().includes(search.toLowerCase()) || (p.codigo || '').toLowerCase().includes(search.toLowerCase()))
    : [];

  const selectProd = (p) => {
    onUpdate(idx, {
      produto_id: p.id,
      descricao_nf: p.nome,
      custo_unitario: p.custo_medio || 0,
      subtotal: item.quantidade * (p.custo_medio || 0),
    });
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
      {/* Produto */}
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
              <Input
                className="pl-7 text-xs h-8"
                placeholder="Buscar produto..."
                value={search}
                onChange={e => { setSearch(e.target.value); setShowSearch(true); }}
                onFocus={() => setShowSearch(true)}
              />
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
      {/* Qtd */}
      <div className="col-span-2">
        <Input type="number" className="text-xs h-8" value={item.quantidade} min="0.001" step="0.001" onChange={e => update('quantidade', parseFloat(e.target.value) || 0)} />
      </div>
      {/* Custo Unit */}
      <div className="col-span-2">
        <Input type="number" className="text-xs h-8" value={item.custo_unitario} min="0" step="0.01" onChange={e => update('custo_unitario', parseFloat(e.target.value) || 0)} />
      </div>
      {/* Subtotal */}
      <div className="col-span-2 flex items-center">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatMoney(item.subtotal || 0)}</span>
      </div>
      {/* Remove */}
      <div className="col-span-1 flex items-center">
        <button type="button" onClick={() => onRemove(idx)} className="text-red-400 hover:text-red-600">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function NotasFiscais() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModal, setViewModal] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [novoProdutoForIdx, setNovoProdutoForIdx] = useState(null); // idx do item que vai receber o novo produto

  const emptyForm = {
    loja_id: '', fornecedor_id: '', numero: '', serie: '1',
    data_emissao: format(new Date(), 'yyyy-MM-dd'), data_entrada: format(new Date(), 'yyyy-MM-dd'),
    valor_total: 0, chave_acesso: '',
    itens: [],
    // parcelamento para CP gerada
    num_parcelas: 1, primeiro_vencimento: format(new Date(), 'yyyy-MM-dd'),
    forma_pagamento: 'boleto',
  };
  const [formData, setFormData] = useState(emptyForm);

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ['notas-fiscais'],
    queryFn: () => base44.entities.NotaFiscal.list('-created_date', 50)
  });
  const { data: lojas = [] } = useQuery({ queryKey: ['lojas'], queryFn: () => base44.entities.Loja.list() });
  const { data: fornecedores = [] } = useQuery({ queryKey: ['fornecedores'], queryFn: () => base44.entities.Fornecedor.list() });
  const { data: produtos = [] } = useQuery({ queryKey: ['produtos'], queryFn: () => base44.entities.Produto.list() });
  const { data: categorias = [] } = useQuery({ queryKey: ['categorias'], queryFn: () => base44.entities.Categoria.list() });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Calcula valor_total a partir dos itens, se houver
      const total = data.itens?.length > 0
        ? data.itens.reduce((s, i) => s + (i.subtotal || 0), 0)
        : data.valor_total;
      return base44.entities.NotaFiscal.create({ ...data, valor_total: total });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] });
      setModalOpen(false);
      setFormData(emptyForm);
      toast.success('Nota fiscal cadastrada! Clique em "Lançar" para dar entrada no estoque.');
    },
    onError: (e) => toast.error('Erro ao cadastrar: ' + e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.NotaFiscal.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] });
      toast.success('Nota fiscal atualizada!');
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

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
      toast.success('Nota processada pela IA! Vincule os produtos aos itens.');
    }
  };

  const handleLancar = async (nota) => {
    try {
      const empresa = await getEmpresaAtiva();
      await updateMutation.mutateAsync({ id: nota.id, data: { status: 'lancada' } });

      if (nota.itens?.length > 0) {
        for (const item of nota.itens) {
          if (!item.produto_id || !item.quantidade) continue;
          await processarEntrada({
            empresa_id: empresa.id,
            loja_id: nota.loja_id,
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            custo_unitario: item.custo_unitario || item.valor_unitario || 0,
            documento_tipo: 'nota_fiscal',
            documento_id: nota.id,
            observacao: `Entrada via NF ${nota.numero}/${nota.serie || '1'}`,
          });
        }
      }

      await criarContasPagarNF({
        empresa_id: empresa.id,
        loja_id: nota.loja_id,
        fornecedor_id: nota.fornecedor_id,
        nota,
      });

      toast.success('Nota lançada! Estoque e conta a pagar atualizados.');
    } catch (err) {
      toast.error('Erro ao lançar: ' + err.message);
    }
  };

  const handleConferir = async (nota) => {
    await updateMutation.mutateAsync({ id: nota.id, data: { status: 'conferida' } });
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      itens: [...prev.itens, { produto_id: '', descricao_nf: '', quantidade: 1, custo_unitario: 0, subtotal: 0 }]
    }));
  };

  const updateItem = (idx, patch) => {
    setFormData(prev => {
      const itens = prev.itens.map((it, i) => i === idx ? { ...it, ...patch } : it);
      const valor_total = itens.reduce((s, i) => s + (i.subtotal || 0), 0);
      return { ...prev, itens, valor_total };
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
      updateItem(novoProdutoForIdx, {
        produto_id: prod.id,
        descricao_nf: prod.nome,
        custo_unitario: 0,
        subtotal: 0,
      });
      setNovoProdutoForIdx(null);
    }
  };

  const getLoja = (id) => lojas.find(l => l.id === id);
  const getFornecedor = (id) => fornecedores.find(f => f.id === id);

  const columns = [
    {
      key: 'numero', label: 'NF', sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-slate-800 dark:text-white">{value || '(manual)'}</p>
            <p className="text-xs text-slate-500">Série {row.serie || '1'}</p>
          </div>
        </div>
      )
    },
    {
      key: 'fornecedor_id', label: 'Fornecedor',
      render: (value) => {
        const f = getFornecedor(value);
        return f ? <div className="flex items-center gap-2 text-sm"><Building2 className="w-4 h-4 text-slate-400" />{f.nome_fantasia || f.razao_social}</div> : <span className="text-slate-400 text-sm">—</span>;
      }
    },
    { key: 'loja_id', label: 'Loja', render: (v) => getLoja(v)?.nome || '-' },
    { key: 'data_entrada', label: 'Entrada', sortable: true, render: (v) => v ? format(new Date(v + 'T12:00:00'), 'dd/MM/yyyy') : '-' },
    { key: 'valor_total', label: 'Total', sortable: true, render: (v) => <MoneyDisplay value={v || 0} size="sm" /> },
    { key: 'status', label: 'Status', sortable: true, render: (v) => <StatusBadge status={v} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notas Fiscais"
        subtitle="Gerencie suas notas fiscais de entrada"
        icon={FileText}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Notas Fiscais' }]}
        actions={
          <div className="flex gap-2">
            <Button onClick={() => { setFormData(emptyForm); setModalOpen(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> Nova NF
            </Button>
          </div>
        }
      />

      {/* Resumo */}
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
              <p className="text-xs text-slate-500">Processadas IA</p>
              <p className="text-2xl font-bold text-purple-600">{notas.filter(n => n.processada_ia).length}</p>
            </div>
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30"><Bot className="w-5 h-5 text-purple-600" /></div>
          </CardContent>
        </Card>
      </div>

      {notas.length === 0 && !isLoading ? (
        <EmptyState icon={FileText} title="Nenhuma nota fiscal" description="Cadastre manualmente ou importe XMLs." actionLabel="Nova NF" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable
          columns={columns} data={notas} loading={isLoading}
          searchPlaceholder="Buscar notas..." emptyIcon={FileText} emptyTitle="Nenhuma nota"
          onRowClick={(row) => setViewModal(row)}
          rowActions={(row) => [
            { label: 'Visualizar', icon: Eye, onClick: () => setViewModal(row) },
            ...(row.status === 'pendente' ? [{ label: 'Conferir', icon: CheckCircle2, onClick: () => handleConferir(row) }] : []),
            ...(row.status === 'conferida' ? [{ label: 'Lançar no Sistema', icon: CheckCircle2, onClick: () => handleLancar(row) }] : []),
          ]}
        />
      )}

      {/* Modal de Cadastro */}
      <Dialog open={modalOpen} onOpenChange={(v) => { setModalOpen(v); if (!v) setFormData(emptyForm); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Nota Fiscal</DialogTitle></DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-5">
            {/* Upload XML */}
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center">
              <input type="file" accept=".xml,.pdf" onChange={handleFileUpload} className="hidden" id="xml-upload" disabled={uploading || processing} />
              <label htmlFor="xml-upload" className="cursor-pointer">
                {uploading || processing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-7 h-7 text-purple-600 animate-spin" />
                    <p className="text-sm text-slate-600">{uploading ? 'Enviando...' : 'Processando com IA...'}</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30"><Sparkles className="w-5 h-5 text-purple-600" /></div>
                    <div className="text-left">
                      <p className="font-medium text-sm text-slate-800 dark:text-white">Importar XML / PDF com IA</p>
                      <p className="text-xs text-slate-500">Clique para selecionar o arquivo</p>
                    </div>
                  </div>
                )}
              </label>
            </div>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t border-slate-200" />
              <span className="text-xs text-slate-400 uppercase">ou preencha manualmente</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            {/* Dados Principais */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Loja / CD *</Label>
                <Select value={formData.loja_id || '__none__'} onValueChange={v => setFormData({ ...formData, loja_id: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Selecione...</SelectItem>
                    {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
                <Label>Número da NF</Label>
                <Input value={formData.numero} onChange={e => setFormData({ ...formData, numero: e.target.value })} placeholder="000001" />
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

            {/* Itens da Nota */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Itens da Nota</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1">
                  <Plus className="w-3.5 h-3.5" /> Adicionar Item
                </Button>
              </div>

              {formData.itens.length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
                  <p className="text-sm text-slate-400">Nenhum item adicionado. Clique em "Adicionar Item" ou importe via XML.</p>
                </div>
              ) : (
                <div className="border rounded-lg p-3 space-y-3">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 uppercase pb-1 border-b">
                    <div className="col-span-5">Produto / Descrição NF</div>
                    <div className="col-span-2">Qtd</div>
                    <div className="col-span-2">Custo Unit.</div>
                    <div className="col-span-2">Subtotal</div>
                    <div className="col-span-1"></div>
                  </div>
                  {formData.itens.map((item, idx) => (
                    <ItemRow
                      key={idx} item={item} idx={idx}
                      produtos={produtos}
                      onUpdate={updateItem}
                      onRemove={removeItem}
                      onAddProduto={(i) => setNovoProdutoForIdx(i)}
                    />
                  ))}
                  <div className="flex justify-end pt-2 border-t">
                    <div className="text-right">
                      <p className="text-xs text-slate-500">TOTAL DA NF</p>
                      <p className="text-xl font-bold text-slate-800 dark:text-white">{formatMoney(formData.valor_total)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Conta a pagar — parcelamento */}
            <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50 space-y-3">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Conta a Pagar gerada ao Lançar</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Parcelas</Label>
                  <Input type="number" min="1" max="48" value={formData.num_parcelas} onChange={e => setFormData({ ...formData, num_parcelas: parseInt(e.target.value) || 1 })} />
                </div>
                <div className="space-y-1">
                  <Label>1º Vencimento</Label>
                  <Input type="date" value={formData.primeiro_vencimento} onChange={e => setFormData({ ...formData, primeiro_vencimento: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-slate-400">Ao clicar em "Lançar" na lista, será criada(s) a(s) conta(s) a pagar automaticamente.</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || !formData.loja_id}>
                {createMutation.isPending ? 'Salvando...' : 'Cadastrar NF'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Visualização */}
      <Dialog open={!!viewModal} onOpenChange={() => setViewModal(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nota Fiscal {viewModal?.numero || '(manual)'}</DialogTitle></DialogHeader>
          {viewModal && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><p className="text-xs text-slate-500">Número/Série</p><p className="font-medium">{viewModal.numero}/{viewModal.serie || '1'}</p></div>
                <div><p className="text-xs text-slate-500">Data Emissão</p><p className="font-medium">{viewModal.data_emissao ? format(new Date(viewModal.data_emissao + 'T12:00:00'), 'dd/MM/yyyy') : '-'}</p></div>
                <div><p className="text-xs text-slate-500">Valor Total</p><MoneyDisplay value={viewModal.valor_total || 0} size="lg" /></div>
                <div><p className="text-xs text-slate-500">Status</p><StatusBadge status={viewModal.status} /></div>
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
                            <td className="p-3 text-right"><MoneyDisplay value={item.custo_unitario || item.valor_unitario || 0} size="xs" /></td>
                            <td className="p-3 text-right"><MoneyDisplay value={item.subtotal || item.valor_total || 0} size="xs" /></td>
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
                  <Button onClick={() => { handleLancar(viewModal); setViewModal(null); }}>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Lançar no Sistema
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

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