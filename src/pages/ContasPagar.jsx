import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import MoneyDisplay, { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import KPICard from '@/components/ui-custom/KPICard';
import EmptyState from '@/components/ui-custom/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard, Plus, Pencil, CheckCircle2, Trash2, Clock, AlertTriangle, Wallet, Layers, BanknoteIcon } from 'lucide-react';
import { format, differenceInDays, isAfter, addMonths } from 'date-fns';
import { toast } from 'sonner';
import { getEmpresaAtiva } from '@/components/services/tenantService';
import RegistrarPagamentoModal from '@/components/contas/RegistrarPagamentoModal';

const FORMAS = ['boleto', 'pix', 'transferencia', 'dinheiro', 'cartao', 'cheque'];
const TIPO_CREDOR = ['fornecedor', 'banco', 'servico', 'aluguel', 'outro'];

function gerarParcelas(valor, numParcelas, primeiroVencimento, intervalo = 'mensal') {
  const parcelas = [];
  const vlrParcela = parseFloat((valor / numParcelas).toFixed(2));
  let diff = valor - vlrParcela * numParcelas; // ajuste de centavos
  for (let i = 0; i < numParcelas; i++) {
    const venc = addMonths(new Date(primeiroVencimento + 'T12:00:00'), i);
    parcelas.push({
      numero: i + 1,
      vencimento: format(venc, 'yyyy-MM-dd'),
      valor: i === numParcelas - 1 ? parseFloat((vlrParcela + diff).toFixed(2)) : vlrParcela,
    });
  }
  return parcelas;
}

export default function ContasPagar() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [pagamentoModal, setPagamentoModal] = useState(null); // conta sendo paga

  const emptyForm = {
    descricao: '',
    credor_nome: '',
    credor_tipo: 'fornecedor',
    fornecedor_id: '',
    loja_id: '',
    categoria_dre_id: '',
    documento_numero: '',
    data_emissao: format(new Date(), 'yyyy-MM-dd'),
    data_vencimento: '',
    valor_original: '',
    forma_pagamento: 'boleto',
    observacoes: '',
    // parcelamento
    parcelar: false,
    num_parcelas: 2,
    primeiro_vencimento: '',
  };

  const [formData, setFormData] = useState(emptyForm);

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['contas-pagar'],
    queryFn: () => base44.entities.ContaPagar.list('-data_vencimento')
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Fornecedor.list()
  });

  const { data: categoriasDRE = [] } = useQuery({
    queryKey: ['categorias-dre'],
    queryFn: () => base44.entities.CategoriaDRE.list()
  });

  const { data: contasBancarias = [] } = useQuery({
    queryKey: ['contas-bancarias'],
    queryFn: () => base44.entities.ContaBancaria.filter({ status: 'ativo' })
  });

  const { data: cofres = [] } = useQuery({
    queryKey: ['cofres'],
    queryFn: () => base44.entities.Cofre.filter({ status: 'ativo' })
  });

  const createMutation = useMutation({
    mutationFn: async (form) => {
      const empresa = await getEmpresaAtiva();
      const base = {
        empresa_id: empresa.id,
        loja_id: form.loja_id,
        fornecedor_id: form.fornecedor_id || null,
        categoria_dre_id: form.categoria_dre_id || null,
        descricao: form.descricao,
        credor_nome: form.credor_nome || null,
        credor_tipo: form.credor_tipo || null,
        documento_numero: form.documento_numero || null,
        data_emissao: form.data_emissao || null,
        forma_pagamento: form.forma_pagamento,
        observacoes: form.observacoes || null,
        status: 'pendente',
      };

      if (form.parcelar && form.num_parcelas > 1) {
        const parcelas = gerarParcelas(parseFloat(form.valor_original), form.num_parcelas, form.primeiro_vencimento);
        for (const p of parcelas) {
          await base44.entities.ContaPagar.create({
            ...base,
            data_vencimento: p.vencimento,
            valor_original: p.valor,
            parcela_atual: p.numero,
            total_parcelas: form.num_parcelas,
          });
        }
      } else {
        await base44.entities.ContaPagar.create({
          ...base,
          data_vencimento: form.data_vencimento,
          valor_original: parseFloat(form.valor_original),
          parcela_atual: 1,
          total_parcelas: 1,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      setModalOpen(false);
      setFormData(emptyForm);
      toast.success('Conta(s) cadastrada(s)!');
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ContaPagar.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      setModalOpen(false);
      setEditingItem(null);
      setFormData(emptyForm);
      toast.success('Conta atualizada!');
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContaPagar.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      toast.success('Conta excluída!');
    },
    onError: (e) => toast.error('Erro ao excluir: ' + e.message),
  });

  // Removido: handlePay simples. Substituído por modal de registro de pagamento.

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      ...emptyForm,
      descricao: item.descricao || '',
      credor_nome: item.credor_nome || '',
      credor_tipo: item.credor_tipo || 'fornecedor',
      fornecedor_id: item.fornecedor_id || '',
      loja_id: item.loja_id || '',
      categoria_dre_id: item.categoria_dre_id || '',
      documento_numero: item.documento_numero || '',
      data_emissao: item.data_emissao || '',
      data_vencimento: item.data_vencimento || '',
      valor_original: item.valor_original || '',
      forma_pagamento: item.forma_pagamento || 'boleto',
      observacoes: item.observacoes || '',
      parcelar: false,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.loja_id) { toast.error('Selecione a loja/CD'); return; }
    if (!formData.valor_original || parseFloat(formData.valor_original) <= 0) { toast.error('Informe o valor'); return; }
    if (formData.parcelar && !formData.primeiro_vencimento) { toast.error('Informe o primeiro vencimento'); return; }
    if (!formData.parcelar && !formData.data_vencimento) { toast.error('Informe o vencimento'); return; }

    if (editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        data: {
          descricao: formData.descricao,
          credor_nome: formData.credor_nome,
          credor_tipo: formData.credor_tipo,
          fornecedor_id: formData.fornecedor_id || null,
          loja_id: formData.loja_id,
          categoria_dre_id: formData.categoria_dre_id || null,
          data_vencimento: formData.data_vencimento,
          valor_original: parseFloat(formData.valor_original),
          forma_pagamento: formData.forma_pagamento,
          observacoes: formData.observacoes,
        }
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const hoje = new Date();
  const pendentes = contas.filter(c => c.status === 'pendente');
  const vencidas = pendentes.filter(c => c.data_vencimento && isAfter(hoje, new Date(c.data_vencimento + 'T23:59:59')));
  const vencendoLogo = pendentes.filter(c => {
    if (!c.data_vencimento) return false;
    const diff = differenceInDays(new Date(c.data_vencimento + 'T12:00:00'), hoje);
    return diff >= 0 && diff <= 7;
  });
  const totalPendente = pendentes.reduce((s, c) => s + (c.valor_original || 0), 0);
  const totalVencido = vencidas.reduce((s, c) => s + (c.valor_original || 0), 0);

  const getCredorLabel = (row) => {
    if (row.fornecedor_id) {
      const f = fornecedores.find(f => f.id === row.fornecedor_id);
      if (f) return f.nome_fantasia || f.razao_social;
    }
    return row.credor_nome || '-';
  };

  const catsDespesa = categoriasDRE.filter(c => ['custo','despesa_fixa','despesa_variavel'].includes(c.tipo));

  const columns = [
    {
      key: 'descricao',
      label: 'Descrição / Credor',
      sortable: true,
      render: (value, row) => {
        const vencida = row.status === 'pendente' && row.data_vencimento && isAfter(hoje, new Date(row.data_vencimento + 'T23:59:59'));
        return (
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${vencida ? 'bg-red-100' : row.status === 'pago' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
              {vencida ? <AlertTriangle className="w-4 h-4 text-red-600" /> : row.status === 'pago' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Clock className="w-4 h-4 text-amber-600" />}
            </div>
            <div>
              <p className="font-medium text-slate-800 dark:text-white">{value}</p>
              <p className="text-xs text-slate-500">{getCredorLabel(row)}</p>
              {row.total_parcelas > 1 && (
                <p className="text-xs text-indigo-500">{row.parcela_atual}/{row.total_parcelas} parcelas</p>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: 'loja_id',
      label: 'Loja',
      render: (v) => lojas.find(l => l.id === v)?.nome || '-'
    },
    {
      key: 'data_vencimento',
      label: 'Vencimento',
      sortable: true,
      render: (value, row) => {
        const vencida = row.status === 'pendente' && value && isAfter(hoje, new Date(value + 'T23:59:59'));
        return <span className={vencida ? 'text-red-600 font-medium' : ''}>{value ? format(new Date(value + 'T12:00:00'), 'dd/MM/yyyy') : '-'}</span>;
      }
    },
    { key: 'valor_original', label: 'Valor', sortable: true, render: (v) => <MoneyDisplay value={v || 0} size="sm" /> },
    { key: 'forma_pagamento', label: 'Forma', render: (v) => <span className="text-sm capitalize">{v?.replace(/_/g, ' ')}</span> },
    {
      key: 'status', label: 'Status', sortable: true,
      render: (value, row) => {
        const vencida = value === 'pendente' && row.data_vencimento && isAfter(hoje, new Date(row.data_vencimento + 'T23:59:59'));
        return <StatusBadge status={vencida ? 'vencido' : value} />;
      }
    },
    {
      key: 'id',
      label: '',
      render: (_, row) => {
        if (row.status === 'pago') return (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5" /> Pago ✅
          </span>
        );
        if (row.status === 'cancelado') return null;
        return (
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 gap-1.5 h-8 whitespace-nowrap"
            onClick={(e) => { e.stopPropagation(); setPagamentoModal(row); }}
          >
            <BanknoteIcon className="w-3.5 h-3.5" />
            Pagar 💳
          </Button>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a Pagar"
        subtitle="Gerencie despesas, boletos e parcelamentos"
        icon={CreditCard}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Contas a Pagar' }]}
        actions={
          <Button onClick={() => { setFormData(emptyForm); setEditingItem(null); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Conta
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Pendente" value={formatMoney(totalPendente)} icon={Wallet} variant="warning" subtitle={`${pendentes.length} contas`} />
        <KPICard title="Vencidas" value={formatMoney(totalVencido)} icon={AlertTriangle} variant="danger" subtitle={`${vencidas.length} contas`} />
        <KPICard title="Vence em 7 dias" value={vencendoLogo.length} icon={Clock} variant="info" subtitle="contas próximas" />
        <KPICard title="Pagas" value={contas.filter(c => c.status === 'pago').length} icon={CheckCircle2} variant="success" />
      </div>

      {contas.length === 0 && !isLoading ? (
        <EmptyState icon={CreditCard} title="Nenhuma conta cadastrada" description="Cadastre suas contas a pagar." actionLabel="Nova Conta" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable
          columns={columns}
          data={contas}
          loading={isLoading}
          searchPlaceholder="Buscar contas..."
          emptyIcon={CreditCard}
          emptyTitle="Nenhuma conta encontrada"
          rowActions={(row) => [
            ...(row.status !== 'pago' && row.status !== 'cancelado' ? [{ label: 'Registrar Pagamento', icon: BanknoteIcon, onClick: () => setPagamentoModal(row) }] : []),
            { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) },
            { label: 'Excluir', icon: Trash2, onClick: () => deleteMutation.mutate(row.id), destructive: true }
          ]}
        />
      )}

      {/* Modal de Pagamento */}
      <RegistrarPagamentoModal
        open={!!pagamentoModal}
        onClose={() => setPagamentoModal(null)}
        conta={pagamentoModal}
        contasBancarias={contasBancarias}
        cofres={cofres}
        lojas={lojas}
      />

      {/* Modal de Cadastro/Edição */}
      <Dialog open={modalOpen} onOpenChange={(v) => { setModalOpen(v); if (!v) { setEditingItem(null); setFormData(emptyForm); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Conta' : 'Nova Conta a Pagar'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Descrição */}
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input value={formData.descricao} onChange={e => setFormData({ ...formData, descricao: e.target.value })} placeholder="Ex: Aluguel fevereiro, Boleto fornecedor..." required />
            </div>

            {/* Credor */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Credor</Label>
                <Select value={formData.credor_tipo} onValueChange={v => setFormData({ ...formData, credor_tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_CREDOR.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nome do Credor</Label>
                <Input value={formData.credor_nome} onChange={e => setFormData({ ...formData, credor_nome: e.target.value })} placeholder="Banco Itaú, Fornecedor X..." />
              </div>
            </div>

            {/* Fornecedor (opcional) */}
            {formData.credor_tipo === 'fornecedor' && (
              <div className="space-y-2">
                <Label>Fornecedor cadastrado (opcional)</Label>
                <Select value={formData.fornecedor_id || '__none__'} onValueChange={v => setFormData({ ...formData, fornecedor_id: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Nenhum —</SelectItem>
                    {fornecedores.map(f => <SelectItem key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Loja + Categoria */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Loja / CD *</Label>
                <Select value={formData.loja_id || '__none__'} onValueChange={v => setFormData({ ...formData, loja_id: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Selecione...</SelectItem>
                    {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoria DRE</Label>
                <Select value={formData.categoria_dre_id || '__none__'} onValueChange={v => setFormData({ ...formData, categoria_dre_id: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Nenhuma —</SelectItem>
                    {catsDespesa.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Datas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Emissão</Label>
                <Input type="date" value={formData.data_emissao} onChange={e => setFormData({ ...formData, data_emissao: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>N° Documento</Label>
                <Input value={formData.documento_numero} onChange={e => setFormData({ ...formData, documento_numero: e.target.value })} placeholder="NF-001, Fatura..." />
              </div>
            </div>

            {/* Valor + Forma */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Total (R$) *</Label>
                <Input type="number" value={formData.valor_original} onChange={e => setFormData({ ...formData, valor_original: e.target.value })} min="0.01" step="0.01" required />
              </div>
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={formData.forma_pagamento} onValueChange={v => setFormData({ ...formData, forma_pagamento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMAS.map(f => <SelectItem key={f} value={f} className="capitalize">{f.replace(/_/g, ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Parcelamento */}
            {!editingItem && (
              <div className="border rounded-lg p-4 space-y-3 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="parcelar"
                    checked={formData.parcelar}
                    onChange={e => setFormData({ ...formData, parcelar: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="parcelar" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    Parcelar em múltiplos boletos
                  </label>
                </div>

                {formData.parcelar && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Número de Parcelas</Label>
                      <Input type="number" min="2" max="48" value={formData.num_parcelas} onChange={e => setFormData({ ...formData, num_parcelas: parseInt(e.target.value) || 2 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>1º Vencimento *</Label>
                      <Input type="date" value={formData.primeiro_vencimento} onChange={e => setFormData({ ...formData, primeiro_vencimento: e.target.value })} />
                    </div>
                    {formData.valor_original && formData.num_parcelas >= 2 && (
                      <div className="col-span-2 text-xs text-slate-500 bg-white dark:bg-slate-900 rounded p-2 border">
                        <strong>{formData.num_parcelas}x</strong> de aproximadamente <strong>{formatMoney(parseFloat(formData.valor_original) / formData.num_parcelas)}</strong> — mensal
                      </div>
                    )}
                  </div>
                )}

                {!formData.parcelar && (
                  <div className="space-y-2">
                    <Label>Data de Vencimento *</Label>
                    <Input type="date" value={formData.data_vencimento} onChange={e => setFormData({ ...formData, data_vencimento: e.target.value })} />
                  </div>
                )}
              </div>
            )}

            {editingItem && (
              <div className="space-y-2">
                <Label>Data de Vencimento *</Label>
                <Input type="date" value={formData.data_vencimento} onChange={e => setFormData({ ...formData, data_vencimento: e.target.value })} required />
              </div>
            )}

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={formData.observacoes} onChange={e => setFormData({ ...formData, observacoes: e.target.value })} rows={2} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingItem ? 'Salvar' : formData.parcelar ? `Gerar ${formData.num_parcelas} Parcelas` : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}