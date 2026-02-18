import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import MoneyDisplay from '@/components/ui-custom/MoneyDisplay';
import EmptyState from '@/components/ui-custom/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileText, 
  Plus, 
  Upload, 
  Eye, 
  CheckCircle2, 
  Bot,
  Building2,
  Calendar,
  FileUp,
  Loader2,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { processarEntrada } from '@/components/services/estoqueService';
import { criarContasPagarNF } from '@/components/services/financeiroService';
import { getEmpresaAtiva } from '@/components/services/tenantService';

export default function NotasFiscais() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModal, setViewModal] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [formData, setFormData] = useState({
    loja_id: '',
    fornecedor_id: '',
    numero: '',
    serie: '',
    data_emissao: '',
    data_entrada: '',
    valor_total: 0,
    chave_acesso: ''
  });

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ['notas-fiscais'],
    queryFn: () => base44.entities.NotaFiscal.list('-created_date', 50)
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Fornecedor.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.NotaFiscal.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] });
      setModalOpen(false);
      resetForm();
      toast.success('Nota fiscal cadastrada!');
    },
    onError: () => toast.error('Erro ao cadastrar nota fiscal')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.NotaFiscal.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] });
      toast.success('Nota fiscal atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar nota fiscal')
  });

  const resetForm = () => {
    setFormData({
      loja_id: '',
      fornecedor_id: '',
      numero: '',
      serie: '',
      data_emissao: '',
      data_entrada: '',
      valor_total: 0,
      chave_acesso: ''
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    
    setUploading(false);
    setProcessing(true);
    
    // Processar XML com IA
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Extraia os dados desta nota fiscal XML: ${file_url}
      
      Retorne um JSON com:
      - numero: número da NF
      - serie: série
      - data_emissao: data de emissão (YYYY-MM-DD)
      - fornecedor_cnpj: CNPJ do emitente
      - fornecedor_nome: nome do emitente
      - valor_total: valor total
      - chave_acesso: chave de acesso NFe
      - itens: array com {descricao, quantidade, valor_unitario, valor_total}`,
      response_json_schema: {
        type: 'object',
        properties: {
          numero: { type: 'string' },
          serie: { type: 'string' },
          data_emissao: { type: 'string' },
          fornecedor_cnpj: { type: 'string' },
          fornecedor_nome: { type: 'string' },
          valor_total: { type: 'number' },
          chave_acesso: { type: 'string' },
          itens: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                descricao: { type: 'string' },
                quantidade: { type: 'number' },
                valor_unitario: { type: 'number' },
                valor_total: { type: 'number' }
              }
            }
          }
        }
      },
      file_urls: [file_url]
    });

    setProcessing(false);

    if (result) {
      setFormData({
        ...formData,
        numero: result.numero || '',
        serie: result.serie || '',
        data_emissao: result.data_emissao || '',
        data_entrada: format(new Date(), 'yyyy-MM-dd'),
        valor_total: result.valor_total || 0,
        chave_acesso: result.chave_acesso || '',
        itens: result.itens || []
      });
      
      toast.success('Nota fiscal processada pela IA!');
    }
  };

  const handleConferir = async (nota) => {
    await updateMutation.mutateAsync({
      id: nota.id,
      data: { status: 'conferida' }
    });
  };

  const handleLancar = async (nota) => {
    try {
      // 1. Obter empresa ativa para garantir multi-tenant
      const empresa = await getEmpresaAtiva();

      // 2. Atualizar status da nota
      await updateMutation.mutateAsync({ id: nota.id, data: { status: 'lancada' } });

      // 3. Processar entradas de estoque via estoqueService (CMP + movimentação)
      if (nota.itens?.length > 0) {
        for (const item of nota.itens) {
          if (!item.produto_id || !item.quantidade) continue;
          await processarEntrada({
            empresa_id: empresa.id,
            loja_id: nota.loja_id,
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            custo_unitario: item.valor_unitario || 0,
            documento_tipo: 'nota_fiscal',
            documento_id: nota.id,
            observacao: `Entrada via NF ${nota.numero}/${nota.serie || '1'}`,
          });
        }
      }

      // 4. Gerar contas a pagar via financeiroService
      await criarContasPagarNF({
        empresa_id: empresa.id,
        loja_id: nota.loja_id,
        fornecedor_id: nota.fornecedor_id,
        nota,
      });

      toast.success('Nota lançada! Estoque e financeiro atualizados.');
    } catch (error) {
      toast.error('Erro ao lançar nota: ' + error.message);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const getLoja = (id) => lojas.find(l => l.id === id);
  const getFornecedor = (id) => fornecedores.find(f => f.id === id);

  const columns = [
    {
      key: 'numero',
      label: 'NF',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-slate-800 dark:text-white">{value}</p>
            <p className="text-xs text-slate-500">Série {row.serie || '1'}</p>
          </div>
        </div>
      )
    },
    {
      key: 'fornecedor_id',
      label: 'Fornecedor',
      render: (value) => {
        const forn = getFornecedor(value);
        return forn ? (
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4 text-slate-400" />
            {forn.nome_fantasia || forn.razao_social}
          </div>
        ) : '-';
      }
    },
    {
      key: 'loja_id',
      label: 'Loja',
      render: (value) => {
        const loja = getLoja(value);
        return loja?.nome || '-';
      }
    },
    {
      key: 'data_entrada',
      label: 'Data Entrada',
      sortable: true,
      render: (value) => value ? format(new Date(value), 'dd/MM/yyyy') : '-'
    },
    {
      key: 'valor_total',
      label: 'Valor Total',
      sortable: true,
      render: (value) => <MoneyDisplay value={value || 0} size="sm" />
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => <StatusBadge status={value} />
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notas Fiscais"
        subtitle="Gerencie suas notas fiscais de entrada"
        icon={FileText}
        breadcrumbs={[
          { label: 'Dashboard', href: 'Dashboard' },
          { label: 'Notas Fiscais' }
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setModalOpen(true)}>
              <Upload className="w-4 h-4" />
              Importar XML
            </Button>
            <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
              <Plus className="w-4 h-4" />
              Nova NF
            </Button>
          </div>
        }
      />

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Pendentes</p>
                <p className="text-2xl font-bold text-amber-600">
                  {notas.filter(n => n.status === 'pendente').length}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Conferidas</p>
                <p className="text-2xl font-bold text-blue-600">
                  {notas.filter(n => n.status === 'conferida').length}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Eye className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Lançadas</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {notas.filter(n => n.status === 'lancada').length}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Processadas IA</p>
                <p className="text-2xl font-bold text-purple-600">
                  {notas.filter(n => n.processada_ia).length}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Bot className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {notas.length === 0 && !isLoading ? (
        <EmptyState
          icon={FileText}
          title="Nenhuma nota fiscal"
          description="Importe XMLs ou cadastre manualmente suas notas fiscais."
          actionLabel="Importar XML"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={notas}
          loading={isLoading}
          searchPlaceholder="Buscar notas..."
          emptyIcon={FileText}
          emptyTitle="Nenhuma nota encontrada"
          onRowClick={(row) => setViewModal(row)}
          rowActions={(row) => [
            { label: 'Visualizar', icon: Eye, onClick: () => setViewModal(row) },
            ...(row.status === 'pendente' ? [{ label: 'Conferir', icon: CheckCircle2, onClick: () => handleConferir(row) }] : []),
            ...(row.status === 'conferida' ? [{ label: 'Lançar', icon: CheckCircle2, onClick: () => handleLancar(row) }] : [])
          ]}
        />
      )}

      {/* Modal de Cadastro */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Nota Fiscal</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Upload de XML */}
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center">
              <input
                type="file"
                accept=".xml"
                onChange={handleFileUpload}
                className="hidden"
                id="xml-upload"
                disabled={uploading || processing}
              />
              <label htmlFor="xml-upload" className="cursor-pointer">
                {uploading || processing ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                    <p className="text-sm text-slate-600">
                      {uploading ? 'Enviando arquivo...' : 'Processando com IA...'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                      <Sparkles className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-white">
                        Importar XML com IA
                      </p>
                      <p className="text-sm text-slate-500">
                        Arraste ou clique para selecionar o arquivo XML
                      </p>
                    </div>
                  </div>
                )}
              </label>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-slate-950 px-2 text-slate-500">ou preencha manualmente</span>
              </div>
            </div>

            {/* Campos Manuais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Loja *</Label>
                <Select 
                  value={formData.loja_id} 
                  onValueChange={(v) => setFormData({ ...formData, loja_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {lojas.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fornecedor *</Label>
                <Select 
                  value={formData.fornecedor_id} 
                  onValueChange={(v) => setFormData({ ...formData, fornecedor_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {fornecedores.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome_fantasia || f.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Número da NF *</Label>
                <Input
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  placeholder="000001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Série</Label>
                <Input
                  value={formData.serie}
                  onChange={(e) => setFormData({ ...formData, serie: e.target.value })}
                  placeholder="1"
                />
              </div>
              <div className="space-y-2">
                <Label>Data Emissão</Label>
                <Input
                  type="date"
                  value={formData.data_emissao}
                  onChange={(e) => setFormData({ ...formData, data_emissao: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Entrada</Label>
                <Input
                  type="date"
                  value={formData.data_entrada}
                  onChange={(e) => setFormData({ ...formData, data_entrada: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Total (R$)</Label>
                <Input
                  type="number"
                  value={formData.valor_total}
                  onChange={(e) => setFormData({ ...formData, valor_total: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label>Chave de Acesso</Label>
                <Input
                  value={formData.chave_acesso}
                  onChange={(e) => setFormData({ ...formData, chave_acesso: e.target.value })}
                  placeholder="44 dígitos"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Cadastrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Visualização */}
      <Dialog open={!!viewModal} onOpenChange={() => setViewModal(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nota Fiscal {viewModal?.numero}</DialogTitle>
          </DialogHeader>
          
          {viewModal && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Número/Série</p>
                  <p className="font-medium">{viewModal.numero}/{viewModal.serie || '1'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Data Emissão</p>
                  <p className="font-medium">
                    {viewModal.data_emissao ? format(new Date(viewModal.data_emissao), 'dd/MM/yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Valor Total</p>
                  <MoneyDisplay value={viewModal.valor_total || 0} size="lg" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <StatusBadge status={viewModal.status} />
                </div>
              </div>

              {viewModal.itens?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Itens da Nota</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                          <th className="text-left p-3">Descrição</th>
                          <th className="text-right p-3">Qtd</th>
                          <th className="text-right p-3">Vl. Unit.</th>
                          <th className="text-right p-3">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewModal.itens.map((item, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-3">{item.descricao_nf || item.descricao}</td>
                            <td className="p-3 text-right">{item.quantidade}</td>
                            <td className="p-3 text-right">
                              <MoneyDisplay value={item.valor_unitario || 0} size="xs" />
                            </td>
                            <td className="p-3 text-right">
                              <MoneyDisplay value={item.valor_total || 0} size="xs" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <DialogFooter>
                {viewModal.status === 'pendente' && (
                  <Button onClick={() => { handleConferir(viewModal); setViewModal(null); }}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Conferir
                  </Button>
                )}
                {viewModal.status === 'conferida' && (
                  <Button onClick={() => { handleLancar(viewModal); setViewModal(null); }}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Lançar no Sistema
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}