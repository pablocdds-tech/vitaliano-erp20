import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import MoneyDisplay, { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import EmptyState from '@/components/ui-custom/EmptyState';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Landmark, Upload, Loader2, CheckCircle2, EyeOff, Link2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';

// Parse OFX simples (extrai STMTTRN tags)
function parseOFX(text) {
  const txns = [];
  const stmtRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  while ((match = stmtRe.exec(text)) !== null) {
    const block = match[1];
    const get = (tag) => { const m = new RegExp(`<${tag}>([^<\n]+)`).exec(block); return m ? m[1].trim() : ''; };
    const dtposted = get('DTPOSTED');
    const trnamt = parseFloat(get('TRNAMT') || '0');
    const fitid = get('FITID');
    const memo = get('MEMO') || get('NAME') || '';
    const trntype = get('TRNTYPE'); // CREDIT/DEBIT
    if (!fitid) continue;
    // Parse data YYYYMMDD[HHMMSS]
    const dateStr = dtposted.substring(0, 8);
    const year = dateStr.substring(0, 4), month = dateStr.substring(4, 6), day = dateStr.substring(6, 8);
    txns.push({
      fit_id: fitid,
      data: `${year}-${month}-${day}`,
      valor: trnamt,
      descricao: memo,
      memo,
      tipo: trnamt >= 0 ? 'credito' : 'debito',
      status: 'pendente',
    });
  }
  return txns;
}

export default function MovimentacoesBancarias() {
  const qc = useQueryClient();
  const fileRef = useRef();
  const [contaFiltro, setContaFiltro] = useState('all');
  const [statusFiltro, setStatusFiltro] = useState('all');
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [importing, setImporting] = useState(false);
  const [importConta, setImportConta] = useState('');
  const [importDialog, setImportDialog] = useState(false);
  const [conciliarModal, setConciliarModal] = useState(null);
  const [conciliarForm, setConciliarForm] = useState({ tipo: 'conta_receber', id: '' });

  const { data: transacoes = [], isLoading } = useQuery({ queryKey: ['transacoes-banco'], queryFn: () => base44.entities.TransacaoBancaria.list('-data', 500) });
  const { data: contas = [] } = useQuery({ queryKey: ['contas-bancarias'], queryFn: () => base44.entities.ContaBancaria.list('nome') });
  const { data: contasReceber = [] } = useQuery({ queryKey: ['contas-receber'], queryFn: () => base44.entities.ContaReceber.filter({ status: 'pendente' }, '-data_vencimento', 200) });
  const { data: contasPagar = [] } = useQuery({ queryKey: ['contas-pagar'], queryFn: () => base44.entities.ContaPagar.filter({ status: 'pendente' }, '-data_vencimento', 200) });
  const { data: movsCofre = [] } = useQuery({ queryKey: ['movs-cofre'], queryFn: () => base44.entities.MovimentacaoCofre.list('-data', 200) });

  const updateTx = useMutation({
    mutationFn: ({ id, d }) => base44.entities.TransacaoBancaria.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transacoes-banco'] }); qc.invalidateQueries({ queryKey: ['contas-bancarias'] }); }
  });

  const getContaNome = (id) => contas.find(c => c.id === id)?.nome || '-';

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !importConta) { toast.error('Selecione a conta bancária.'); return; }
    setImporting(true);
    try {
      const text = await file.text();
      const txns = parseOFX(text);
      if (txns.length === 0) { toast.error('Nenhuma transação encontrada. Verifique o formato OFX.'); setImporting(false); return; }

      // Idempotência: buscar fit_ids já existentes para esta conta
      const existentes = transacoes.filter(t => t.conta_bancaria_id === importConta).map(t => t.fit_id);

      let novas = 0;
      for (const tx of txns) {
        if (existentes.includes(tx.fit_id)) continue;
        await base44.entities.TransacaoBancaria.create({ ...tx, conta_bancaria_id: importConta });
        novas++;
      }
      qc.invalidateQueries({ queryKey: ['transacoes-banco'] });
      toast.success(`${novas} transações importadas (${txns.length - novas} duplicatas ignoradas).`);
      setImportDialog(false);
    } catch (err) {
      toast.error('Erro ao importar: ' + err.message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleConciliar = async () => {
    const tx = conciliarModal;
    if (!conciliarForm.id) { toast.error('Selecione o item para conciliar.'); return; }
    await updateTx.mutateAsync({ id: tx.id, d: {
      status: 'conciliado',
      conciliado_com_tipo: conciliarForm.tipo,
      conciliado_com_id: conciliarForm.id,
      conciliado_em: new Date().toISOString(),
    }});
    // Marcar o item como recebido/pago conforme o tipo
    if (conciliarForm.tipo === 'conta_receber') {
      await base44.entities.ContaReceber.update(conciliarForm.id, { status: 'recebido', data_recebimento: tx.data, valor_recebido: Math.abs(tx.valor) });
    } else if (conciliarForm.tipo === 'conta_pagar') {
      await base44.entities.ContaPagar.update(conciliarForm.id, { status: 'pago', data_pagamento: tx.data, valor_pago: Math.abs(tx.valor) });
    }
    qc.invalidateQueries({ queryKey: ['contas-receber'] });
    qc.invalidateQueries({ queryKey: ['contas-pagar'] });
    toast.success('Conciliado com sucesso!');
    setConciliarModal(null);
  };

  const filtradas = transacoes.filter(t => {
    if (contaFiltro !== 'all' && t.conta_bancaria_id !== contaFiltro) return false;
    if (statusFiltro !== 'all' && t.status !== statusFiltro) return false;
    if (dataInicio && t.data < dataInicio) return false;
    if (dataFim && t.data > dataFim) return false;
    return true;
  });

  const pendentes = filtradas.filter(t => t.status === 'pendente').length;
  const totalCredito = filtradas.filter(t => t.valor > 0).reduce((s, t) => s + t.valor, 0);
  const totalDebito = filtradas.filter(t => t.valor < 0).reduce((s, t) => s + t.valor, 0);

  const columns = [
    { key: 'data', label: 'Data', sortable: true, render: v => <span className="text-sm font-medium">{v ? format(new Date(v + 'T12:00:00'), 'dd/MM/yyyy') : '-'}</span> },
    { key: 'conta_bancaria_id', label: 'Conta', render: v => <span className="text-xs text-slate-500">{getContaNome(v)}</span> },
    { key: 'descricao', label: 'Descrição', render: v => <span className="text-sm">{v}</span> },
    {
      key: 'valor', label: 'Valor', sortable: true,
      render: v => <span className={`font-semibold text-sm ${v >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{v >= 0 ? '+' : ''}{formatMoney(v)}</span>
    },
    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} customLabel={v === 'conciliado' ? 'Conciliado' : v === 'ignorado' ? 'Ignorado' : 'Pendente'} /> },
  ];

  const optionsConciliar = {
    conta_receber: contasReceber,
    conta_pagar: contasPagar,
    cofre: movsCofre,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movimentações Bancárias"
        subtitle="Importe OFX e concilie transações com contas a receber/pagar"
        icon={Landmark}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Movimentações Bancárias' }]}
        actions={
          <Button className="gap-2" onClick={() => setImportDialog(true)}>
            <Upload className="w-4 h-4" />Importar OFX
          </Button>
        }
      />

      {/* KPIs rápidos */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200">
          <p className="text-xs text-slate-500 mb-1">Créditos no período</p>
          <p className="text-xl font-bold text-emerald-600">{formatMoney(totalCredito)}</p>
        </div>
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200">
          <p className="text-xs text-slate-500 mb-1">Débitos no período</p>
          <p className="text-xl font-bold text-red-600">{formatMoney(Math.abs(totalDebito))}</p>
        </div>
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200">
          <p className="text-xs text-slate-500 mb-1">Pendentes de conciliação</p>
          <p className="text-xl font-bold text-amber-600">{pendentes}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select value={contaFiltro} onValueChange={setContaFiltro}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todas as contas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Todos os status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="conciliado">Conciliado</SelectItem>
            <SelectItem value="ignorado">Ignorado</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-40" />
        <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-40" />
      </div>

      {transacoes.length === 0 && !isLoading ? (
        <EmptyState icon={Landmark} title="Nenhuma transação importada" description="Importe um arquivo OFX do seu banco para começar." actionLabel="Importar OFX" onAction={() => setImportDialog(true)} />
      ) : (
        <DataTable
          columns={columns} data={filtradas} loading={isLoading}
          searchPlaceholder="Buscar transações..."
          rowActions={row => [
            ...(row.status === 'pendente' ? [
              { label: 'Conciliar', icon: Link2, onClick: () => { setConciliarModal(row); setConciliarForm({ tipo: 'conta_receber', id: '' }); } },
              { label: 'Ignorar', icon: EyeOff, onClick: () => { if (confirm('Ignorar esta transação?')) updateTx.mutate({ id: row.id, d: { status: 'ignorado' } }); } },
            ] : []),
            ...(row.status === 'conciliado' ? [{ label: 'Desfazer Conciliação', icon: CheckCircle2, onClick: () => updateTx.mutate({ id: row.id, d: { status: 'pendente', conciliado_com_id: null, conciliado_com_tipo: null } }) }] : []),
          ]}
        />
      )}

      {/* Dialog importar OFX */}
      <Dialog open={importDialog} onOpenChange={v => !importing && setImportDialog(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Upload className="w-5 h-5" />Importar OFX</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Conta Bancária *</Label>
              <Select value={importConta} onValueChange={setImportConta}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
                <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Arquivo OFX</Label>
              <input ref={fileRef} type="file" accept=".ofx,.OFX" onChange={handleFileImport} disabled={importing || !importConta} className="block w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed" />
              <p className="text-xs text-slate-400">Apenas arquivos .OFX. Duplicatas são ignoradas automaticamente.</p>
            </div>
            {importing && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" />Importando...</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialog(false)} disabled={importing}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog conciliar */}
      <Dialog open={!!conciliarModal} onOpenChange={() => setConciliarModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Link2 className="w-5 h-5" />Conciliar Transação</DialogTitle></DialogHeader>
          {conciliarModal && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <p className="text-sm font-medium">{conciliarModal.descricao}</p>
                <p className="text-xs text-slate-500">{conciliarModal.data} • <span className={conciliarModal.valor >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatMoney(conciliarModal.valor)}</span></p>
              </div>
              <div className="space-y-1">
                <Label>Conciliar com</Label>
                <Select value={conciliarForm.tipo} onValueChange={v => setConciliarForm({ tipo: v, id: '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conta_receber">Conta a Receber</SelectItem>
                    <SelectItem value="conta_pagar">Conta a Pagar</SelectItem>
                    <SelectItem value="cofre">Movimentação de Cofre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Item</Label>
                <Select value={conciliarForm.id} onValueChange={v => setConciliarForm({ ...conciliarForm, id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {(optionsConciliar[conciliarForm.tipo] || []).map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.descricao || item.motivo || `R$ ${item.valor || item.valor_original}`}
                        {(item.valor_original || item.valor) ? ` — ${formatMoney(item.valor_original || item.valor)}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConciliarModal(null)}>Cancelar</Button>
                <Button onClick={handleConciliar} disabled={!conciliarForm.id}>Confirmar Conciliação</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}