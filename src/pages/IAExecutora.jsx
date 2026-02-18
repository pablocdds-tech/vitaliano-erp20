import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import EmptyState from '@/components/ui-custom/EmptyState';
import ConfirmacaoAcaoModal from '@/components/ia/ConfirmacaoAcaoModal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bot, Sparkles, FileText, Package, CreditCard,
  CheckCircle2, Clock, AlertCircle, Loader2, Zap, Brain, History, XCircle
} from 'lucide-react';
import AnaliseFinanceiraIA from '@/components/ia/AnaliseFinanceiraIA';
import { format } from 'date-fns';
import { toast } from 'sonner';

const acoesCatalogo = [
  { id: 'processar_nf', nome: 'Processar Nota Fiscal', descricao: 'Ler e criar lançamentos de NF', icon: FileText, cor: 'blue' },
  { id: 'atualizar_estoque', nome: 'Atualizar Estoque', descricao: 'Ajustar quantidades com contagem', icon: Package, cor: 'emerald' },
  { id: 'criar_lancamento', nome: 'Lançamento Financeiro', descricao: 'Registrar conta a pagar ou receber', icon: CreditCard, cor: 'purple' },
  { id: 'gerar_relatorio', nome: 'Gerar Relatório', descricao: 'Análise ou resumo de dados', icon: Brain, cor: 'amber' },
];

const STATUS_ICON = {
  concluida: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  em_execucao: <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />,
  falha: <AlertCircle className="w-4 h-4 text-red-600" />,
  cancelada: <XCircle className="w-4 h-4 text-slate-400" />,
  aguardando_confirmacao: <Clock className="w-4 h-4 text-amber-600" />,
  pendente: <Clock className="w-4 h-4 text-amber-600" />,
};

export default function IAExecutora() {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [selectedAction, setSelectedAction] = useState(null);
  const [analisando, setAnalisando] = useState(false);
  const [acaoPendente, setAcaoPendente] = useState(null); // { acaoId, tipo_acao, descricao, payload }
  const [executando, setExecutando] = useState(false);

  const { data: acoes = [], isLoading } = useQuery({
    queryKey: ['acoes-ia'],
    queryFn: () => base44.entities.AcaoIA.list('-created_date', 50)
  });

  // PASSO 1: Analisar e gerar ActionLog pending — NÃO executa
  const analisarMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();

      // IA interpreta o pedido e sugere ação estruturada
      const interpretacao = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um assistente de ERP para restaurantes. Interprete o comando abaixo e retorne uma ação estruturada.

Tipo de ação hint: ${selectedAction || 'auto'}
Comando do usuário: "${prompt}"

Retorne um JSON com:
- tipo_acao: um de ["processar_nf", "criar_lancamento", "atualizar_estoque", "gerar_relatorio", "criar_pedido", "outro"]
- descricao: descrição clara em português do que você quer fazer (ex: "Criar conta a pagar de R$ 500 para aluguel vencendo em 10/03/2026")
- payload: objeto com os parâmetros necessários (valores, datas, categorias, etc extraídos do comando)
- requer_confirmacao: true se a ação altera dados financeiros ou de estoque, false se é apenas leitura`,
        response_json_schema: {
          type: 'object',
          properties: {
            tipo_acao: { type: 'string' },
            descricao: { type: 'string' },
            payload: { type: 'object' },
            requer_confirmacao: { type: 'boolean' }
          }
        }
      });

      // Gravar ActionLog com status = aguardando_confirmacao
      const registro = await base44.entities.AcaoIA.create({
        tipo_acao: interpretacao.tipo_acao || 'outro',
        descricao: interpretacao.descricao,
        comando_original: prompt,
        payload: interpretacao.payload || {},
        entrada: { prompt, selectedAction },
        solicitado_por: user?.email || 'desconhecido',
        requer_confirmacao: interpretacao.requer_confirmacao !== false,
        status: 'aguardando_confirmacao',
      });

      return { ...interpretacao, acaoId: registro.id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['acoes-ia'] });
      setAnalisando(false);
      // Se requer confirmação, abre modal
      if (data.requer_confirmacao !== false) {
        setAcaoPendente(data);
      } else {
        // ação de leitura: executa direto
        executarAcao(data);
      }
    },
    onError: () => {
      setAnalisando(false);
      toast.error('Erro ao interpretar o comando');
    }
  });

  // PASSO 2: Executar após confirmação humana
  const executarAcao = async (dados) => {
    setExecutando(true);
    const inicio = Date.now();
    try {
      // Executar via LLM (aqui entraria integração real com entidades)
      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um assistente ERP. A ação foi CONFIRMADA pelo usuário. Execute e retorne o resultado.

Ação: ${dados.tipo_acao}
Descrição: ${dados.descricao}
Parâmetros: ${JSON.stringify(dados.payload || {})}

Retorne:
- sucesso: boolean
- mensagem: o que foi feito
- acoes_realizadas: lista de ações executadas`,
        response_json_schema: {
          type: 'object',
          properties: {
            sucesso: { type: 'boolean' },
            mensagem: { type: 'string' },
            acoes_realizadas: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      // Atualizar ActionLog → executed ou error
      if (dados.acaoId) {
        await base44.entities.AcaoIA.update(dados.acaoId, {
          status: resultado.sucesso ? 'concluida' : 'falha',
          saida: resultado,
          executado_em: new Date().toISOString(),
          tempo_execucao_ms: Date.now() - inicio,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['acoes-ia'] });
      setAcaoPendente(null);
      setPrompt('');
      setSelectedAction(null);

      if (resultado.sucesso) {
        toast.success(resultado.mensagem || 'Ação executada com sucesso!');
      } else {
        toast.error(resultado.mensagem || 'Falha na execução');
      }
    } catch (e) {
      if (dados.acaoId) {
        await base44.entities.AcaoIA.update(dados.acaoId, {
          status: 'falha',
          erro: e.message,
          executado_em: new Date().toISOString(),
        });
        queryClient.invalidateQueries({ queryKey: ['acoes-ia'] });
      }
      toast.error('Erro ao executar a ação');
    } finally {
      setExecutando(false);
    }
  };

  const handleCancelar = async () => {
    if (acaoPendente?.acaoId) {
      await base44.entities.AcaoIA.update(acaoPendente.acaoId, { status: 'cancelada' });
      queryClient.invalidateQueries({ queryKey: ['acoes-ia'] });
    }
    setAcaoPendente(null);
    toast.info('Ação cancelada');
  };

  const handleAnalisar = () => {
    if (!prompt.trim()) { toast.error('Digite um comando'); return; }
    setAnalisando(true);
    analisarMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="IA Executora"
        subtitle="Comandos em linguagem natural com confirmação antes de executar"
        icon={Bot}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'IA Executora' }]}
      />

      {/* Análise Financeira IA */}
      <AnaliseFinanceiraIA />

      {/* Catálogo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {acoesCatalogo.map((acao) => (
          <div
            key={acao.id}
            onClick={() => setSelectedAction(selectedAction === acao.id ? null : acao.id)}
            className={`cursor-pointer rounded-xl border-2 p-3 transition-all hover:shadow-sm flex items-start gap-3
              ${selectedAction === acao.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'}`}
          >
            <div className={`p-2 rounded-lg bg-${acao.cor}-100 dark:bg-${acao.cor}-900/30 shrink-0`}>
              <acao.icon className={`w-4 h-4 text-${acao.cor}-600`} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-white leading-tight">{acao.nome}</p>
              <p className="text-xs text-slate-400 mt-0.5">{acao.descricao}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Terminal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Comando em linguagem natural
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`Digite seu comando...\n\nExemplos:\n• "Criar conta a pagar de R$ 500 para aluguel, vence dia 10/03"\n• "Registrar pagamento da conta de energia de R$ 350"\n• "Ajustar estoque do produto Farinha para 25kg"`}
            rows={4}
            className="resize-none"
            onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleAnalisar(); }}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Ctrl+Enter para analisar</p>
            <Button
              onClick={handleAnalisar}
              disabled={analisando || !prompt.trim()}
              className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              {analisando ? <><Loader2 className="w-4 h-4 animate-spin" />Analisando...</> : <><Zap className="w-4 h-4" />Analisar</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ações pendentes de confirmação */}
      {acoes.filter(a => a.status === 'aguardando_confirmacao').length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Clock className="w-4 h-4" />
              Ações aguardando confirmação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {acoes.filter(a => a.status === 'aguardando_confirmacao').map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-white">{a.descricao}</p>
                  <p className="text-xs text-slate-400">{format(new Date(a.created_date), 'dd/MM HH:mm')}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={async () => {
                    await base44.entities.AcaoIA.update(a.id, { status: 'cancelada' });
                    queryClient.invalidateQueries({ queryKey: ['acoes-ia'] });
                    toast.info('Cancelado');
                  }}>
                    Cancelar
                  </Button>
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => setAcaoPendente({ ...a, acaoId: a.id, payload: a.payload || {} })}>
                    Confirmar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            Histórico de Ações
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {acoes.filter(a => a.status !== 'aguardando_confirmacao').length === 0 && !isLoading ? (
            <div className="p-8">
              <EmptyState icon={Bot} title="Nenhuma execução ainda" description="Execute seu primeiro comando com IA." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500">
                    <th className="text-left p-4">Descrição</th>
                    <th className="text-left p-4">Data</th>
                    <th className="text-left p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {acoes.filter(a => a.status !== 'aguardando_confirmacao').slice(0, 20).map((acao) => (
                    <tr key={acao.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-4">
                        <p className="text-sm text-slate-800 dark:text-white">{acao.descricao}</p>
                        {acao.comando_original && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">"{acao.comando_original}"</p>
                        )}
                      </td>
                      <td className="p-4 text-sm text-slate-500 whitespace-nowrap">
                        {format(new Date(acao.created_date), 'dd/MM HH:mm')}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {STATUS_ICON[acao.status] || <Clock className="w-4 h-4 text-slate-400" />}
                          <StatusBadge status={acao.status} size="xs" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de confirmação */}
      <ConfirmacaoAcaoModal
        acao={acaoPendente}
        onConfirmar={() => executarAcao(acaoPendente)}
        onCancelar={handleCancelar}
        loading={executando}
      />
    </div>
  );
}