import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import EmptyState from '@/components/ui-custom/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckSquare, 
  Plus, 
  Play, 
  ClipboardList,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Pencil,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Checklists() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [executeModal, setExecuteModal] = useState(null);
  const [respostas, setRespostas] = useState({});
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    categoria: 'abertura',
    frequencia: 'diario',
    itens: []
  });
  const [novoItem, setNovoItem] = useState({ pergunta: '', tipo_resposta: 'sim_nao', obrigatorio: true });

  const { data: checklists = [], isLoading } = useQuery({
    queryKey: ['checklists'],
    queryFn: () => base44.entities.Checklist.list()
  });

  const { data: respostasHoje = [] } = useQuery({
    queryKey: ['respostas-checklist'],
    queryFn: () => base44.entities.RespostaChecklist.filter(
      { data: format(new Date(), 'yyyy-MM-dd') },
      '-created_date'
    )
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Checklist.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      setModalOpen(false);
      resetForm();
      toast.success('Checklist criado!');
    }
  });

  const createRespostaMutation = useMutation({
    mutationFn: (data) => base44.entities.RespostaChecklist.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['respostas-checklist'] });
      setExecuteModal(null);
      setRespostas({});
      toast.success('Checklist respondido com sucesso!');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Checklist.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      toast.success('Checklist excluído!');
    }
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      descricao: '',
      categoria: 'abertura',
      frequencia: 'diario',
      itens: []
    });
  };

  const addItem = () => {
    if (!novoItem.pergunta.trim()) return;
    setFormData({
      ...formData,
      itens: [...formData.itens, { ...novoItem, ordem: formData.itens.length + 1 }]
    });
    setNovoItem({ pergunta: '', tipo_resposta: 'sim_nao', obrigatorio: true });
  };

  const removeItem = (idx) => {
    setFormData({
      ...formData,
      itens: formData.itens.filter((_, i) => i !== idx)
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleExecute = () => {
    if (!executeModal) return;
    
    const totalItens = executeModal.itens?.length || 0;
    const respostasArray = executeModal.itens?.map((item, idx) => ({
      item_ordem: idx + 1,
      pergunta: item.pergunta,
      resposta: respostas[idx]?.valor || '',
      conforme: respostas[idx]?.valor === 'sim' || respostas[idx]?.valor === '5',
      observacao: respostas[idx]?.observacao || ''
    })) || [];

    const conformes = respostasArray.filter(r => r.conforme).length;
    const percentual = totalItens > 0 ? (conformes / totalItens) * 100 : 0;

    createRespostaMutation.mutate({
      checklist_id: executeModal.id,
      loja_id: lojas[0]?.id,
      data: format(new Date(), 'yyyy-MM-dd'),
      hora_inicio: new Date().toISOString(),
      hora_fim: new Date().toISOString(),
      respostas: respostasArray,
      pontuacao_total: conformes,
      pontuacao_maxima: totalItens,
      percentual_conformidade: percentual,
      aprovado: percentual >= 80,
      status: 'concluido'
    });
  };

  const categoriaIcons = {
    abertura: '🌅',
    fechamento: '🌙',
    limpeza: '🧹',
    qualidade: '✨',
    seguranca: '🔒',
    manutencao: '🔧',
    outro: '📋'
  };

  const getChecklistStatus = (checklist) => {
    const respondido = respostasHoje.some(r => r.checklist_id === checklist.id);
    return respondido ? 'concluido' : 'pendente';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checklists"
        subtitle="Gerencie e execute checklists operacionais"
        icon={CheckSquare}
        breadcrumbs={[
          { label: 'Dashboard', href: 'Dashboard' },
          { label: 'Checklists' }
        ]}
        actions={
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Checklist
          </Button>
        }
      />

      <Tabs defaultValue="templates" className="w-full">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          {checklists.length === 0 && !isLoading ? (
            <EmptyState
              icon={CheckSquare}
              title="Nenhum checklist"
              description="Crie templates de checklist para suas operações."
              actionLabel="Criar Checklist"
              onAction={() => setModalOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {checklists.map((checklist) => {
                const status = getChecklistStatus(checklist);
                return (
                  <Card key={checklist.id} className="hover:shadow-lg transition-all">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{categoriaIcons[checklist.categoria]}</span>
                          <div>
                            <CardTitle className="text-base">{checklist.nome}</CardTitle>
                            <p className="text-xs text-slate-500 capitalize">{checklist.categoria}</p>
                          </div>
                        </div>
                        <StatusBadge status={status} size="xs" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">
                          <ClipboardList className="w-4 h-4 inline mr-1" />
                          {checklist.itens?.length || 0} itens
                        </span>
                        <span className="text-slate-500 capitalize">
                          <Calendar className="w-4 h-4 inline mr-1" />
                          {checklist.frequencia}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          className="flex-1 gap-2" 
                          onClick={() => setExecuteModal(checklist)}
                          disabled={status === 'concluido'}
                        >
                          <Play className="w-4 h-4" />
                          {status === 'concluido' ? 'Concluído' : 'Executar'}
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => deleteMutation.mutate(checklist.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="hoje" className="mt-4">
          <div className="space-y-4">
            {respostasHoje.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="Nenhum checklist executado hoje"
                description="Execute os checklists pendentes na aba Templates."
              />
            ) : (
              respostasHoje.map((resposta) => {
                const checklist = checklists.find(c => c.id === resposta.checklist_id);
                return (
                  <Card key={resposta.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {resposta.aprovado ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                          <div>
                            <p className="font-medium">{checklist?.nome || 'Checklist'}</p>
                            <p className="text-xs text-slate-500">
                              {format(new Date(resposta.created_date), 'HH:mm')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <Progress value={resposta.percentual_conformidade} className="w-24" />
                            <span className="text-sm font-medium">{resposta.percentual_conformidade?.toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <Card>
            <CardContent className="py-8 text-center text-slate-500">
              Histórico completo de execuções
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Criação */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Checklist</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Abertura da Loja"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select 
                  value={formData.categoria} 
                  onValueChange={(v) => setFormData({ ...formData, categoria: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="abertura">🌅 Abertura</SelectItem>
                    <SelectItem value="fechamento">🌙 Fechamento</SelectItem>
                    <SelectItem value="limpeza">🧹 Limpeza</SelectItem>
                    <SelectItem value="qualidade">✨ Qualidade</SelectItem>
                    <SelectItem value="seguranca">🔒 Segurança</SelectItem>
                    <SelectItem value="manutencao">🔧 Manutenção</SelectItem>
                    <SelectItem value="outro">📋 Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                rows={2}
              />
            </div>

            {/* Itens */}
            <div className="space-y-4">
              <Label>Itens do Checklist</Label>
              
              <div className="flex gap-2">
                <Input
                  value={novoItem.pergunta}
                  onChange={(e) => setNovoItem({ ...novoItem, pergunta: e.target.value })}
                  placeholder="Nova pergunta..."
                  className="flex-1"
                />
                <Select 
                  value={novoItem.tipo_resposta} 
                  onValueChange={(v) => setNovoItem({ ...novoItem, tipo_resposta: v })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim_nao">Sim/Não</SelectItem>
                    <SelectItem value="nota_1_5">Nota 1-5</SelectItem>
                    <SelectItem value="texto">Texto</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" onClick={addItem}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                {formData.itens.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <span className="text-sm text-slate-500 w-6">{idx + 1}.</span>
                    <span className="flex-1 text-sm">{item.pergunta}</span>
                    <span className="text-xs text-slate-400 capitalize">{item.tipo_resposta.replace('_', '/')}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(idx)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || formData.itens.length === 0}>
                Criar Checklist
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Execução */}
      <Dialog open={!!executeModal} onOpenChange={() => setExecuteModal(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{categoriaIcons[executeModal?.categoria]}</span>
              {executeModal?.nome}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {executeModal?.itens?.map((item, idx) => (
              <div key={idx} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="font-medium text-sm mb-3">{idx + 1}. {item.pergunta}</p>
                
                {item.tipo_resposta === 'sim_nao' && (
                  <div className="flex gap-2">
                    <Button 
                      variant={respostas[idx]?.valor === 'sim' ? 'default' : 'outline'}
                      className="flex-1 gap-2"
                      onClick={() => setRespostas({ ...respostas, [idx]: { valor: 'sim' } })}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Sim
                    </Button>
                    <Button 
                      variant={respostas[idx]?.valor === 'nao' ? 'destructive' : 'outline'}
                      className="flex-1 gap-2"
                      onClick={() => setRespostas({ ...respostas, [idx]: { valor: 'nao' } })}
                    >
                      <XCircle className="w-4 h-4" />
                      Não
                    </Button>
                  </div>
                )}

                {item.tipo_resposta === 'nota_1_5' && (
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((nota) => (
                      <Button
                        key={nota}
                        variant={respostas[idx]?.valor === String(nota) ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => setRespostas({ ...respostas, [idx]: { valor: String(nota) } })}
                      >
                        {nota}
                      </Button>
                    ))}
                  </div>
                )}

                {item.tipo_resposta === 'texto' && (
                  <Input
                    value={respostas[idx]?.valor || ''}
                    onChange={(e) => setRespostas({ ...respostas, [idx]: { valor: e.target.value } })}
                    placeholder="Digite sua resposta..."
                  />
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExecuteModal(null)}>
              Cancelar
            </Button>
            <Button onClick={handleExecute} disabled={createRespostaMutation.isPending}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Finalizar Checklist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}