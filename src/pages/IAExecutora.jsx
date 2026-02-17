import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import EmptyState from '@/components/ui-custom/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Bot, 
  Sparkles, 
  Send, 
  FileText, 
  Package, 
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Upload,
  Zap,
  Brain,
  History
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const acoesCatalogo = [
  {
    id: 'processar_nf',
    nome: 'Processar Nota Fiscal',
    descricao: 'Ler XML ou imagem de NF e criar lançamentos',
    icon: FileText,
    cor: 'blue'
  },
  {
    id: 'atualizar_estoque',
    nome: 'Atualizar Estoque',
    descricao: 'Ajustar quantidades com base em contagem',
    icon: Package,
    cor: 'emerald'
  },
  {
    id: 'criar_lancamento',
    nome: 'Criar Lançamento Financeiro',
    descricao: 'Registrar conta a pagar ou receber',
    icon: CreditCard,
    cor: 'purple'
  },
  {
    id: 'gerar_relatorio',
    nome: 'Gerar Relatório',
    descricao: 'Criar análise ou resumo de dados',
    icon: Brain,
    cor: 'amber'
  }
];

export default function IAExecutora() {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [file, setFile] = useState(null);

  const { data: acoes = [], isLoading } = useQuery({
    queryKey: ['acoes-ia'],
    queryFn: () => base44.entities.AcaoIA.list('-created_date', 50)
  });

  const executeMutation = useMutation({
    mutationFn: async ({ tipo, prompt, file }) => {
      // Registrar início da ação
      const acao = await base44.entities.AcaoIA.create({
        tipo_acao: tipo,
        descricao: prompt,
        status: 'em_execucao',
        entrada: { prompt }
      });

      let fileUrl = null;
      if (file) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        fileUrl = file_url;
      }

      // Executar com IA
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um assistente de ERP especializado em restaurantes.
        
Ação solicitada: ${tipo}
Comando do usuário: ${prompt}

${fileUrl ? `Arquivo anexado: ${fileUrl}` : ''}

Analise o comando e execute a ação apropriada. 
Retorne um JSON com:
- sucesso: boolean
- mensagem: string explicando o que foi feito
- dados: objeto com os dados processados
- acoes_realizadas: array de strings com as ações executadas`,
        response_json_schema: {
          type: 'object',
          properties: {
            sucesso: { type: 'boolean' },
            mensagem: { type: 'string' },
            dados: { type: 'object' },
            acoes_realizadas: { type: 'array', items: { type: 'string' } }
          }
        },
        file_urls: fileUrl ? [fileUrl] : undefined
      });

      // Atualizar ação com resultado
      await base44.entities.AcaoIA.update(acao.id, {
        status: response.sucesso ? 'concluida' : 'falha',
        saida: response
      });

      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['acoes-ia'] });
      setResult(data);
      setExecuting(false);
      if (data.sucesso) {
        toast.success('Ação executada com sucesso!');
      } else {
        toast.error('Falha na execução');
      }
    },
    onError: (error) => {
      setExecuting(false);
      toast.error('Erro ao executar ação');
    }
  });

  const handleExecute = () => {
    if (!prompt.trim()) {
      toast.error('Digite um comando');
      return;
    }
    setExecuting(true);
    setResult(null);
    executeMutation.mutate({
      tipo: selectedAction || 'outro',
      prompt,
      file
    });
  };

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'concluida':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'em_execucao':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'falha':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-amber-600" />;
    }
  };

  const columns = [
    {
      key: 'tipo_acao',
      label: 'Tipo',
      render: (value) => (
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-purple-600" />
          <span className="capitalize">{value?.replace(/_/g, ' ')}</span>
        </div>
      )
    },
    {
      key: 'descricao',
      label: 'Descrição',
      render: (value) => (
        <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[300px] block">
          {value}
        </span>
      )
    },
    {
      key: 'created_date',
      label: 'Data',
      sortable: true,
      render: (value) => format(new Date(value), 'dd/MM/yyyy HH:mm')
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <div className="flex items-center gap-2">
          {getStatusIcon(value)}
          <StatusBadge status={value} />
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="IA Executora"
        subtitle="Execute ações automatizadas com inteligência artificial"
        icon={Bot}
        breadcrumbs={[
          { label: 'Dashboard', href: 'Dashboard' },
          { label: 'IA Executora' }
        ]}
      />

      {/* Catálogo de Ações */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {acoesCatalogo.map((acao) => (
          <Card 
            key={acao.id}
            className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] border-2 ${
              selectedAction === acao.id 
                ? `border-${acao.cor}-500 bg-${acao.cor}-50 dark:bg-${acao.cor}-900/20`
                : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700'
            }`}
            onClick={() => setSelectedAction(selectedAction === acao.id ? null : acao.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl bg-${acao.cor}-100 dark:bg-${acao.cor}-900/30`}>
                  <acao.icon className={`w-5 h-5 text-${acao.cor}-600`} />
                </div>
                <div>
                  <p className="font-medium text-slate-800 dark:text-white">{acao.nome}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{acao.descricao}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Terminal de Comando */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Terminal de Comando IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Digite seu comando em linguagem natural...

Exemplos:
- 'Processe a nota fiscal anexada e lance no estoque'
- 'Crie uma conta a pagar de R$ 500 para aluguel, vencendo dia 10'
- 'Gere um relatório de vendas do último mês'"
                rows={4}
                className="resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="file"
                onChange={handleFileChange}
                className="hidden"
                id="ia-file"
                accept=".xml,.pdf,.jpg,.jpeg,.png"
              />
              <label htmlFor="ia-file">
                <Button variant="outline" asChild className="cursor-pointer">
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    {file ? file.name : 'Anexar Arquivo'}
                  </span>
                </Button>
              </label>
              {selectedAction && (
                <span className="text-sm text-slate-500">
                  Ação selecionada: <span className="font-medium">{selectedAction.replace(/_/g, ' ')}</span>
                </span>
              )}
            </div>

            <Button 
              onClick={handleExecute} 
              disabled={executing || !prompt.trim()}
              className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              {executing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Executando...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Executar
                </>
              )}
            </Button>
          </div>

          {/* Resultado */}
          {result && (
            <div className={`mt-4 p-4 rounded-xl ${
              result.sucesso 
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-start gap-3">
                {result.sucesso ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                )}
                <div>
                  <p className={`font-medium ${result.sucesso ? 'text-emerald-800' : 'text-red-800'}`}>
                    {result.mensagem}
                  </p>
                  {result.acoes_realizadas?.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {result.acoes_realizadas.map((acao, idx) => (
                        <li key={idx} className="text-sm text-slate-600 flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          {acao}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <History className="w-5 h-5 text-slate-500" />
            Histórico de Execuções
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {acoes.length === 0 && !isLoading ? (
            <div className="p-8">
              <EmptyState
                icon={Bot}
                title="Nenhuma execução ainda"
                description="Execute seu primeiro comando com IA."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500">
                    <th className="text-left p-4">Tipo</th>
                    <th className="text-left p-4">Descrição</th>
                    <th className="text-left p-4">Data</th>
                    <th className="text-left p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {acoes.slice(0, 10).map((acao) => (
                    <tr key={acao.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 text-purple-600" />
                          <span className="text-sm capitalize">{acao.tipo_acao?.replace(/_/g, ' ')}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[300px] block">
                          {acao.descricao}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-500">
                        {format(new Date(acao.created_date), 'dd/MM HH:mm')}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(acao.status)}
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
    </div>
  );
}