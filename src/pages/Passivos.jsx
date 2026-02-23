import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/ui-custom/PageHeader';
import NovoPassivoModal from '@/components/passivos/NovoPassivoModal';
import DetalhePassivo from '@/components/passivos/DetalhePassivo';
import SimuladorPassivos from '@/components/passivos/SimuladorPassivos';
import { Landmark, Plus, AlertTriangle, CalendarClock, TrendingDown, DollarSign, Eye } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtDate = (d) => d ? format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '-';

const TIPO_LABELS = {
  cartao: 'Cartão', emprestimo: 'Empréstimo', financiamento: 'Financiamento',
  fornecedor: 'Fornecedor', cheque_especial: 'Cheque Especial', acordo: 'Acordo'
};

const STATUS_COLORS = {
  ativo: 'bg-blue-100 text-blue-700',
  quitado: 'bg-green-100 text-green-700',
  renegociado: 'bg-amber-100 text-amber-700'
};

export default function Passivos() {
  const [showNovo, setShowNovo] = useState(false);
  const [detalheId, setDetalheId] = useState(null);
  const [tab, setTab] = useState('lista');
  const qc = useQueryClient();

  const { data: liabilities = [], refetch } = useQuery({
    queryKey: ['financial_liabilities'],
    queryFn: () => base44.entities.FinancialLiability.list('-created_date')
  });

  const { data: installments = [] } = useQuery({
    queryKey: ['liability_installments'],
    queryFn: () => base44.entities.LiabilityInstallment.list()
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const today = new Date().toISOString().split('T')[0];
  const in30 = addDays(new Date(), 30).toISOString().split('T')[0];

  const ativos = liabilities.filter(l => l.status === 'ativo');
  const dividaTotal = ativos.reduce((s, l) => s + (l.current_balance || 0), 0);

  const proximosMes = installments
    .filter(i => i.status === 'pendente' && i.due_date >= today && i.due_date <= in30)
    .reduce((s, i) => s + (i.amount || 0), 0);

  const vencidas = installments.filter(i => i.status === 'pendente' && i.due_date < today).length;

  const maiorParcela = ativos.reduce((max, l) => Math.max(max, l.installment_value || 0), 0);

  // Próximo vencimento por passivo
  const getProxVenc = (libId) => {
    const pending = installments
      .filter(i => i.liability_id === libId && i.status === 'pendente')
      .sort((a, b) => a.due_date?.localeCompare(b.due_date));
    return pending[0]?.due_date || null;
  };

  const getPaidCount = (libId) => installments.filter(i => i.liability_id === libId && i.status === 'pago').length;

  if (detalheId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Passivos & Planejamento" subtitle="Detalhe do passivo" icon={Landmark} breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Financeiro' }, { label: 'Passivos' }]} />
        <DetalhePassivo
          liabilityId={detalheId}
          onBack={() => setDetalheId(null)}
          onRefresh={refetch}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Passivos & Planejamento"
        subtitle="Gestão estratégica de dívidas e obrigações financeiras"
        icon={Landmark}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Financeiro' }, { label: 'Passivos' }]}
        actions={
          <Button onClick={() => setShowNovo(true)} className="gap-2">
            <Plus className="w-4 h-4" />Novo Passivo
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-red-500" />
              <p className="text-xs text-red-600 font-medium">Dívida Total Atual</p>
            </div>
            <p className="text-xl font-bold text-red-700">{fmt(dividaTotal)}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock className="w-4 h-4 text-amber-500" />
              <p className="text-xs text-amber-600 font-medium">Próximos 30 dias</p>
            </div>
            <p className="text-xl font-bold text-amber-700">{fmt(proximosMes)}</p>
          </CardContent>
        </Card>
        <Card className={`${vencidas > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={`w-4 h-4 ${vencidas > 0 ? 'text-red-500' : 'text-slate-400'}`} />
              <p className={`text-xs font-medium ${vencidas > 0 ? 'text-red-600' : 'text-slate-500'}`}>Parcelas Vencidas</p>
            </div>
            <p className={`text-xl font-bold ${vencidas > 0 ? 'text-red-700' : 'text-slate-600'}`}>{vencidas}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-blue-600 font-medium">Maior Parcela Mensal</p>
            </div>
            <p className="text-xl font-bold text-blue-700">{fmt(maiorParcela)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="lista">Lista de Passivos</TabsTrigger>
          <TabsTrigger value="simulador">Simulador</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-600 font-medium">Nome</th>
                    <th className="text-left px-4 py-3 text-slate-600 font-medium">Tipo</th>
                    <th className="text-left px-4 py-3 text-slate-600 font-medium">Responsável</th>
                    <th className="text-right px-4 py-3 text-slate-600 font-medium">Saldo Atual</th>
                    <th className="text-right px-4 py-3 text-slate-600 font-medium">Parcela</th>
                    <th className="text-left px-4 py-3 text-slate-600 font-medium">Próx. Venc.</th>
                    <th className="text-left px-4 py-3 text-slate-600 font-medium">Progresso</th>
                    <th className="text-center px-4 py-3 text-slate-600 font-medium">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {liabilities.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-12 text-slate-400">Nenhum passivo cadastrado</td></tr>
                  ) : liabilities.map(lib => {
                    const paidCount = getPaidCount(lib.id);
                    const progress = lib.total_installments > 0 ? Math.round((paidCount / lib.total_installments) * 100) : 0;
                    const proxVenc = getProxVenc(lib.id);
                    const isOverdueNext = proxVenc && proxVenc < today;
                    return (
                      <tr key={lib.id} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{lib.title}</td>
                        <td className="px-4 py-3 text-slate-600">{TIPO_LABELS[lib.type] || lib.type}</td>
                        <td className="px-4 py-3 text-slate-600">{lib.responsible || '-'}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">{fmt(lib.current_balance)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{fmt(lib.installment_value)}</td>
                        <td className={`px-4 py-3 ${isOverdueNext ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                          {fmtDate(proxVenc)}
                          {isOverdueNext && <span className="ml-1 text-xs bg-red-100 text-red-600 px-1 rounded">VENCIDA</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-200 rounded-full h-1.5">
                              <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-xs text-slate-500">{paidCount}/{lib.total_installments}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={STATUS_COLORS[lib.status] || 'bg-slate-100 text-slate-600'}>
                            {lib.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="outline" onClick={() => setDetalheId(lib.id)}>
                            <Eye className="w-4 h-4 mr-1" />Detalhar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="simulador" className="mt-4">
          <SimuladorPassivos />
        </TabsContent>
      </Tabs>

      <NovoPassivoModal
        open={showNovo}
        onClose={() => setShowNovo(false)}
        onSuccess={() => { refetch(); qc.invalidateQueries(['liability_installments']); }}
        lojas={lojas}
      />
    </div>
  );
}