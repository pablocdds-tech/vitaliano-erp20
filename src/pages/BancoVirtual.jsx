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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  PiggyBank, Plus, ArrowUpRight, ArrowDownRight, ArrowLeftRight,
  Building2, Store, CheckCircle2, XCircle, Clock, AlertTriangle, Wallet, SplitSquareHorizontal
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { getEmpresaAtiva } from '@/components/services/tenantService';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
async function criarMovBanco(payload) {
  return base44.entities.BancoVirtual.create(payload);
}

async function aprovar(mov, lojas) {
  if (mov.status !== 'pendente') throw new Error('Só é possível aprovar operações pendentes');
  if (mov.loja_origem_id) {
    const l = lojas.find(x => x.id === mov.loja_origem_id);
    if (l) await base44.entities.Loja.update(mov.loja_origem_id, { saldo_banco_virtual: (l.saldo_banco_virtual || 0) - mov.valor });
  }
  if (mov.loja_destino_id) {
    const l = lojas.find(x => x.id === mov.loja_destino_id);
    if (l) await base44.entities.Loja.update(mov.loja_destino_id, { saldo_banco_virtual: (l.saldo_banco_virtual || 0) + mov.valor });
  }
  return base44.entities.BancoVirtual.update(mov.id, { status: 'aprovado', data_aprovacao: new Date().toISOString() });
}

// ─────────────────────────────────────────────
// Modal: Nova Operação
// ─────────────────────────────────────────────
function NovaOperacaoModal({ open, onClose, lojas, onSuccess }) {
  const [form, setForm] = useState({ tipo: 'pagamento_boleto_cd', loja_id: '', valor: '', descricao: '' });

  const mut = useMutation({
    mutationFn: async () => {
      const empresa = await getEmpresaAtiva();
      const cd = lojas.find(l => l.tipo === 'cd');
      const loja = lojas.find(l => l.id === form.loja_id);
      if (!loja) throw new Error('Selecione a loja');
      const valor = parseFloat(form.valor);
      if (!valor || valor <= 0) throw new Error('Valor inválido');

      let payload = { empresa_id: empresa.id, valor, descricao: form.descricao, status: 'pendente', tipo: form.tipo };

      // Lógica por tipo:
      if (form.tipo === 'pagamento_boleto_cd') {
        // Loja paga dívida com CD → débito na loja, crédito no CD
        payload.loja_origem_id = loja.id;
        payload.loja_destino_id = cd?.id || null;
      } else if (form.tipo === 'venda_cd_loja') {
        // CD envia mercadoria → aumenta dívida da loja
        payload.loja_origem_id = cd?.id || null;
        payload.loja_destino_id = loja.id;
      } else if (form.tipo === 'ajuste') {
        payload.loja_origem_id = null;
        payload.loja_destino_id = loja.id;
      }

      return criarMovBanco(payload);
    },
    onSuccess: () => { toast.success('Operação criada! Aguardando aprovação.'); onSuccess(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nova Operação</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Operação *</Label>
            <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pagamento_boleto_cd">Pagamento de Boleto/Dívida ao CD</SelectItem>
                <SelectItem value="venda_cd_loja">Venda CD → Loja (gera dívida)</SelectItem>
                <SelectItem value="ajuste">Ajuste Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Loja *</Label>
            <Select value={form.loja_id || '__none__'} onValueChange={v => setForm({ ...form, loja_id: v === '__none__' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Selecione...</SelectItem>
                {lojas.filter(l => l.tipo === 'loja').map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nome} (dívida: {formatMoney(Math.abs(l.saldo_banco_virtual || 0))})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Valor (R$) *</Label>
            <Input type="number" min="0.01" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} rows={2} placeholder="Motivo da operação..." />
          </div>

          {form.tipo === 'pagamento_boleto_cd' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
              Ao aprovar: a dívida da loja com o CD será reduzida pelo valor informado.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? 'Salvando...' : 'Criar Operação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Modal: Pagamento Parcial / Split
// ─────────────────────────────────────────────
function PagamentoSplitModal({ open, onClose, lojas, onSuccess }) {
  const [splits, setSplits] = useState([{ loja_id: '', valor: '' }]);
  const [descricao, setDescricao] = useState('');

  const addSplit = () => setSplits(p => [...p, { loja_id: '', valor: '' }]);
  const updateSplit = (idx, field, val) => setSplits(p => p.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  const removeSplit = (idx) => setSplits(p => p.filter((_, i) => i !== idx));

  const mut = useMutation({
    mutationFn: async () => {
      const empresa = await getEmpresaAtiva();
      const cd = lojas.find(l => l.tipo === 'cd');
      for (const s of splits) {
        if (!s.loja_id || !s.valor) throw new Error('Preencha todos os campos de split');
        const val = parseFloat(s.valor);
        if (val <= 0) throw new Error('Valor inválido');
        await criarMovBanco({
          empresa_id: empresa.id,
          loja_origem_id: s.loja_id,
          loja_destino_id: cd?.id || null,
          tipo: 'pagamento_boleto_cd',
          valor: val,
          descricao: descricao || 'Pagamento parcial (split)',
          status: 'pendente',
        });
      }
    },
    onSuccess: () => { toast.success(`${splits.length} operação(ões) de split criadas!`); onSuccess(); onClose(); setSplits([{ loja_id: '', valor: '' }]); },
    onError: (e) => toast.error(e.message),
  });

  const total = splits.reduce((s, x) => s + (parseFloat(x.valor) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><SplitSquareHorizontal className="w-5 h-5" /> Pagamento Parcial / Split</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Registre um pagamento usando múltiplas lojas como origem (split de dívida).</p>

          <div className="space-y-2">
            {splits.map((s, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <Select value={s.loja_id || '__none__'} onValueChange={v => updateSplit(idx, 'loja_id', v === '__none__' ? '' : v)}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Loja..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Selecione...</SelectItem>
                    {lojas.filter(l => l.tipo === 'loja').map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="number" className="w-32" placeholder="Valor" min="0.01" step="0.01" value={s.valor} onChange={e => updateSplit(idx, 'valor', e.target.value)} />
                {splits.length > 1 && (
                  <button type="button" onClick={() => removeSplit(idx)} className="text-red-400 hover:text-red-600 text-lg leading-none">✕</button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addSplit} className="gap-1 w-full">
              <Plus className="w-3.5 h-3.5" /> Adicionar origem
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Referência / boleto..." />
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 flex justify-between items-center">
            <span className="text-sm text-slate-600">Total do split:</span>
            <span className="font-bold text-lg">{formatMoney(total)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? 'Registrando...' : 'Registrar Split'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Página Principal
// ─────────────────────────────────────────────
export default function BancoVirtual() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [splitModal, setSplitModal] = useState(false);

  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ['banco-virtual'],
    queryFn: () => base44.entities.BancoVirtual.list('-created_date', 100),
  });
  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['banco-virtual'] });
    queryClient.invalidateQueries({ queryKey: ['lojas'] });
  };

  const approveMutation = useMutation({
    mutationFn: async ({ mov, acao }) => {
      if (acao === 'aprovar') return aprovar(mov, lojas);
      return base44.entities.BancoVirtual.update(mov.id, { status: 'rejeitado' });
    },
    onSuccess: () => { invalidate(); toast.success('Operação atualizada!'); },
    onError: (e) => toast.error(e.message),
  });

  const cd = lojas.find(l => l.tipo === 'cd');
  const lojasOp = lojas.filter(l => l.tipo === 'loja');
  const totalDividas = lojasOp.reduce((s, l) => s + Math.abs(Math.min(0, l.saldo_banco_virtual || 0)), 0);
  const pendentes = movimentacoes.filter(m => m.status === 'pendente').length;

  const getLoja = (id) => lojas.find(l => l.id === id);

  const tipoLabel = {
    pagamento_boleto_cd: '💳 Pag. Boleto CD',
    venda_cd_loja: '🏪 Venda CD→Loja',
    transferencia: '↔ Transferência',
    deposito: '⬇ Depósito',
    saque: '⬆ Saque',
    ajuste: '⚙ Ajuste',
  };

  const columns = [
    {
      key: 'tipo', label: 'Operação',
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            value === 'pagamento_boleto_cd' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
            value === 'venda_cd_loja' ? 'bg-blue-100 dark:bg-blue-900/30' :
            'bg-slate-100 dark:bg-slate-800'
          }`}>
            {value === 'pagamento_boleto_cd' ? <ArrowDownRight className="w-4 h-4 text-emerald-600" /> :
             value === 'venda_cd_loja' ? <ArrowUpRight className="w-4 h-4 text-blue-600" /> :
             <ArrowLeftRight className="w-4 h-4 text-slate-500" />}
          </div>
          <div>
            <p className="font-medium text-slate-800 dark:text-white">{tipoLabel[value] || value}</p>
            <p className="text-xs text-slate-500">{format(new Date(row.created_date), 'dd/MM/yyyy HH:mm')}</p>
          </div>
        </div>
      )
    },
    {
      key: 'loja_origem_id', label: 'De',
      render: (v) => {
        const l = getLoja(v);
        if (!l) return '-';
        return <div className="flex items-center gap-1.5 text-sm">{l.tipo === 'cd' ? <Building2 className="w-4 h-4 text-indigo-500" /> : <Store className="w-4 h-4 text-teal-500" />}{l.nome}</div>;
      }
    },
    {
      key: 'loja_destino_id', label: 'Para',
      render: (v) => {
        const l = getLoja(v);
        if (!l) return '-';
        return <div className="flex items-center gap-1.5 text-sm">{l.tipo === 'cd' ? <Building2 className="w-4 h-4 text-indigo-500" /> : <Store className="w-4 h-4 text-teal-500" />}{l.nome}</div>;
      }
    },
    { key: 'valor', label: 'Valor', sortable: true, render: (v) => <MoneyDisplay value={v || 0} size="sm" /> },
    { key: 'descricao', label: 'Descrição', render: (v) => <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[180px] block">{v || '-'}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (v) => <StatusBadge status={v} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banco Virtual"
        subtitle="Dívidas das lojas com o CD e pagamentos de boletos"
        icon={PiggyBank}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Banco Virtual' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSplitModal(true)} className="gap-2">
              <SplitSquareHorizontal className="w-4 h-4" /> Split
            </Button>
            <Button onClick={() => setModalOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Nova Operação
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Saldo CD" value={formatMoney(cd?.saldo_banco_virtual || 0)} icon={Building2} variant="info" />
        <KPICard title="Total Dívidas Lojas" value={formatMoney(totalDividas)} icon={AlertTriangle} variant={totalDividas > 0 ? 'warning' : 'default'} subtitle="a cobrar do CD" />
        <KPICard title="Movimentações" value={movimentacoes.length} icon={ArrowLeftRight} variant="default" />
        <KPICard title="Pendentes" value={pendentes} icon={Clock} variant={pendentes > 0 ? 'warning' : 'default'} subtitle="aguardando aprovação" />
      </div>

      {/* Painel de Dívidas por Loja */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Dívida das Lojas com o CD</CardTitle>
        </CardHeader>
        <CardContent>
          {lojasOp.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma loja cadastrada.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {lojasOp.map((loja) => {
                const divida = Math.abs(Math.min(0, loja.saldo_banco_virtual || 0));
                const saldo = loja.saldo_banco_virtual || 0;
                const isDevendo = saldo < 0;
                return (
                  <div key={loja.id} className={`p-4 rounded-xl border ${isDevendo ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/10'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Store className={`w-4 h-4 ${isDevendo ? 'text-red-500' : 'text-emerald-500'}`} />
                      <span className="text-sm font-medium truncate">{loja.nome}</span>
                    </div>
                    <p className={`text-lg font-bold ${isDevendo ? 'text-red-600' : 'text-emerald-600'}`}>
                      {isDevendo ? `-${formatMoney(divida)}` : formatMoney(saldo)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{isDevendo ? 'deve ao CD' : 'crédito'}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela */}
      {movimentacoes.length === 0 && !isLoading ? (
        <EmptyState icon={PiggyBank} title="Nenhuma movimentação" description="Registre operações entre CD e lojas." actionLabel="Nova Operação" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable
          columns={columns}
          data={movimentacoes}
          loading={isLoading}
          searchPlaceholder="Buscar movimentações..."
          emptyIcon={PiggyBank}
          emptyTitle="Nenhuma movimentação encontrada"
          rowActions={(row) => row.status === 'pendente' ? [
            { label: 'Aprovar', icon: CheckCircle2, onClick: () => approveMutation.mutate({ mov: row, acao: 'aprovar' }) },
            { label: 'Rejeitar', icon: XCircle, onClick: () => approveMutation.mutate({ mov: row, acao: 'rejeitar' }), destructive: true },
          ] : []}
        />
      )}

      <NovaOperacaoModal open={modalOpen} onClose={() => setModalOpen(false)} lojas={lojas} onSuccess={invalidate} />
      <PagamentoSplitModal open={splitModal} onClose={() => setSplitModal(false)} lojas={lojas} onSuccess={invalidate} />
    </div>
  );
}