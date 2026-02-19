import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClipboardList, CheckCircle2, Package, Loader2, AlertCircle, Play } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ContagemTarefa() {
  // Suporta tanto /ContagemTarefa?token=xxx (hash router: #/ContagemTarefa?token=xxx) quanto window.location.search
  const hashSearch = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
  const params = new URLSearchParams(hashSearch || window.location.search);
  const token = params.get('token');

  const [tarefa, setTarefa] = useState(null);
  const [contagem, setContagem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [itens, setItens] = useState([]);
  const [finalizado, setFinalizado] = useState(false);
  const [iniciado, setIniciado] = useState(false);

  useEffect(() => {
    if (!token) { setError('Token inválido.'); setLoading(false); return; }
    (async () => {
      try {
        const res = await base44.entities.TarefaContagem.filter({ token });
        if (!res[0]) { setError('Tarefa não encontrada.'); setLoading(false); return; }
        const t = res[0];
        if (t.status === 'finalizado') { setFinalizado(true); setTarefa(t); setLoading(false); return; }

        // Busca contagem geral para dados contextuais
        const cRes = await base44.entities.Contagem.filter({ id: t.contagem_id });
        setContagem(cRes[0] || null);
        setTarefa(t);
        setItens((t.itens || []).map(i => ({ ...i, quantidade_contada: i.quantidade_contada ?? '' })));
        // Se já estava em andamento, pula a tela de boas-vindas
        if (t.status === 'em_andamento') setIniciado(true);
        setLoading(false);
      } catch (e) {
        setError('Erro ao carregar tarefa.');
        setLoading(false);
      }
    })();
  }, [token]);

  const updateQtd = (idx, val) => {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, quantidade_contada: val } : it));
  };

  const updateObs = (idx, val) => {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, observacao: val } : it));
  };

  const salvarMutation = useMutation({
    mutationFn: async ({ finalizar }) => {
      const itensPreenchidos = itens.filter(i => i.quantidade_contada !== '' && i.quantidade_contada !== null);
      await base44.entities.TarefaContagem.update(tarefa.id, {
        itens: itens.map(i => ({
          ...i,
          quantidade_contada: i.quantidade_contada === '' ? null : parseFloat(i.quantidade_contada),
        })),
        itens_preenchidos: itensPreenchidos.length,
        status: finalizar ? 'finalizado' : 'em_andamento',
        ...(finalizar ? { finalizado_em: new Date().toISOString() } : {}),
      });
      if (finalizar) setFinalizado(true);
      else toast.success('Rascunho salvo!');
    },
    onError: e => toast.error('Erro: ' + e.message),
  });

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-3" />
        <p className="text-slate-500">Carregando sua tarefa...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center max-w-sm">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="font-semibold text-slate-700 text-lg">Acesso não encontrado</p>
        <p className="text-slate-500 mt-1">{error}</p>
      </div>
    </div>
  );

  if (finalizado) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 px-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Contagem Finalizada!</h2>
        <p className="text-slate-500">Obrigado, <strong>{tarefa?.responsavel_nome}</strong>. Sua contagem foi registrada com sucesso.</p>
        {tarefa?.finalizado_em && (
          <p className="text-xs text-slate-400 mt-3">Finalizado em {format(new Date(tarefa.finalizado_em), 'dd/MM/yyyy HH:mm')}</p>
        )}
      </div>
    </div>
  );

  const preenchidos = itens.filter(i => i.quantidade_contada !== '' && i.quantidade_contada !== null).length;
  const pct = itens.length > 0 ? Math.round((preenchidos / itens.length) * 100) : 0;

  // Tela de boas-vindas antes de iniciar
  if (!iniciado) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 px-4">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto">
          <ClipboardList className="w-8 h-8 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Contagem de Estoque</h1>
          <p className="text-slate-500 mt-1">Olá, <strong>{tarefa?.responsavel_nome}</strong>!</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2">
          {tarefa?.grupo && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Grupo</span>
              <span className="font-medium text-slate-700">{tarefa.grupo}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Itens para contar</span>
            <span className="font-bold text-indigo-600">{itens.length} itens</span>
          </div>
        </div>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-left">
          ⚠️ Conte fisicamente cada item. Não consulte o sistema — registre o que você ver na prateleira.
        </p>
        <Button
          className="w-full h-12 text-base gap-2 bg-indigo-600 hover:bg-indigo-700"
          onClick={() => setIniciado(true)}
        >
          <Play className="w-5 h-5" />
          Iniciar Contagem
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-4 shadow-sm">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-indigo-100">
              <ClipboardList className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-lg leading-tight">Contagem de Estoque</h1>
              <p className="text-sm text-slate-500">{tarefa?.responsavel_nome} · {tarefa?.grupo || 'Geral'}</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-100 rounded-full h-2">
              <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-slate-500 shrink-0">{preenchidos}/{itens.length}</span>
          </div>
        </div>
      </div>

      {/* Itens */}
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3 pb-32">
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠️ Preencha a quantidade física que você contou. Não consulte o sistema — conte fisicamente!
        </p>

        {itens.map((item, idx) => (
          <div key={idx} className={`border rounded-xl p-4 bg-white transition-all ${item.quantidade_contada !== '' && item.quantidade_contada !== null ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-slate-100 mt-0.5">
                <Package className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800">{item.produto_nome}</p>
                <p className="text-xs text-slate-400">{item.unidade_medida || 'un'}</p>
              </div>
              {item.quantidade_contada !== '' && item.quantidade_contada !== null && (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-1" />
              )}
            </div>
            <div className="mt-3 flex gap-2 items-center">
              <Input
                type="number"
                min="0"
                step="0.001"
                className="flex-1 h-12 text-lg font-semibold text-center"
                placeholder="0,000"
                value={item.quantidade_contada}
                onChange={e => updateQtd(idx, e.target.value)}
              />
              <span className="text-sm text-slate-500 shrink-0">{item.unidade_medida || 'un'}</span>
            </div>
            <Input
              className="mt-2 h-8 text-xs text-slate-500"
              placeholder="Observação (opcional)"
              value={item.observacao || ''}
              onChange={e => updateObs(idx, e.target.value)}
            />
          </div>
        ))}
      </div>

      {/* Footer fixo */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg px-4 py-4">
        <div className="max-w-lg mx-auto flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled={salvarMutation.isPending}
            onClick={() => salvarMutation.mutate({ finalizar: false })}
          >
            Salvar Rascunho
          </Button>
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2"
            disabled={salvarMutation.isPending || preenchidos === 0}
            onClick={() => {
              if (preenchidos < itens.length) {
                if (!window.confirm(`Você preencheu ${preenchidos} de ${itens.length} itens. Deseja finalizar mesmo assim?`)) return;
              }
              salvarMutation.mutate({ finalizar: true });
            }}
          >
            <CheckCircle2 className="w-4 h-4" />
            {salvarMutation.isPending ? 'Salvando...' : 'Finalizar Contagem'}
          </Button>
        </div>
      </div>
    </div>
  );
}