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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ShoppingBag, Plus, CheckCircle2, Eye, Package, Pencil, XCircle,
  Building2, Store, ArrowRight, FileText, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { confirmarPedidoInterno, cancelarPedidoInterno } from '@/components/services/pedidoInternoService';
import { getEmpresaAtiva } from '@/components/services/tenantService';
import PedidoForm from '@/components/pedidos/PedidoForm';
import CupomConferencia from '@/components/pedidos/CupomConferencia';
import CupomTermico from '@/components/pedidos/CupomTermico';

export default function PedidosInternos() {
  const queryClient = useQueryClient();
  const [modalNovo, setModalNovo] = useState(false);
  const [modalEditar, setModalEditar] = useState(null); // pedido being edited
  const [pedidoDetalhe, setPedidoDetalhe] = useState(null);
  const [mostrarCupom, setMostrarCupom] = useState(false);
  const [filtroLoja, setFiltroLoja] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [confirmandoId, setConfirmandoId] = useState(null);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['pedidos-internos'],
    queryFn: () => base44.entities.PedidoInterno.list('-created_date', 200),
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list('nome'),
  });

  const cd = lojas.find(l => l.tipo === 'cd');
  const lojasDestino = lojas.filter(l => l.tipo === 'loja');
  const getLoja = (id) => lojas.find(l => l.id === id);

  // --- MUTATIONS ---

  const criarMutation = useMutation({
    mutationFn: async (dados) => {
      const empresa = await getEmpresaAtiva();
      return base44.entities.PedidoInterno.create({ ...dados, empresa_id: empresa.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-internos'] });
      setModalNovo(false);
      toast.success('Pedido salvo como rascunho.');
    },
    onError: (e) => toast.error(e.message || 'Erro ao criar pedido'),
  });

  const editarMutation = useMutation({
    mutationFn: async ({ id, dados }) => {
      return base44.entities.PedidoInterno.update(id, dados);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-internos'] });
      setModalEditar(null);
      setPedidoDetalhe(null);
      toast.success('Pedido atualizado.');
    },
    onError: (e) => toast.error(e.message || 'Erro ao editar pedido'),
  });

  const cancelarMutation = useMutation({
    mutationFn: (id) => cancelarPedidoInterno(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-internos'] });
      setPedidoDetalhe(null);
      toast.success('Pedido cancelado.');
    },
    onError: (e) => toast.error(e.message || 'Erro ao cancelar'),
  });

  const confirmarMutation = useMutation({
    mutationFn: async (pedidoId) => {
      if (confirmandoId) throw new Error('Já há uma confirmação em andamento.');
      setConfirmandoId(pedidoId);
      toast.loading('Confirmando pedido…', { id: 'confirmar' });

      // Busca pedido completo do banco (fonte da verdade)
      const lista = await base44.entities.PedidoInterno.filter({ id: pedidoId });
      const pedidoCompleto = lista[0];
      if (!pedidoCompleto) throw new Error('Pedido não encontrado.');
      if (pedidoCompleto.status !== 'draft') throw new Error(`Pedido já está com status "${pedidoCompleto.status}".`);
      if (!pedidoCompleto.itens || pedidoCompleto.itens.length === 0) throw new Error('Pedido sem itens.');

      // Busca lojas frescas do banco para saldos corretos
      const lojasFrescas = await base44.entities.Loja.list('nome');
      const user = await base44.auth.me();
      return confirmarPedidoInterno(pedidoCompleto, lojasFrescas, user);
    },
    onSuccess: (result) => {
      toast.success('Pedido confirmado! Débito gerado no banco virtual.', { id: 'confirmar' });
      queryClient.invalidateQueries({ queryKey: ['pedidos-internos'] });
      queryClient.invalidateQueries({ queryKey: ['lojas'] });
      queryClient.invalidateQueries({ queryKey: ['banco-virtual'] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoes-estoque'] });
      queryClient.invalidateQueries({ queryKey: ['estoque'] });
      // Atualiza detalhe local e mostra cupom automaticamente
      setPedidoDetalhe(prev => prev ? { ...prev, ...result, status: 'confirmado' } : null);
      setMostrarCupom(true);
      setConfirmandoId(null);
    },
    onError: (e) => {
      console.error('[CONFIRMAR_ERROR]', e);
      toast.error(e.message || 'Erro ao confirmar pedido', { id: 'confirmar' });
      setConfirmandoId(null);
    },
  });

  // --- FILTERS ---

  const pedidosFiltrados = pedidos.filter(p => {
    const lojaOk = filtroLoja === 'todos' || p.loja_destino_id === filtroLoja;
    const statusOk = filtroStatus === 'todos' || p.status === filtroStatus;
    return lojaOk && statusOk;
  });

  const totalDraft = pedidos.filter(p => p.status === 'draft').length;
  const totalConfirmados = pedidos.filter(p => p.status === 'confirmado').length;
  const valorMes = pedidos.filter(p => p.status === 'confirmado' && p.data >= format(new Date(), 'yyyy-MM-01')).reduce((s, p) => s + (p.valor_total || 0), 0);

  // --- TABLE COLUMNS ---

  const columns = [
    {
      key: 'data',
      label: 'Data',
      sortable: true,
      render: (v) => v ? format(new Date(v + 'T12:00:00'), 'dd/MM/yyyy') : '-'
    },
    {
      key: 'loja_destino_id',
      label: 'Loja Destino',
      render: (v) => {
        const loja = getLoja(v);
        return loja ? (
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-teal-500" />
            <span>{loja.nome}</span>
          </div>
        ) : '-';
      }
    },
    {
      key: 'total_itens',
      label: 'Itens',
      render: (v) => <span className="text-slate-600">{v || 0} itens</span>
    },
    {
      key: 'valor_total',
      label: 'Valor Total',
      sortable: true,
      render: (v) => <MoneyDisplay value={v || 0} size="sm" />
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (v) => <StatusBadge status={v} />
    },
    {
      key: 'id',
      label: '',
      render: (v, row) => row.status === 'draft' ? (
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 h-8"
          disabled={confirmarMutation.isPending || !!confirmandoId}
          onClick={(e) => {
            e.stopPropagation();
            confirmarMutation.mutate(row.id);
          }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          {confirmandoId === row.id ? 'Confirmando...' : 'Confirmar'}
        </Button>
      ) : row.status === 'confirmado' ? (
        <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Confirmado
        </span>
      ) : null
    }
  ];

  // Merge para manter itens quando abre detalhe
  const pedidoAtivo = pedidoDetalhe
    ? { ...(pedidos.find(p => p.id === pedidoDetalhe.id) || {}), ...pedidoDetalhe }
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="CD → Lojas"
        subtitle="PDV interno: vendas do CD para as lojas"
        icon={ShoppingBag}
        breadcrumbs={[
          { label: 'Dashboard', href: 'Dashboard' },
          { label: 'CD → Lojas' }
        ]}
        actions={
          <Button onClick={() => setModalNovo(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Venda para Loja
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title="Rascunhos Pendentes" value={totalDraft} icon={FileText} variant={totalDraft > 0 ? 'warning' : 'default'} subtitle="aguardando confirmação" />
        <KPICard title="Confirmados" value={totalConfirmados} icon={CheckCircle2} variant="success" subtitle="total acumulado" />
        <KPICard title="Faturado no Mês" value={formatMoney(valorMes)} icon={ShoppingBag} variant="info" subtitle="pedidos confirmados" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select value={filtroLoja} onValueChange={setFiltroLoja}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todas as lojas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as lojas</SelectItem>
            {lojasDestino.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="confirmado">Confirmado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      {pedidosFiltrados.length === 0 && !isLoading ? (
        <EmptyState
          icon={ShoppingBag}
          title="Nenhum pedido encontrado"
          description="Crie a primeira venda interna do CD para uma loja."
          actionLabel="Nova Venda"
          onAction={() => setModalNovo(true)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={pedidosFiltrados}
          loading={isLoading}
          searchPlaceholder="Buscar pedidos..."
          emptyIcon={ShoppingBag}
          emptyTitle="Nenhum pedido encontrado"
          onRowClick={(row) => { setPedidoDetalhe(row); setMostrarCupom(false); }}
          rowActions={(row) => {
            const actions = [{ label: 'Ver detalhes', icon: Eye, onClick: () => { setPedidoDetalhe(row); setMostrarCupom(false); } }];
            if (row.status === 'draft') {
              actions.push({ label: 'Editar pedido', icon: Pencil, onClick: () => setModalEditar(row) });
              actions.push({ label: 'Cancelar pedido', icon: XCircle, onClick: () => cancelarMutation.mutate(row.id), destructive: true });
            }
            if (row.status === 'confirmado') {
              actions.push({ label: 'Ver cupom', icon: FileText, onClick: () => { setPedidoDetalhe(row); setMostrarCupom(true); } });
            }
            return actions;
          }}
        />
      )}

      {/* Modal novo pedido */}
      <Dialog open={modalNovo} onOpenChange={setModalNovo}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-500" />
              {cd?.nome || 'CD'}
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <Store className="w-5 h-5 text-teal-500" />
              Nova Venda para Loja
            </DialogTitle>
          </DialogHeader>
          <PedidoForm
            onSave={(dados) => criarMutation.mutate(dados)}
            onCancel={() => setModalNovo(false)}
            saving={criarMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Modal editar pedido */}
      <Dialog open={!!modalEditar} onOpenChange={(open) => { if (!open) setModalEditar(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-amber-500" />
              Editar Pedido
            </DialogTitle>
          </DialogHeader>
          {modalEditar && (
            <PedidoForm
              pedidoInicial={modalEditar}
              onSave={(dados) => editarMutation.mutate({ id: modalEditar.id, dados })}
              onCancel={() => setModalEditar(null)}
              saving={editarMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal detalhe/cupom */}
      <Dialog open={!!pedidoDetalhe} onOpenChange={(open) => { if (!open) setPedidoDetalhe(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Pedido #{pedidoAtivo?.id?.slice(-8).toUpperCase()}
              {pedidoAtivo && <StatusBadge status={pedidoAtivo.status} />}
            </DialogTitle>
          </DialogHeader>

          {pedidoAtivo && (
            <div className="space-y-4">
              {/* Ações para rascunho */}
              {pedidoAtivo.status === 'draft' && (
                <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">Pedido em rascunho</p>
                    <p className="text-xs text-amber-600">Confirme para gerar débito no banco virtual e movimentar estoque.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setPedidoDetalhe(null); setModalEditar(pedidoAtivo); }}
                      className="gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => cancelarMutation.mutate(pedidoAtivo.id)}
                      disabled={cancelarMutation.isPending}
                      className="gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => confirmarMutation.mutate(pedidoAtivo.id)}
                      disabled={confirmarMutation.isPending || !!confirmandoId}
                      className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {confirmarMutation.isPending ? 'Confirmando...' : 'Confirmar'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Tabs detalhe / cupom para confirmados */}
              {pedidoAtivo.status === 'confirmado' && (
                <div className="flex gap-2">
                  <Button size="sm" variant={!mostrarCupom ? 'default' : 'outline'} onClick={() => setMostrarCupom(false)}>
                    Detalhes
                  </Button>
                  <Button size="sm" variant={mostrarCupom ? 'default' : 'outline'} onClick={() => setMostrarCupom(true)}>
                    <FileText className="w-4 h-4 mr-1" /> Cupom de Conferência
                  </Button>
                </div>
              )}

              {/* Cancelado banner */}
              {pedidoAtivo.status === 'cancelado' && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <p className="text-sm font-medium text-red-700">Este pedido foi cancelado.</p>
                </div>
              )}

              {!mostrarCupom ? (
                <>
                  {/* Info cabeçalho */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">Origem:</span>
                      <p className="font-medium">{getLoja(pedidoAtivo.cd_id)?.nome || '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Destino:</span>
                      <p className="font-medium">{getLoja(pedidoAtivo.loja_destino_id)?.nome || '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Data:</span>
                      <p className="font-medium">{pedidoAtivo.data ? format(new Date(pedidoAtivo.data + 'T12:00:00'), 'dd/MM/yyyy') : '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Criado por:</span>
                      <p className="font-medium text-xs">{pedidoAtivo.created_by || '-'}</p>
                    </div>
                    {pedidoAtivo.confirmado_por && (
                      <div>
                        <span className="text-slate-500">Confirmado por:</span>
                        <p className="font-medium text-xs">{pedidoAtivo.confirmado_por}</p>
                      </div>
                    )}
                    {pedidoAtivo.data_confirmacao && (
                      <div>
                        <span className="text-slate-500">Confirmado em:</span>
                        <p className="font-medium text-xs">{format(new Date(pedidoAtivo.data_confirmacao), 'dd/MM/yyyy HH:mm')}</p>
                      </div>
                    )}
                  </div>

                  {/* Itens */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-medium text-slate-600">Produto</th>
                          <th className="text-center px-3 py-2.5 font-medium text-slate-600">Qtd</th>
                          <th className="text-right px-3 py-2.5 font-medium text-slate-600">Unit.</th>
                          <th className="text-right px-4 py-2.5 font-medium text-slate-600">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(pedidoAtivo.itens || []).map((item, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-4 py-2.5">{item.produto_nome}</td>
                            <td className="px-3 py-2.5 text-center">{item.quantidade}</td>
                            <td className="px-3 py-2.5 text-right">{formatMoney(item.preco_unitario)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold">{formatMoney(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t-2">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 text-right font-bold">Total</td>
                          <td className="px-4 py-3 text-right text-lg font-bold text-emerald-700">
                            {formatMoney(pedidoAtivo.valor_total)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {pedidoAtivo.observacoes && (
                    <p className="text-sm text-slate-500 italic">Obs: {pedidoAtivo.observacoes}</p>
                  )}
                </>
              ) : (
                <div className="space-y-6">
                  <CupomConferencia
                    pedido={pedidoAtivo}
                    cd={getLoja(pedidoAtivo.cd_id)}
                    lojaDestino={getLoja(pedidoAtivo.loja_destino_id)}
                  />
                  <CupomTermico
                    pedido={pedidoAtivo}
                    cd={getLoja(pedidoAtivo.cd_id)}
                    lojaDestino={getLoja(pedidoAtivo.loja_destino_id)}
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}