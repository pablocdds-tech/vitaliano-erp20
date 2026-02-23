import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  ClipboardCheck, Plus, Copy, ExternalLink, MessageCircle,
  ChevronRight, Users, AlertTriangle, CheckCheck, RefreshCw, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { criarContagemDireta, aprovarAjusteContagem } from '@/components/services/contagemService';
import { getEmpresaIdAtual } from '@/components/services/tenantService';
import { createPageUrl } from '@/utils';
import NovaContagemModal from '@/components/contagens/NovaContagemModal';
import ContagemLinkModal from '@/components/contagens/ContagemLinkModal';

export default function Contagens() {
  const queryClient = useQueryClient();
  const [selectedContagem, setSelectedContagem] = useState(null);
  const [showNovaContagem, setShowNovaContagem] = useState(false);
  const [criando, setCriando] = useState(false);
  const [tarefaCriada, setTarefaCriada] = useState(null);

  const { data: empresaId } = useQuery({
    queryKey: ['empresa-id-contagens'],
    queryFn: getEmpresaIdAtual
  });

  const { data: contagens = [], isLoading } = useQuery({
    queryKey: ['contagens', empresaId],
    queryFn: () => base44.entities.Contagem.filter({ empresa_id: empresaId }, '-created_date', 50),
    enabled: !!empresaId
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas', empresaId],
    queryFn: () => base44.entities.Loja.filter({ empresa_id: empresaId, status: 'ativo' }),
    enabled: !!empresaId
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos', empresaId],
    queryFn: () => base44.entities.Produto.filter({ empresa_id: empresaId, status: 'ativo' }),
    enabled: !!empresaId
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias', empresaId],
    queryFn: () => base44.entities.Categoria.filter({ empresa_id: empresaId, status: 'ativo' }),
    enabled: !!empresaId
  });

  // Abrir contagem via querystring
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('contagem_id');
    if (id && contagens.length > 0) {
      const c = contagens.find(c => c.id === id);
      if (c) setSelectedContagem(c);
    }
  }, [contagens]);

  const handleCriarContagem = async (data) => {
    setCriando(true);
    try {
      const { tarefa } = await criarContagemDireta({
        empresa_id: empresaId,
        loja_id: data.loja_id,
        responsavel_nome: data.responsavel_nome,
        grupo: data.grupo,
        produto_ids: data.produto_ids,
        produtos,
        observacoes: data.observacoes,
      });
      queryClient.invalidateQueries({ queryKey: ['contagens'] });
      toast.success('Contagem criada com sucesso!');
      setShowNovaContagem(false);
      setTarefaCriada(tarefa);
    } catch (e) {
      toast.error('Erro ao criar contagem: ' + e.message);
    } finally {
      setCriando(false);
    }
  };

  const getLoja = (id) => lojas.find(l => l.id === id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contagens de Estoque"
        subtitle="Crie contagens, envie links para funcionários e aprove ajustes"
        icon={ClipboardCheck}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Contagens' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['contagens'] })}>
              <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
            </Button>
            <Button size="sm" onClick={() => setShowNovaContagem(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nova Contagem
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      ) : contagens.length === 0 ? (
        <div className="border-2 border-dashed rounded-2xl p-12 text-center text-slate-400">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-slate-500">Nenhuma contagem ainda</p>
          <p className="text-sm mt-1">Crie sua primeira contagem e envie o link para o funcionário.</p>
          <Button className="mt-4" onClick={() => setShowNovaContagem(true)}>
            <Plus className="w-4 h-4 mr-2" /> Criar Contagem
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {contagens.map(c => {
            const loja = getLoja(c.loja_id);
            return (
              <div
                key={c.id}
                className="flex items-center gap-4 border rounded-xl p-4 bg-white dark:bg-slate-900 hover:shadow-md cursor-pointer transition-shadow"
                onClick={() => setSelectedContagem(c)}
              >
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
                  <ClipboardCheck className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-white truncate">
                    {c.responsavel || 'Contagem'} — {c.data_abertura ? format(new Date(c.data_abertura), 'dd/MM/yyyy HH:mm') : '—'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{loja?.nome || '—'} · {c.observacoes || c.tipo}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-center hidden md:block">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{c.itens_contados || 0}/{c.total_itens || 0}</p>
                    <p className="text-xs text-slate-400">itens</p>
                  </div>
                  <StatusBadge status={c.status} />
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal detalhe */}
      <Dialog open={!!selectedContagem} onOpenChange={v => { if (!v) setSelectedContagem(null); }}>
        {selectedContagem && (
          <ContagemDetail contagem={selectedContagem} lojas={lojas} onClose={() => setSelectedContagem(null)} queryClient={queryClient} empresaId={empresaId} />
        )}
      </Dialog>

      {/* Modal criar contagem */}
      <NovaContagemModal
        open={showNovaContagem}
        onClose={setShowNovaContagem}
        lojas={lojas}
        produtos={produtos}
        categorias={categorias}
        onSubmit={handleCriarContagem}
        loading={criando}
      />

      {/* Modal link criado */}
      <ContagemLinkModal
        open={!!tarefaCriada}
        onClose={() => setTarefaCriada(null)}
        tarefa={tarefaCriada}
      />
    </div>
  );
}

function ContagemDetail({ contagem, lojas, onClose, queryClient, empresaId }) {
  const [aprovando, setAprovando] = useState(false);

  const { data: tarefas = [], refetch } = useQuery({
    queryKey: ['tarefas-contagem', contagem?.id],
    queryFn: () => base44.entities.TarefaContagem.filter({ contagem_id: contagem.id }),
    enabled: !!contagem?.id,
    refetchInterval: 10000,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos-contagem'],
    queryFn: () => base44.entities.Produto.list(),
  });

  const getTarefaUrl = (tarefa) => {
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}#/ContagemTarefa?token=${tarefa.token}`;
  };

  const handleCopyLink = (tarefa) => {
    navigator.clipboard.writeText(getTarefaUrl(tarefa));
    toast.success('Link copiado!');
  };

  const handleOpenLink = (tarefa) => {
    window.open(getTarefaUrl(tarefa), '_blank');
  };

  const handleWhatsApp = (tarefa) => {
    const url = getTarefaUrl(tarefa);
    const msg = encodeURIComponent(`Olá ${tarefa.responsavel_nome}! 📋\nFaça a contagem de estoque — ${tarefa.grupo || 'Geral'} (${tarefa.total_itens} itens)\n\nAcesse:\n${url}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const handleAprovar = async () => {
    setAprovando(true);
    try {
      await aprovarAjusteContagem(contagem, tarefas, empresaId);
      queryClient.invalidateQueries({ queryKey: ['contagens'] });
      queryClient.invalidateQueries({ queryKey: ['estoque'] });
      toast.success('Ajuste aprovado e estoque atualizado!');
      onClose();
    } catch (e) {
      toast.error('Erro: ' + e.message);
    } finally {
      setAprovando(false);
    }
  };

  // Divergências
  const divergencias = [];
  for (const tarefa of tarefas) {
    for (const item of (tarefa.itens || [])) {
      if (item.quantidade_contada != null && item.quantidade_sistema != null) {
        const diff = (item.quantidade_contada || 0) - (item.quantidade_sistema || 0);
        if (Math.abs(diff) > 0.001) {
          divergencias.push({ ...item, diff, responsavel: tarefa.responsavel_nome, grupo: tarefa.grupo });
        }
      }
    }
  }

  const tarefasFinalizadas = tarefas.filter(t => t.status === 'finalizado').length;
  const podeAprovar = contagem.status !== 'ajustada' && contagem.status !== 'aprovada' && tarefasFinalizadas > 0;

  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-indigo-500" />
          {contagem.responsavel || 'Contagem'} — {contagem.data_abertura ? format(new Date(contagem.data_abertura), 'dd/MM/yyyy HH:mm') : ''}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-5">
        {/* Status geral */}
        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{tarefas.length}</p>
            <p className="text-xs text-slate-500">Tarefas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">{tarefasFinalizadas}</p>
            <p className="text-xs text-slate-500">Finalizadas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">{divergencias.length}</p>
            <p className="text-xs text-slate-500">Divergências</p>
          </div>
          <div className="ml-auto">
            <StatusBadge status={contagem.status} />
          </div>
        </div>

        {/* Tarefas */}
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> Tarefas por Responsável
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tarefas.map(t => {
              const pct = t.total_itens > 0 ? Math.round((t.itens_preenchidos / t.total_itens) * 100) : 0;
              return (
                <div key={t.id} className="border rounded-xl p-4 space-y-3 bg-white dark:bg-slate-900">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${t.status === 'finalizado' ? 'bg-emerald-500' : t.status === 'em_andamento' ? 'bg-amber-400' : 'bg-slate-400'}`} />
                        <span className="font-semibold text-slate-800 dark:text-white">{t.responsavel_nome}</span>
                        {t.grupo && <Badge variant="secondary" className="text-xs">{t.grupo}</Badge>}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{t.total_itens} itens · {pct}% preenchido</p>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                    <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 flex-1 text-xs" onClick={() => handleCopyLink(t)}>
                      <Copy className="w-3.5 h-3.5" /> Copiar Link
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => handleOpenLink(t)}>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 flex-1 text-xs text-green-600 border-green-300 hover:bg-green-50" onClick={() => handleWhatsApp(t)}>
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Divergências */}
        {divergencias.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Divergências ({divergencias.length} itens)
            </p>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Produto</th>
                    <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Responsável</th>
                    <th className="text-right p-3 text-xs font-medium text-slate-500 uppercase">Sistema</th>
                    <th className="text-right p-3 text-xs font-medium text-slate-500 uppercase">Contado</th>
                    <th className="text-right p-3 text-xs font-medium text-slate-500 uppercase">Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {divergencias.map((d, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-3 font-medium">{d.produto_nome}</td>
                      <td className="p-3 text-slate-500 text-xs">{d.responsavel}{d.grupo ? ` — ${d.grupo}` : ''}</td>
                      <td className="p-3 text-right">{d.quantidade_sistema}</td>
                      <td className="p-3 text-right">{d.quantidade_contada}</td>
                      <td className={`p-3 text-right font-bold ${d.diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {d.diff > 0 ? '+' : ''}{d.diff.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
        </Button>
        <Button variant="outline" onClick={onClose}>Fechar</Button>
        {podeAprovar && (
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            disabled={aprovando}
            onClick={handleAprovar}
          >
            {aprovando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
            {aprovando ? 'Aprovando...' : divergencias.length > 0 ? `Aprovar Ajuste (${divergencias.length})` : 'Aprovar Contagem'}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}