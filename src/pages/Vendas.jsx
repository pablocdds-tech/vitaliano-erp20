import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import MoneyDisplay, { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import KPICard from '@/components/ui-custom/KPICard';
import EmptyState from '@/components/ui-custom/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FechamentoModal from '@/components/fechamento/FechamentoModal';
import FormasPagamentoModal from '@/components/fechamento/FormasPagamentoModal';
import { TrendingUp, Plus, DollarSign, Receipt, CreditCard, Eye, Trash2, Settings } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';

export default function Vendas() {
  const qc = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);
  const [verFechamento, setVerFechamento] = useState(null);
  const [formasOpen, setFormasOpen] = useState(false);
  const [lojaFiltro, setLojaFiltro] = useState('all');
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const { data: fechamentos = [], isLoading } = useQuery({
    queryKey: ['fechamentos'],
    queryFn: () => base44.entities.Venda.list('-data', 200)
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const getLoja = (id) => lojas.find(l => l.id === id);

  const handleModalClose = (refresh) => {
    setNovoOpen(false);
    setVerFechamento(null);
    if (refresh) {
      qc.invalidateQueries({ queryKey: ['fechamentos'] });
      qc.invalidateQueries({ queryKey: ['contas-receber'] });
      toast.success('Fechamento salvo e recebíveis gerados!');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este fechamento? As contas a receber vinculadas NÃO serão removidas automaticamente.')) return;
    await base44.entities.Venda.delete(id);
    qc.invalidateQueries({ queryKey: ['fechamentos'] });
    toast.success('Fechamento removido.');
  };

  // Filtros
  const filtrados = fechamentos.filter(f => {
    if (lojaFiltro !== 'all' && f.loja_id !== lojaFiltro) return false;
    if (dataInicio && (f.data || '') < dataInicio) return false;
    if (dataFim && (f.data || '') > dataFim) return false;
    return true;
  });

  const totalBruto = filtrados.reduce((s, f) => s + (f.valor_bruto || 0), 0);
  const totalLiquido = filtrados.reduce((s, f) => s + (f.valor_liquido || 0), 0);
  const totalTaxas = totalBruto - totalLiquido;

  const columns = [
    {
      key: 'data', label: 'Data', sortable: true,
      render: (v) => <span className="text-sm font-medium">{v ? format(new Date(v + 'T12:00:00'), 'dd/MM/yyyy') : '-'}</span>
    },
    {
      key: 'loja_id', label: 'Loja',
      render: (v) => <span className="text-sm">{getLoja(v)?.nome || '-'}</span>
    },
    {
      key: 'linhas_fechamento', label: 'Formas de Pgto',
      render: (v) => (
        <span className="text-xs text-slate-500">
          {v?.length ? `${v.length} linha${v.length > 1 ? 's' : ''}` : '—'}
        </span>
      )
    },
    {
      key: 'valor_bruto', label: 'Total Bruto', sortable: true,
      render: (v) => <MoneyDisplay value={v || 0} size="sm" />
    },
    {
      key: 'valor_liquido', label: 'Total Líquido', sortable: true,
      render: (v) => <MoneyDisplay value={v || 0} size="sm" />
    },
    {
      key: 'observacoes', label: 'Obs.',
      render: (v) => <span className="text-xs text-slate-400 truncate max-w-[120px] block">{v || '—'}</span>
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fechamento de Caixa"
        subtitle="Lançamento diário por forma de pagamento com geração automática de recebíveis"
        icon={TrendingUp}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Fechamento de Caixa' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setFormasOpen(true)}>
              <Settings className="w-4 h-4" />Formas de Pgto
            </Button>
            <Button className="gap-2" onClick={() => setNovoOpen(true)}>
              <Plus className="w-4 h-4" />Novo Fechamento
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title="Total Bruto" value={formatMoney(totalBruto)} icon={DollarSign} variant="info" subtitle={`${filtrados.length} fechamentos`} />
        <KPICard title="Total Taxas" value={formatMoney(totalTaxas)} icon={Receipt} variant="warning" subtitle="descontado dos brutos" />
        <KPICard title="Total Líquido" value={formatMoney(totalLiquido)} icon={TrendingUp} variant="success" subtitle="a receber no período" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select value={lojaFiltro} onValueChange={setLojaFiltro}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todas as lojas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as lojas</SelectItem>
            {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-40" />
        <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-40" />
      </div>

      {/* Tabela / Empty */}
      {fechamentos.length === 0 && !isLoading ? (
        <EmptyState
          icon={CreditCard}
          title="Nenhum fechamento lançado"
          description="Lance o fechamento diário por forma de pagamento. Os recebíveis serão gerados automaticamente."
          actionLabel="Novo Fechamento"
          onAction={() => setNovoOpen(true)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtrados}
          loading={isLoading}
          searchPlaceholder="Buscar fechamentos..."
          emptyIcon={TrendingUp}
          emptyTitle="Nenhum fechamento encontrado"
          rowActions={(row) => [
            { label: 'Visualizar', icon: Eye, onClick: () => setVerFechamento(row) },
            { label: 'Excluir', icon: Trash2, onClick: () => handleDelete(row.id), destructive: true }
          ]}
        />
      )}

      {/* Modais */}
      <FechamentoModal
        open={novoOpen || !!verFechamento}
        onClose={handleModalClose}
        fechamentoParaVer={verFechamento}
      />
      <FormasPagamentoModal open={formasOpen} onClose={() => setFormasOpen(false)} />
    </div>
  );
}