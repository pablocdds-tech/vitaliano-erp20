import React, { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardCheck, Plus, Trash2, Eye, CheckCircle2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const ORIGENS = [
  { value: 'caixa_loja', label: '🏪 Saiu do Caixa da Loja (durante expediente)' },
  { value: 'cofre_loja', label: '🔒 Saiu do Cofre da Loja (após fechar)' },
  { value: 'cofre_central', label: '🏛️ Saiu do Cofre Central' },
];
const FORMAS = ['dinheiro', 'pix', 'transferencia', 'cartao', 'outros'];
const EMPTY_SAIDA = () => ({ _k: Math.random(), descricao: '', valor: 0, origem_dinheiro: 'caixa_loja', forma: 'dinheiro', observacao: '' });

export default function AuditoriaDodia() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState({ loja_id: '', data: format(new Date(), 'yyyy-MM-dd'), papel_faturamento_obs: '', conferido_por: '' });
  const [saidas, setSaidas] = useState([EMPTY_SAIDA()]);
  const [saving, setSaving] = useState(false);

  const { data: auditorias = [], isLoading } = useQuery({ queryKey: ['auditorias'], queryFn: () => base44.entities.AuditoriaDodia.list('-data', 100) });
  const { data: lojas = [] } = useQuery({ queryKey: ['lojas'], queryFn: () => base44.entities.Loja.list() });
  const { data: fechamentos = [] } = useQuery({ queryKey: ['fechamentos'], queryFn: () => base44.entities.Venda.list('-data', 100) });

  const getLoja = (id) => lojas.find(l => l.id === id);
  const getFechamentoDia = (lojaId, data) => fechamentos.find(f => f.loja_id === lojaId && f.data === data);

  const updateMut = useMutation({
    mutationFn: ({ id, d }) => base44.entities.AuditoriaDodia.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auditorias'] }); toast.success('Auditoria conferida!'); }
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.AuditoriaDodia.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auditorias'] }); }
  });

  const openNovo = () => {
    setViewing(null);
    setForm({ loja_id: '', data: format(new Date(), 'yyyy-MM-dd'), papel_faturamento_obs: '', conferido_por: '' });
    setSaidas([EMPTY_SAIDA()]);
    setModalOpen(true);
  };

  const openVer = (row) => { setViewing(row); setModalOpen(true); };

  const totalSaidas = saidas.reduce((s, x) => s + (parseFloat(x.valor) || 0), 0);
  const fechamentoDia = getFechamentoDia(form.loja_id, form.data);
  const totalEntradas = fechamentoDia?.valor_bruto || 0;
  const totalLiquido = fechamentoDia?.valor_liquido || 0;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.loja_id) { toast.error('Selecione a loja'); return; }
    setSaving(true);
    const saidasValidas = saidas.filter(s => s.descricao && s.valor > 0);
    const totalSaidasVal = saidasValidas.reduce((s, x) => s + x.valor, 0);
    try {
      await base44.entities.AuditoriaDodia.create({
        ...form,
        fechamento_id: fechamentoDia?.id || null,
        total_entradas_bruto: totalEntradas,
        total_entradas_liquido: totalLiquido,
        total_saidas: totalSaidasVal,
        saldo_fisico_esperado: totalEntradas - totalSaidasVal,
        saidas: saidasValidas,
        status: 'draft',
      });
      qc.invalidateQueries({ queryKey: ['auditorias'] });
      toast.success('Auditoria salva!');
      setModalOpen(false);
    } catch (err) { toast.error('Erro: ' + err.message); }
    finally { setSaving(false); }
  };

  const handleConferir = (row) => {
    const nome = prompt('Conferido por (seu nome):');
    if (!nome) return;
    updateMut.mutate({ id: row.id, d: { status: 'conferido', conferido_por: nome } });
  };

  const columns = [
    { key: 'data', label: 'Data', sortable: true, render: v => <span className="font-medium">{v ? format(new Date(v + 'T12:00:00'), 'dd/MM/yyyy') : '-'}</span> },
    { key: 'loja_id', label: 'Loja', render: v => <span>{getLoja(v)?.nome || '-'}</span> },
    { key: 'total_entradas_bruto', label: 'Entradas (bruto)', render: v => <MoneyDisplay value={v || 0} size="sm" /> },
    { key: 'total_saidas', label: 'Saídas', render: v => <span className="text-red-600 font-medium">{formatMoney(v || 0)}</span> },
    { key: 'saldo_fisico_esperado', label: 'Saldo Esperado', render: v => <MoneyDisplay value={v || 0} size="sm" colorize /> },
    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} customLabel={v === 'conferido' ? 'Conferido' : 'Rascunho'} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoria do Dia"
        subtitle="Conferência diária por loja: entradas, saídas e saldo físico esperado"
        icon={ClipboardCheck}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Auditoria do Dia' }]}
        actions={<Button className="gap-2" onClick={openNovo}><Plus className="w-4 h-4" />Nova Auditoria</Button>}
      />

      {auditorias.length === 0 && !isLoading ? (
        <EmptyState icon={ClipboardCheck} title="Nenhuma auditoria registrada" description="Registre a auditoria do dia para conferir entradas, saídas e saldo físico." actionLabel="Nova Auditoria" onAction={openNovo} />
      ) : (
        <DataTable
          columns={columns} data={auditorias} loading={isLoading}
          searchPlaceholder="Buscar auditorias..."
          rowActions={row => [
            { label: 'Visualizar', icon: Eye, onClick: () => openVer(row) },
            ...(row.status === 'draft' ? [{ label: 'Marcar Conferido', icon: CheckCircle2, onClick: () => handleConferir(row) }] : []),
            { label: 'Excluir', icon: Trash2, onClick: () => { if (confirm('Excluir?')) deleteMut.mutate(row.id); }, destructive: true }
          ]}
        />
      )}

      {/* Modal Novo / Visualizar */}
      <Dialog open={modalOpen} onOpenChange={() => setModalOpen(false)}>
        <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5" />
              {viewing ? `Auditoria — ${viewing.data ? format(new Date(viewing.data + 'T12:00:00'), 'dd/MM/yyyy') : ''}` : 'Nova Auditoria do Dia'}
            </DialogTitle>
          </DialogHeader>

          {/* MODO VISUALIZAÇÃO */}
          {viewing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20">
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-slate-500 mb-1">Entradas Brutas</p>
                    <p className="text-lg font-bold text-emerald-700">{formatMoney(viewing.total_entradas_bruto || 0)}</p>
                  </CardContent>
                </Card>
                <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-slate-500 mb-1">Saídas</p>
                    <p className="text-lg font-bold text-red-700">{formatMoney(viewing.total_saidas || 0)}</p>
                  </CardContent>
                </Card>
                <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-slate-500 mb-1">Saldo Esperado</p>
                    <p className="text-lg font-bold text-blue-700">{formatMoney(viewing.saldo_fisico_esperado || 0)}</p>
                  </CardContent>
                </Card>
              </div>
              {viewing.saidas?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Saídas registradas</p>
                  <div className="space-y-2">
                    {viewing.saidas.map((s, i) => (
                      <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                        <div>
                          <p className="text-sm font-medium">{s.descricao}</p>
                          <p className="text-xs text-slate-500">{ORIGENS.find(o => o.value === s.origem_dinheiro)?.label} • {s.forma}</p>
                        </div>
                        <span className="text-sm font-semibold text-red-600">- {formatMoney(s.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {viewing.papel_faturamento_obs && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Obs. do Papel de Faturamento</p>
                  <p className="text-sm text-slate-700">{viewing.papel_faturamento_obs}</p>
                </div>
              )}
              <div className="flex justify-between text-sm text-slate-500">
                <span>Status: <StatusBadge status={viewing.status} /></span>
                {viewing.conferido_por && <span>Conferido por: <strong>{viewing.conferido_por}</strong></span>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setModalOpen(false)}>Fechar</Button>
              </DialogFooter>
            </div>
          ) : (
            /* MODO NOVO */
            <form onSubmit={handleSave}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1">
                  <Label>Loja *</Label>
                  <Select value={form.loja_id} onValueChange={v => setForm({ ...form, loja_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Data *</Label>
                  <Input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} required />
                </div>
              </div>

              {/* Entradas do fechamento */}
              {form.loja_id && form.data && (
                <Card className="mb-4 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20">
                  <CardContent className="pt-4">
                    <p className="text-xs font-semibold text-emerald-700 uppercase mb-2 flex items-center gap-1"><ArrowUpRight className="w-3.5 h-3.5" />Entradas (Fechamento de Caixa do dia)</p>
                    {fechamentoDia ? (
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div><p className="text-xs text-slate-500">Bruto</p><p className="font-semibold">{formatMoney(fechamentoDia.valor_bruto || 0)}</p></div>
                        <div><p className="text-xs text-slate-500">Taxas</p><p className="font-semibold text-amber-600">{formatMoney((fechamentoDia.valor_bruto || 0) - (fechamentoDia.valor_liquido || 0))}</p></div>
                        <div><p className="text-xs text-slate-500">Líquido</p><p className="font-semibold text-emerald-700">{formatMoney(fechamentoDia.valor_liquido || 0)}</p></div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 italic">Nenhum fechamento encontrado para esta loja/data.</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Saídas */}
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1"><ArrowDownRight className="w-3.5 h-3.5 text-red-500" />Saídas do Dia</p>
                <div className="space-y-3">
                  {saidas.map((s, i) => (
                    <div key={s._k} className="grid grid-cols-12 gap-2 items-start p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="col-span-4 space-y-1">
                        <Label className="text-xs">Descrição</Label>
                        <Input className="h-8 text-xs" placeholder="Ex: Aluguel, Insumo..." value={s.descricao} onChange={e => { const n = [...saidas]; n[i] = { ...s, descricao: e.target.value }; setSaidas(n); }} />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Valor</Label>
                        <Input className="h-8 text-xs text-right" type="number" step="0.01" min="0" value={s.valor || ''} onChange={e => { const n = [...saidas]; n[i] = { ...s, valor: parseFloat(e.target.value) || 0 }; setSaidas(n); }} />
                      </div>
                      <div className="col-span-4 space-y-1">
                        <Label className="text-xs">Origem do Dinheiro</Label>
                        <Select value={s.origem_dinheiro} onValueChange={v => { const n = [...saidas]; n[i] = { ...s, origem_dinheiro: v }; setSaidas(n); }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{ORIGENS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-1 space-y-1">
                        <Label className="text-xs">Forma</Label>
                        <Select value={s.forma} onValueChange={v => { const n = [...saidas]; n[i] = { ...s, forma: v }; setSaidas(n); }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{FORMAS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-1 flex items-end">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setSaidas(saidas.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-2 gap-1 w-full" onClick={() => setSaidas([...saidas, EMPTY_SAIDA()])}><Plus className="w-4 h-4" />Adicionar Saída</Button>
              </div>

              {/* Resumo */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 mb-4 text-center text-sm">
                <div><p className="text-xs text-slate-500">Entradas Brutas</p><p className="font-bold text-emerald-600">{formatMoney(totalEntradas)}</p></div>
                <div><p className="text-xs text-slate-500">Total Saídas</p><p className="font-bold text-red-600">{formatMoney(totalSaidas)}</p></div>
                <div><p className="text-xs text-slate-500">Saldo Físico Esperado</p><p className="font-bold">{formatMoney(totalEntradas - totalSaidas)}</p></div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="space-y-1">
                  <Label>Observações do Papel de Faturamento</Label>
                  <Textarea value={form.papel_faturamento_obs} onChange={e => setForm({ ...form, papel_faturamento_obs: e.target.value })} rows={2} placeholder="Anotações do papel físico, divergências, etc." />
                </div>
                <div className="space-y-1">
                  <Label>Conferido por</Label>
                  <Input value={form.conferido_por} onChange={e => setForm({ ...form, conferido_por: e.target.value })} placeholder="Nome do responsável" />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar Auditoria'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}