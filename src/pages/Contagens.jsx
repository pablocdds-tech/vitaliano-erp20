import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  ClipboardCheck, Link2, MessageCircle, CheckCircle2, AlertTriangle,
  ChevronRight, Users, Package, Copy, ExternalLink, CheckCheck, X
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { aprovarAjusteContagem } from '@/components/services/contagemService';
import { getEmpresaAtiva } from '@/components/services/tenantService';
import { createPageUrl } from '@/utils';

function TarefaCard({ tarefa, lojas, onCopyLink, onCopyWhatsApp, onOpenLink }) {
  const pct = tarefa.total_itens > 0 ? Math.round((tarefa.itens_preenchidos / tarefa.total_itens) * 100) : 0;
  const statusColor = { pendente: 'bg-slate-400', em_andamento: 'bg-amber-400', finalizado: 'bg-emerald-500' };

  return (
    <div className="border rounded-xl p-4 space-y-3 bg-white dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${statusColor[tarefa.status] || 'bg-slate-300'}`} />
            <span className="font-semibold text-slate-800 dark:text-white">{tarefa.responsavel_nome}</span>
            {tarefa.grupo && <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-500">{tarefa.grupo}</span>}
          </div>
          <p className="text-xs text-slate-500 mt-1">{tarefa.total_itens} itens · {pct}% preenchido</p>
        </div>
        <StatusBadge status={tarefa.status} />
      </div>

      {/* Barra de progresso */}
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
        <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5 flex-1 text-xs" onClick={() => onCopyLink(tarefa)}>
          <Copy className="w-3.5 h-3.5" /> Copiar Link
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => onOpenLink(tarefa)}>
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 flex-1 text-xs text-green-600 border-green-300 hover:bg-green-50" onClick={() => onCopyWhatsApp(tarefa)}>
          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
        </Button>
      </div>
    </div>
  );
}

function ContagemDetail({ contagem, onClose }) {
  const queryClient = useQueryClient();
  const [aprovando, setAprovando] = useState(false);

  const { data: tarefas = [], refetch } = useQuery({
    queryKey: ['tarefas-contagem', contagem?.id],
    queryFn: () => base44.entities.TarefaContagem.filter({ contagem_id: contagem.id }),
    enabled: !!contagem?.id,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list(),
  });

  const prodMap = {};
  produtos.forEach(p => { prodMap[p.id] = p; });

  const getTarefaUrl = (tarefa) => {
    // Base44 usa HashRouter: todas as rotas ficam em /#/NomePagina
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
    const msg = encodeURIComponent(`Olá ${tarefa.responsavel_nome}! Por favor faça a contagem de estoque — ${tarefa.grupo || 'Geral'}\n\nAcesse aqui: ${url}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const handleAprovar = async () => {
    setAprovando(true);
    try {
      const empresa = await getEmpresaAtiva();
      await aprovarAjusteContagem(contagem, tarefas, empresa.id);
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

  // Calcular divergências
  const divergencias = [];
  for (const tarefa of tarefas) {
    for (const item of (tarefa.itens || [])) {
      if (item.quantidade_contada !== null && item.quantidade_contada !== undefined && item.quantidade_sistema !== null) {
        const diff = (item.quantidade_contada || 0) - (item.quantidade_sistema || 0);
        if (Math.abs(diff) > 0.001) {
          divergencias.push({ ...item, diff, responsavel: tarefa.responsavel_nome, grupo: tarefa.grupo });
        }
      }
    }
  }

  const tarefasFinalizadas = tarefas.filter(t => t.status === 'finalizado').length;
  const podeAprovar = contagem.status !== 'ajustada' && tarefasFinalizadas > 0;

  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-indigo-500" />
          Contagem — {contagem.data_abertura ? format(new Date(contagem.data_abertura), 'dd/MM/yyyy HH:mm') : ''}
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
            {tarefas.map(t => (
              <TarefaCard key={t.id} tarefa={t} onCopyLink={handleCopyLink} onCopyWhatsApp={handleWhatsApp} />
            ))}
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
                    <th className="text-right p-3 text-xs font-medium text-slate-500 uppercase">Esperado</th>
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
        <Button variant="outline" onClick={onClose}>Fechar</Button>
        {podeAprovar && (
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            disabled={aprovando}
            onClick={handleAprovar}
          >
            <CheckCheck className="w-4 h-4" />
            {aprovando ? 'Aprovando...' : `Aprovar Ajuste (${divergencias.length} itens)`}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}

export default function Contagens() {
  const [selectedContagem, setSelectedContagem] = useState(null);

  // Abrir contagem via querystring (vindo de TemplatesContagem)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('contagem_id');
    if (id) {
      base44.entities.Contagem.filter({ id }).then(res => {
        if (res[0]) setSelectedContagem(res[0]);
      });
    }
  }, []);

  const { data: contagens = [], isLoading } = useQuery({
    queryKey: ['contagens'],
    queryFn: () => base44.entities.Contagem.list('-created_date', 50),
  });
  const { data: lojas = [] } = useQuery({ queryKey: ['lojas'], queryFn: () => base44.entities.Loja.list() });

  const getLoja = (id) => lojas.find(l => l.id === id);

  const statusOrder = { aberta: 0, em_contagem: 1, aguardando_conferencia: 2, aprovada: 3, ajustada: 4, cancelada: 5 };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contagens de Estoque"
        subtitle="Acompanhe as contagens geradas e aprove ajustes"
        icon={ClipboardCheck}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Contagens' }]}
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      ) : contagens.length === 0 ? (
        <div className="border-2 border-dashed rounded-2xl p-12 text-center text-slate-400">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-slate-500">Nenhuma contagem gerada ainda</p>
          <p className="text-sm mt-1">Crie um template e clique em "Gerar Contagem Agora".</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.href = '#/' + createPageUrl('TemplatesContagem')}>
            Ver Templates
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
                <div className="flex-1">
                  <p className="font-semibold text-slate-800 dark:text-white">
                    {c.data_abertura ? format(new Date(c.data_abertura), 'dd/MM/yyyy HH:mm') : '—'}
                  </p>
                  <p className="text-xs text-slate-500">{loja?.nome || '—'} · {c.observacoes || c.tipo}</p>
                </div>
                <div className="flex items-center gap-3">
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

      <Dialog open={!!selectedContagem} onOpenChange={v => { if (!v) setSelectedContagem(null); }}>
        {selectedContagem && (
          <ContagemDetail contagem={selectedContagem} onClose={() => setSelectedContagem(null)} />
        )}
      </Dialog>
    </div>
  );
}