import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import MoneyDisplay from '@/components/ui-custom/MoneyDisplay';
import EmptyState from '@/components/ui-custom/EmptyState';
import KPICard from '@/components/ui-custom/KPICard';
import OperacaoContaModal from '@/components/contas/OperacaoContaModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CreditCard, Plus, Pencil, Trash2, Wallet, Vault, ArrowRightLeft, ArrowDownToLine, ArrowUpFromLine, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';

// ─── Helpers ─────────────────────────────────────────────────────
const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

// ─── Contas Bancárias + Extrato ──────────────────────────────────
function ContasBancariasTab() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [operacaoOpen, setOperacaoOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [extratoContaId, setExtratoContaId] = useState(null);
  const [formData, setFormData] = useState({
    nome: '', banco: '', agencia: '', conta: '', tipo: 'corrente', saldo_inicial: '', status: 'ativo'
  });

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['contasBancarias'],
    queryFn: () => base44.entities.ContaBancaria.list()
  });

  const { data: transacoes = [] } = useQuery({
    queryKey: ['transacoesBancarias'],
    queryFn: () => base44.entities.TransacaoBancaria.list('-data', 1000)
  });

  const { data: cofresDisponiveis = [] } = useQuery({
    queryKey: ['cofres'],
    queryFn: () => base44.entities.Cofre.list()
  });

  const calcularSaldoAtual = (contaId) => {
    const saldoInicial = contas.find(c => c.id === contaId)?.saldo_inicial || 0;
    return saldoInicial + transacoes
      .filter(t => t.conta_bancaria_id === contaId)
      .reduce((sum, t) => t.tipo === 'credito' ? sum + (t.valor || 0) : sum - Math.abs(t.valor || 0), 0);
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ContaBancaria.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contasBancarias'] }); setModalOpen(false); resetForm(); toast.success('Conta criada!'); },
    onError: () => toast.error('Erro ao criar')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ContaBancaria.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contasBancarias'] }); setModalOpen(false); resetForm(); toast.success('Conta atualizada!'); },
    onError: () => toast.error('Erro ao atualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContaBancaria.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contasBancarias'] })
  });

  const deleteTransacaoMutation = useMutation({
    mutationFn: (id) => base44.entities.TransacaoBancaria.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transacoesBancarias'] })
  });

  const resetForm = () => {
    setFormData({ nome: '', banco: '', agencia: '', conta: '', tipo: 'corrente', saldo_inicial: '', status: 'ativo' });
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({ nome: item.nome || '', banco: item.banco || '', agencia: item.agencia || '', conta: item.conta || '', tipo: item.tipo || 'corrente', saldo_inicial: item.saldo_inicial || '', status: item.status || 'ativo' });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...formData, saldo_inicial: parseFloat(formData.saldo_inicial) || 0 };
    if (editingItem) updateMutation.mutate({ id: editingItem.id, data });
    else createMutation.mutate(data);
  };

  const totalSaldo = contas.reduce((sum, c) => sum + calcularSaldoAtual(c.id), 0);
  const extratoConta = extratoContaId ? contas.find(c => c.id === extratoContaId) : null;
  const extratoTransacoes = extratoContaId
    ? [...transacoes.filter(t => t.conta_bancaria_id === extratoContaId)].sort((a, b) => b.data?.localeCompare(a.data))
    : [];

  const getTipoIcon = (tipo, categoria) => {
    if (categoria === 'transferencia') return <ArrowRightLeft className="w-4 h-4 text-blue-500" />;
    if (tipo === 'credito') return <ArrowDownToLine className="w-4 h-4 text-green-500" />;
    return <ArrowUpFromLine className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="space-y-4">
      {/* KPIs + botão */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="grid grid-cols-2 gap-4 flex-1 w-full">
          <KPICard title="Saldo Total" value={formatMoney(totalSaldo)} icon={Wallet} variant="success" subtitle={`${contas.length} contas`} />
          <KPICard title="Contas Ativas" value={contas.filter(c => c.status === 'ativo').length} icon={CreditCard} variant="info" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOperacaoOpen(true)} className="gap-2 whitespace-nowrap">
            <ArrowRightLeft className="w-4 h-4" /> Operação
          </Button>
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2 whitespace-nowrap">
            <Plus className="w-4 h-4" /> Nova Conta
          </Button>
        </div>
      </div>

      {/* Lista de contas com extrato expansível */}
      {contas.length === 0 && !isLoading ? (
        <EmptyState icon={CreditCard} title="Nenhuma conta" description="Cadastre suas contas bancárias." actionLabel="Criar" onAction={() => setModalOpen(true)} />
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-medium w-8"></th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Conta</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Tipo</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Saldo Inicial</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Saldo Atual</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">Status</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {contas.map(conta => {
                const isOpen = extratoContaId === conta.id;
                const saldo = calcularSaldoAtual(conta.id);
                const movsConta = transacoes.filter(t => t.conta_bancaria_id === conta.id);
                return (
                  <React.Fragment key={conta.id}>
                    <tr className={`border-b hover:bg-slate-50 cursor-pointer ${isOpen ? 'bg-blue-50' : ''}`} onClick={() => setExtratoContaId(isOpen ? null : conta.id)}>
                      <td className="px-4 py-3 text-slate-400">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{conta.nome}</p>
                        <p className="text-xs text-slate-500">{conta.banco} • {conta.agencia}/{conta.conta}</p>
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600">{conta.tipo?.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-right"><MoneyDisplay value={conta.saldo_inicial} size="sm" /></td>
                      <td className="px-4 py-3 text-right"><MoneyDisplay value={saldo} size="sm" colorize /></td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={conta.status} size="sm" /></td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(conta)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteMutation.mutate(conta.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    </tr>

                    {/* Extrato inline */}
                    {isOpen && (
                      <tr>
                        <td colSpan={7} className="bg-blue-50 px-6 py-4 border-b">
                          <p className="text-xs font-semibold text-blue-700 mb-3 uppercase tracking-wide">
                            Extrato — {conta.nome} ({movsConta.length} lançamentos)
                          </p>
                          {extratoTransacoes.length === 0 ? (
                            <p className="text-sm text-slate-400 py-2">Nenhum lançamento registrado.</p>
                          ) : (
                            <div className="space-y-1 max-h-60 overflow-y-auto">
                              {extratoTransacoes.map(t => (
                                <div key={t.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm border border-slate-100">
                                  <div className="flex items-center gap-3">
                                    {getTipoIcon(t.tipo, t.categoria)}
                                    <div>
                                      <p className="font-medium text-slate-700">{t.descricao || (t.tipo === 'credito' ? 'Crédito' : 'Débito')}</p>
                                      <p className="text-xs text-slate-400">{t.data ? format(new Date(t.data + 'T00:00:00'), "dd 'de' MMM yyyy", { locale: ptBR }) : '-'}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`font-bold ${t.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                                      {t.tipo === 'credito' ? '+' : '-'}{fmt(t.valor)}
                                    </span>
                                    <Button size="sm" variant="ghost" className="text-red-400 h-6 w-6 p-0" onClick={() => deleteTransacaoMutation.mutate(t.id)}>
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nova conta */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? 'Editar' : 'Nova Conta'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Banco *</Label><Input value={formData.banco} onChange={e => setFormData({ ...formData, banco: e.target.value })} required /></div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={formData.tipo} onValueChange={v => setFormData({ ...formData, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                    <SelectItem value="investimento">Investimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Agência</Label><Input value={formData.agencia} onChange={e => setFormData({ ...formData, agencia: e.target.value })} /></div>
              <div className="space-y-2"><Label>Conta</Label><Input value={formData.conta} onChange={e => setFormData({ ...formData, conta: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Saldo Inicial</Label><Input type="number" step="0.01" value={formData.saldo_inicial} onChange={e => setFormData({ ...formData, saldo_inicial: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editingItem ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de operação */}
      <OperacaoContaModal open={operacaoOpen} onClose={() => setOperacaoOpen(false)} contas={contas} cofres={cofresDisponiveis} />
    </div>
  );
}

// ─── Movimentações Bancárias ─────────────────────────────────────
function MovimentacoesTab() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    conta_bancaria_id: '', data: '', valor: '', tipo: 'credito', descricao: '', memo: '', status: 'pendente'
  });

  const { data: transacoes = [], isLoading } = useQuery({
    queryKey: ['transacoesBancarias'],
    queryFn: () => base44.entities.TransacaoBancaria.list('-data', 200)
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['contasBancarias'],
    queryFn: () => base44.entities.ContaBancaria.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TransacaoBancaria.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['transacoesBancarias'] }); setModalOpen(false); resetForm(); toast.success('Transação registrada!'); },
    onError: () => toast.error('Erro ao registrar')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TransacaoBancaria.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['transacoesBancarias'] }); setModalOpen(false); resetForm(); toast.success('Atualizado!'); },
    onError: () => toast.error('Erro ao atualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TransacaoBancaria.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['transacoesBancarias'] }); toast.success('Excluído!'); }
  });

  const resetForm = () => {
    setFormData({ conta_bancaria_id: '', data: '', valor: '', tipo: 'credito', descricao: '', memo: '', status: 'pendente' });
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({ conta_bancaria_id: item.conta_bancaria_id || '', data: item.data || '', valor: item.valor || '', tipo: item.tipo || 'credito', descricao: item.descricao || '', memo: item.memo || '', status: item.status || 'pendente' });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...formData, valor: parseFloat(formData.valor) };
    if (editingItem) updateMutation.mutate({ id: editingItem.id, data });
    else createMutation.mutate(data);
  };

  const getContaNome = (id) => contas.find(c => c.id === id)?.nome || '-';

  const columns = [
    { key: 'data', label: 'Data', sortable: true, render: (v) => <span className="text-sm">{v ? format(new Date(v + 'T00:00:00'), 'dd/MM/yyyy') : '-'}</span> },
    { key: 'conta_bancaria_id', label: 'Conta', render: (v) => <span className="text-sm text-slate-600">{getContaNome(v)}</span> },
    { key: 'descricao', label: 'Descrição', render: (v) => <span className="text-sm text-slate-600">{v || '-'}</span> },
    { key: 'valor', label: 'Valor', render: (v, row) => <MoneyDisplay value={row.tipo === 'debito' ? -v : v} size="sm" colorize /> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} size="sm" /> }
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Transação
        </Button>
      </div>

      {transacoes.length === 0 && !isLoading ? (
        <EmptyState icon={ArrowRightLeft} title="Sem transações" description="Registre movimentações manualmente." actionLabel="Criar" onAction={() => setModalOpen(true)} />
      ) : (
        <DataTable columns={columns} data={transacoes} loading={isLoading} searchPlaceholder="Buscar transação..." rowActions={(row) => [
          { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) },
          { label: 'Excluir', icon: Trash2, onClick: () => deleteMutation.mutate(row.id), destructive: true }
        ]} />
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? 'Editar' : 'Nova Movimentação'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Conta Bancária *</Label>
              <Select value={formData.conta_bancaria_id} onValueChange={v => setFormData({ ...formData, conta_bancaria_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Data *</Label><Input type="date" value={formData.data} onChange={e => setFormData({ ...formData, data: e.target.value })} required /></div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={formData.tipo} onValueChange={v => setFormData({ ...formData, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credito">Crédito</SelectItem>
                    <SelectItem value="debito">Débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Valor *</Label><Input type="number" step="0.01" value={formData.valor} onChange={e => setFormData({ ...formData, valor: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Descrição *</Label><Input value={formData.descricao} onChange={e => setFormData({ ...formData, descricao: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Memo (OFX)</Label><Textarea value={formData.memo} onChange={e => setFormData({ ...formData, memo: e.target.value })} rows={2} /></div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="conciliado">Conciliado</SelectItem>
                  <SelectItem value="ignorado">Ignorado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editingItem ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Cofres ──────────────────────────────────────────────────────
function CofresTab() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ nome: '', tipo: 'loja', loja_id: '', saldo_inicial: 0, status: 'ativo' });
  const [transCofreOpen, setTransCofreOpen] = useState(false);
  const [transForm, setTransForm] = useState({ cofre_origem_id: '', cofre_destino_id: '', valor: '', data: new Date().toISOString().split('T')[0], motivo: '' });

  const [extratoCofreId, setExtratoCofreId] = useState(null);

  const { data: cofres = [], isLoading } = useQuery({
    queryKey: ['cofres'],
    queryFn: () => base44.entities.Cofre.list()
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['movimentacoesCofre'],
    queryFn: () => base44.entities.MovimentacaoCofre.list('-data', 1000)
  });

  const deleteMov = useMutation({
    mutationFn: (id) => base44.entities.MovimentacaoCofre.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['movimentacoesCofre'] })
  });

  const transCofreMutation = useMutation({
    mutationFn: async (data) => {
      const valor = parseFloat(data.valor);
      const nomeOrigem = cofres.find(c => c.id === data.cofre_origem_id)?.nome || '';
      const nomeDestino = cofres.find(c => c.id === data.cofre_destino_id)?.nome || '';
      await base44.entities.MovimentacaoCofre.create({
        cofre_id: data.cofre_origem_id, cofre_destino_id: data.cofre_destino_id,
        tipo: 'saida', valor, data: data.data,
        motivo: data.motivo || `Transferência para ${nomeDestino}`,
        referencia_tipo: 'manual'
      });
      await base44.entities.MovimentacaoCofre.create({
        cofre_id: data.cofre_destino_id, cofre_destino_id: data.cofre_origem_id,
        tipo: 'entrada', valor, data: data.data,
        motivo: data.motivo || `Transferência de ${nomeOrigem}`,
        referencia_tipo: 'manual'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimentacoesCofre'] });
      toast.success('Transferência entre cofres registrada!');
      setTransCofreOpen(false);
      setTransForm({ cofre_origem_id: '', cofre_destino_id: '', valor: '', data: new Date().toISOString().split('T')[0], motivo: '' });
    },
    onError: () => toast.error('Erro ao registrar transferência')
  });

  const calcularSaldoCofre = (cofreId) => {
    const cofre = cofres.find(c => c.id === cofreId);
    const saldoInicial = cofre?.saldo_inicial || 0;
    return saldoInicial + movimentacoes
      .filter(m => m.cofre_id === cofreId)
      .reduce((sum, m) => m.tipo === 'entrada' ? sum + (m.valor || 0) : sum - Math.abs(m.valor || 0), 0);
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Cofre.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cofres'] }); setModalOpen(false); resetForm(); toast.success('Cofre criado!'); },
    onError: () => toast.error('Erro ao criar')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cofre.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cofres'] }); setModalOpen(false); resetForm(); toast.success('Cofre atualizado!'); },
    onError: () => toast.error('Erro ao atualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Cofre.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cofres'] })
  });

  const resetForm = () => { setFormData({ nome: '', tipo: 'loja', loja_id: '', saldo_inicial: 0, status: 'ativo' }); setEditingItem(null); };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({ nome: item.nome || '', tipo: item.tipo || 'loja', loja_id: item.loja_id || '', saldo_inicial: item.saldo_inicial || 0, status: item.status || 'ativo' });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingItem) updateMutation.mutate({ id: editingItem.id, data: formData });
    else createMutation.mutate(formData);
  };

  const getLojaName = (id) => lojas.find(l => l.id === id)?.nome || '-';
  const totalCofres = cofres.reduce((sum, c) => sum + calcularSaldoCofre(c.id), 0);

  const getMovIcon = (tipo) => {
    if (tipo === 'entrada') return <ArrowDownToLine className="w-4 h-4 text-green-500" />;
    if (tipo === 'saida') return <ArrowUpFromLine className="w-4 h-4 text-red-500" />;
    return <ArrowRightLeft className="w-4 h-4 text-blue-500" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="grid grid-cols-2 gap-4 flex-1 w-full">
          <KPICard title="Total em Cofres" value={formatMoney(totalCofres)} icon={Vault} variant="warning" subtitle={`${cofres.length} cofres`} />
          <KPICard title="Cofres Ativos" value={cofres.filter(c => c.status === 'ativo').length} icon={Vault} variant="info" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTransCofreOpen(true)} className="gap-2 whitespace-nowrap">
            <ArrowRightLeft className="w-4 h-4" /> Transferir entre Cofres
          </Button>
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2 whitespace-nowrap">
            <Plus className="w-4 h-4" /> Novo Cofre
          </Button>
        </div>
      </div>

      {cofres.length === 0 && !isLoading ? (
        <EmptyState icon={Vault} title="Nenhum cofre" description="Cadastre seus cofres de loja e central." actionLabel="Criar" onAction={() => setModalOpen(true)} />
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-medium w-8"></th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Cofre</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Tipo</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Saldo Inicial</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Saldo Atual</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">Status</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {cofres.map(cofre => {
                const isOpen = extratoCofreId === cofre.id;
                const saldo = calcularSaldoCofre(cofre.id);
                const movsCofre = [...movimentacoes.filter(m => m.cofre_id === cofre.id)].sort((a, b) => b.data?.localeCompare(a.data));
                return (
                  <React.Fragment key={cofre.id}>
                    <tr className={`border-b hover:bg-slate-50 cursor-pointer ${isOpen ? 'bg-amber-50' : ''}`} onClick={() => setExtratoCofreId(isOpen ? null : cofre.id)}>
                      <td className="px-4 py-3 text-slate-400">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{cofre.nome}</p>
                        <p className="text-xs text-slate-500">{cofre.tipo === 'central' ? 'Central' : getLojaName(cofre.loja_id)}</p>
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600">{cofre.tipo === 'central' ? 'Central' : 'Loja'}</td>
                      <td className="px-4 py-3 text-right"><MoneyDisplay value={cofre.saldo_inicial || 0} size="sm" /></td>
                      <td className="px-4 py-3 text-right"><MoneyDisplay value={saldo} size="sm" colorize /></td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={cofre.status} size="sm" /></td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(cofre)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteMutation.mutate(cofre.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={7} className="bg-amber-50 px-6 py-4 border-b">
                          <p className="text-xs font-semibold text-amber-700 mb-3 uppercase tracking-wide">
                            Extrato — {cofre.nome} ({movsCofre.length} lançamentos)
                          </p>
                          {movsCofre.length === 0 ? (
                            <p className="text-sm text-slate-400 py-2">Nenhum lançamento registrado.</p>
                          ) : (
                            <div className="space-y-1 max-h-60 overflow-y-auto">
                              {movsCofre.map(m => (
                                <div key={m.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm border border-slate-100">
                                  <div className="flex items-center gap-3">
                                    {getMovIcon(m.tipo)}
                                    <div>
                                      <p className="font-medium text-slate-700">{m.motivo || m.tipo}</p>
                                      <p className="text-xs text-slate-400">{m.data ? format(new Date(m.data + 'T00:00:00'), "dd 'de' MMM yyyy", { locale: ptBR }) : '-'}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`font-bold ${m.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                                      {m.tipo === 'entrada' ? '+' : '-'}{fmt(m.valor)}
                                    </span>
                                    <Button size="sm" variant="ghost" className="text-red-400 h-6 w-6 p-0" onClick={() => deleteMov.mutate(m.id)}>
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Transferência entre Cofres */}
      <Dialog open={transCofreOpen} onOpenChange={setTransCofreOpen}>
        <DialogContent className="max-w-md w-[95vw]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-blue-500" />Transferência entre Cofres</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); if (!transForm.cofre_origem_id || !transForm.cofre_destino_id || !transForm.valor) { toast.error('Preencha todos os campos'); return; } if (transForm.cofre_origem_id === transForm.cofre_destino_id) { toast.error('Origem e destino devem ser diferentes'); return; } transCofreMutation.mutate(transForm); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Cofre origem *</Label>
              <Select value={transForm.cofre_origem_id} onValueChange={v => setTransForm({ ...transForm, cofre_origem_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{cofres.filter(c => c.status === 'ativo').map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cofre destino *</Label>
              <Select value={transForm.cofre_destino_id} onValueChange={v => setTransForm({ ...transForm, cofre_destino_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{cofres.filter(c => c.status === 'ativo' && c.id !== transForm.cofre_origem_id).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor *</Label>
                <Input type="number" step="0.01" min="0.01" placeholder="0,00" value={transForm.valor} onChange={e => setTransForm({ ...transForm, valor: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={transForm.data} onChange={e => setTransForm({ ...transForm, data: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Input placeholder="Descrição opcional..." value={transForm.motivo} onChange={e => setTransForm({ ...transForm, motivo: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTransCofreOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={transCofreMutation.isPending} className="bg-blue-600 hover:bg-blue-700 gap-2">
                {transCofreMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}Confirmar Transferência
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? 'Editar Cofre' : 'Novo Cofre'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} required /></div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={formData.tipo} onValueChange={v => setFormData({ ...formData, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="loja">Loja</SelectItem>
                  <SelectItem value="central">Central</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.tipo === 'loja' && (
              <div className="space-y-2">
                <Label>Loja</Label>
                <Select value={formData.loja_id} onValueChange={v => setFormData({ ...formData, loja_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Saldo Inicial *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={formData.saldo_inicial}
                onChange={e => setFormData({ ...formData, saldo_inicial: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editingItem ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────
export default function ContasBancarias() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas Bancárias & Cofres"
        subtitle="Saldos, extratos, transferências, depósitos e saques em um só lugar"
        icon={CreditCard}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Financeiro' }, { label: 'Contas & Cofres' }]}
      />

      <Tabs defaultValue="contas">
        <TabsList>
          <TabsTrigger value="contas" className="gap-2">
            <CreditCard className="w-4 h-4" />Contas Bancárias
          </TabsTrigger>
          <TabsTrigger value="cofres" className="gap-2">
            <Vault className="w-4 h-4" />Cofres
          </TabsTrigger>
          <TabsTrigger value="movimentacoes" className="gap-2">
            <ArrowRightLeft className="w-4 h-4" />Movimentações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contas" className="mt-4">
          <ContasBancariasTab />
        </TabsContent>

        <TabsContent value="cofres" className="mt-4">
          <CofresTab />
        </TabsContent>

        <TabsContent value="movimentacoes" className="mt-4">
          <MovimentacoesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}