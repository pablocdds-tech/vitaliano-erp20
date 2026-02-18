import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import MoneyDisplay from '@/components/ui-custom/MoneyDisplay';
import KPICard from '@/components/ui-custom/KPICard';
import EmptyState from '@/components/ui-custom/EmptyState';
import { Button } from '@/components/ui/button';
import { Package, Plus, PlayCircle, XCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { iniciarProducao, cancelarProducao } from '@/components/services/producaoService';
import OrdemProducaoForm from '@/components/producao/OrdemProducaoForm';
import ConcluirProducaoModal from '@/components/producao/ConcluirProducaoModal';

export default function Producao() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [concluirModal, setConcluirModal] = useState(null);

  const { data: ordens = [], isLoading } = useQuery({
    queryKey: ['ordens-producao'],
    queryFn: () => base44.entities.Producao.list('-created_date', 200),
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list(),
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list(),
  });

  // Pega empresa da primeira loja disponível (multi-tenant simples)
  const empresaId = lojas[0]?.empresa_id || '';

  const getProduto = (id) => produtos.find(p => p.id === id);
  const getLoja = (id) => lojas.find(l => l.id === id);

  const handleIniciar = async (ordem) => {
    try {
      await iniciarProducao(ordem);
      qc.invalidateQueries({ queryKey: ['ordens-producao'] });
      toast.success('Produção iniciada!');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleCancelar = async (ordemId) => {
    if (!confirm('Cancelar esta ordem de produção?')) return;
    try {
      await cancelarProducao(ordemId);
      qc.invalidateQueries({ queryKey: ['ordens-producao'] });
      toast.success('Ordem cancelada.');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const planejadas = ordens.filter(o => o.status === 'planejada').length;
  const emAndamento = ordens.filter(o => o.status === 'em_andamento').length;
  const concluidas = ordens.filter(o => o.status === 'concluida').length;

  const columns = [
    {
      key: 'numero',
      label: 'Ordem',
      render: (v, row) => (
        <div>
          <p className="font-mono text-xs font-semibold">{v || row.id.substring(0, 8)}</p>
          <p className="text-xs text-slate-400">{row.data_planejada ? format(new Date(row.data_planejada + 'T12:00:00'), 'dd/MM/yyyy') : '-'}</p>
        </div>
      ),
    },
    {
      key: 'produto_id',
      label: 'Produto',
      render: (v) => {
        const p = getProduto(v);
        return <p className="text-sm font-medium">{p?.nome || '-'}</p>;
      },
    },
    {
      key: 'loja_id',
      label: 'Loja / CD',
      render: (v) => <p className="text-sm text-slate-500">{getLoja(v)?.nome || '-'}</p>,
    },
    {
      key: 'quantidade_planejada',
      label: 'Qtd Planejada',
      render: (v, row) => {
        const p = getProduto(row.produto_id);
        return <span className="text-sm">{v} {p?.unidade_medida || 'un'}</span>;
      },
    },
    {
      key: 'quantidade_produzida',
      label: 'Qtd Produzida',
      render: (v, row) => {
        if (row.status !== 'concluida') return <span className="text-slate-400 text-sm">—</span>;
        const p = getProduto(row.produto_id);
        return <span className="text-sm text-emerald-600 font-semibold">{v} {p?.unidade_medida || 'un'}</span>;
      },
    },
    {
      key: 'custo_total',
      label: 'Custo Real',
      render: (v, row) => row.status === 'concluida' ? <MoneyDisplay value={v || 0} size="sm" /> : <span className="text-slate-400 text-sm">—</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <StatusBadge status={v} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ordens de Produção"
        subtitle="Gerencie a produção do CD com baixa automática de insumos"
        icon={Package}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Produção' }]}
        actions={
          <Button className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="w-4 h-4" /> Nova Ordem
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title="Planejadas" value={planejadas} icon={Package} variant="info" subtitle="aguardando início" />
        <KPICard title="Em Andamento" value={emAndamento} icon={PlayCircle} variant="warning" subtitle="em produção" />
        <KPICard title="Concluídas" value={concluidas} icon={CheckCircle2} variant="success" subtitle="total histórico" />
      </div>

      {ordens.length === 0 && !isLoading ? (
        <EmptyState
          icon={Package}
          title="Nenhuma ordem de produção"
          description="Crie uma ordem para registrar a produção com baixa automática de insumos."
          actionLabel="Nova Ordem"
          onAction={() => setFormOpen(true)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={ordens}
          loading={isLoading}
          searchPlaceholder="Buscar ordens..."
          rowActions={row => [
            ...(row.status === 'planejada' ? [
              { label: 'Iniciar', icon: PlayCircle, onClick: () => handleIniciar(row) },
              { label: 'Cancelar', icon: XCircle, onClick: () => handleCancelar(row.id) },
            ] : []),
            ...(row.status === 'em_andamento' ? [
              { label: 'Concluir', icon: CheckCircle2, onClick: () => setConcluirModal(row) },
              { label: 'Cancelar', icon: XCircle, onClick: () => handleCancelar(row.id) },
            ] : []),
          ]}
        />
      )}

      {/* Form nova ordem */}
      <OrdemProducaoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        empresaId={empresaId}
        onSaved={() => qc.invalidateQueries({ queryKey: ['ordens-producao'] })}
      />

      {/* Modal concluir */}
      {concluirModal && (
        <ConcluirProducaoModal
          open={!!concluirModal}
          producao={concluirModal}
          produtos={produtos}
          onClose={() => setConcluirModal(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['ordens-producao'] });
            qc.invalidateQueries({ queryKey: ['estoque'] });
            qc.invalidateQueries({ queryKey: ['movimentacoes-estoque'] });
          }}
        />
      )}
    </div>
  );
}