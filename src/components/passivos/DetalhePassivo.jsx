import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtDate = (d) => d ? format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '-';

const TIPO_LABELS = { cartao: 'Cartão', emprestimo: 'Empréstimo', financiamento: 'Financiamento', fornecedor: 'Fornecedor', cheque_especial: 'Cheque Especial', acordo: 'Acordo' };

export default function DetalhePassivo({ liabilityId, onBack, onRefresh }) {
  const [liability, setLiability] = useState(null);
  const [installments, setInstallments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [lib, insts] = await Promise.all([
      base44.entities.FinancialLiability.filter({ id: liabilityId }),
      base44.entities.LiabilityInstallment.filter({ liability_id: liabilityId })
    ]);
    setLiability(lib[0] || null);
    setInstallments(insts.sort((a, b) => a.installment_number - b.installment_number));
    setLoading(false);
  };

  useEffect(() => { load(); }, [liabilityId]);

  // Sincronizar parcelas pagas via AP
  const syncFromAP = async () => {
    const pendentes = installments.filter(i => i.status === 'pendente' && i.linked_ap_id);
    let updated = 0;
    for (const inst of pendentes) {
      try {
        const ap = await base44.entities.ContaPagar.filter({ id: inst.linked_ap_id });
        if (ap[0]?.status === 'pago') {
          await base44.entities.LiabilityInstallment.update(inst.id, {
            status: 'pago',
            paid_date: ap[0].data_pagamento || new Date().toISOString().split('T')[0]
          });
          updated++;
        }
      } catch (e) {}
    }
    if (updated > 0) {
      // Recalcular saldo
      const allInsts = await base44.entities.LiabilityInstallment.filter({ liability_id: liabilityId });
      const paidCount = allInsts.filter(i => i.status === 'pago').length;
      const newBalance = liability.installment_value * (liability.total_installments - paidCount);
      const newStatus = paidCount >= liability.total_installments ? 'quitado' : 'ativo';
      await base44.entities.FinancialLiability.update(liabilityId, { current_balance: newBalance, status: newStatus });
      await load();
      onRefresh?.();
    }
  };

  if (loading) return <div className="p-6 text-slate-500">Carregando...</div>;
  if (!liability) return <div className="p-6 text-slate-500">Passivo não encontrado</div>;

  const paid = installments.filter(i => i.status === 'pago').length;
  const total = installments.length;
  const progress = total > 0 ? Math.round((paid / total) * 100) : 0;
  const today = new Date().toISOString().split('T')[0];
  const overdue = installments.filter(i => i.status === 'pendente' && i.due_date < today).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
        <div>
          <h2 className="text-xl font-bold text-slate-800">{liability.title}</h2>
          <p className="text-sm text-slate-500">{TIPO_LABELS[liability.type]} · {liability.creditor_name}</p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={syncFromAP}>Sincronizar Pagamentos</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Saldo Atual</p><p className="text-lg font-bold text-red-600">{fmt(liability.current_balance)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Valor Original</p><p className="text-lg font-bold">{fmt(liability.original_amount)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Parcelas Pagas</p><p className="text-lg font-bold text-green-600">{paid}/{total}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Vencidas</p><p className={`text-lg font-bold ${overdue > 0 ? 'text-red-600' : 'text-slate-600'}`}>{overdue}</p></CardContent></Card>
      </div>

      {/* Progresso */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Progresso de Quitação</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-200 rounded-full h-3">
              <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-sm font-medium text-slate-700">{progress}%</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{paid} de {total} parcelas pagas</p>
        </CardContent>
      </Card>

      {/* Lista de parcelas */}
      <Card>
        <CardHeader><CardTitle>Parcelas</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 text-slate-600">#</th>
                  <th className="text-left px-4 py-2 text-slate-600">Vencimento</th>
                  <th className="text-right px-4 py-2 text-slate-600">Valor</th>
                  <th className="text-center px-4 py-2 text-slate-600">Status</th>
                  <th className="text-left px-4 py-2 text-slate-600">Pago em</th>
                </tr>
              </thead>
              <tbody>
                {installments.map(inst => {
                  const isOverdue = inst.status === 'pendente' && inst.due_date < today;
                  return (
                    <tr key={inst.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-500">{inst.installment_number}</td>
                      <td className={`px-4 py-2 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>{fmtDate(inst.due_date)}</td>
                      <td className="px-4 py-2 text-right font-medium">{fmt(inst.amount)}</td>
                      <td className="px-4 py-2 text-center">
                        {inst.status === 'pago' ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" />Pago</Badge>
                        ) : isOverdue ? (
                          <Badge className="bg-red-100 text-red-700 border-red-200"><AlertTriangle className="w-3 h-3 mr-1" />Vencida</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-500">{fmtDate(inst.paid_date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}