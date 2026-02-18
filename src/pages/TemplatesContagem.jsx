import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ClipboardList, Plus, Trash2, Search, PackagePlus, Pencil,
  Play, Calendar, Users, ChevronRight, X
} from 'lucide-react';
import { toast } from 'sonner';
import { gerarContagemDeTemplate } from '@/components/services/contagemService';
import { getEmpresaAtiva } from '@/components/services/tenantService';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';

const DIAS_SEMANA = [
  { label: 'Dom', value: 0 }, { label: 'Seg', value: 1 }, { label: 'Ter', value: 2 },
  { label: 'Qua', value: 3 }, { label: 'Qui', value: 4 }, { label: 'Sex', value: 5 },
  { label: 'Sáb', value: 6 },
];

function ProdutoSearch({ produtos, onSelect }) {
  const [q, setQ] = useState('');
  const filtered = q.length >= 2
    ? produtos.filter(p => p.nome.toLowerCase().includes(q.toLowerCase()) || (p.codigo || '').toLowerCase().includes(q.toLowerCase()))
    : [];

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
        <Input className="pl-7 h-8 text-xs" placeholder="Buscar produto..." value={q}
          onChange={e => setQ(e.target.value)} />
      </div>
      {filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border rounded-lg shadow-lg max-h-36 overflow-y-auto">
          {filtered.map(p => (
            <button key={p.id} type="button"
              className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs"
              onClick={() => { onSelect(p); setQ(''); }}>
              <span className="font-medium">{p.nome}</span>
              {p.unidade_medida && <span className="ml-2 text-slate-400">({p.unidade_medida})</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateForm({ template, lojas, produtos, onSave, onClose }) {
  const [form, setForm] = useState(template || {
    nome: '', loja_id: '', periodicidade_tipo: 'semanal',
    periodicidade_dias_semana: [], periodicidade_dia_mes: 1,
    tarefas: [], observacoes: '',
  });

  const toggleDia = (d) => {
    const dias = form.periodicidade_dias_semana || [];
    setForm({ ...form, periodicidade_dias_semana: dias.includes(d) ? dias.filter(x => x !== d) : [...dias, d] });
  };

  const addTarefa = () => setForm(f => ({ ...f, tarefas: [...(f.tarefas || []), { responsavel_nome: '', grupo: '', itens: [] }] }));
  const removeTarefa = (ti) => setForm(f => ({ ...f, tarefas: f.tarefas.filter((_, i) => i !== ti) }));
  const updateTarefa = (ti, patch) => setForm(f => ({ ...f, tarefas: f.tarefas.map((t, i) => i === ti ? { ...t, ...patch } : t) }));

  const addItemTarefa = (ti, prod) => {
    const tarefa = form.tarefas[ti];
    if (tarefa.itens.find(it => it.produto_id === prod.id)) { toast.error('Produto já adicionado'); return; }
    updateTarefa(ti, { itens: [...tarefa.itens, { produto_id: prod.id, produto_nome: prod.nome }] });
  };
  const removeItemTarefa = (ti, ii) => {
    updateTarefa(ti, { itens: form.tarefas[ti].itens.filter((_, i) => i !== ii) });
  };

  const handleSave = () => {
    if (!form.nome || !form.loja_id) { toast.error('Nome e loja são obrigatórios'); return; }
    onSave(form);
  };

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{template?.id ? 'Editar' : 'Novo'} Template de Contagem</DialogTitle></DialogHeader>

      <div className="space-y-5">
        {/* Dados básicos */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Nome do Template *</Label>
            <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Contagem Insumos Semanal" />
          </div>
          <div className="space-y-1">
            <Label>Loja / CD *</Label>
            <Select value={form.loja_id || '__none__'} onValueChange={v => setForm({ ...form, loja_id: v === '__none__' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Selecione...</SelectItem>
                {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Periodicidade */}
        <div className="border rounded-lg p-4 space-y-3 bg-slate-50 dark:bg-slate-800/40">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2"><Calendar className="w-4 h-4" /> Periodicidade</p>
          <div className="flex gap-3">
            {['diaria', 'semanal', 'mensal'].map(t => (
              <button key={t} type="button"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${form.periodicidade_tipo === t ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 text-slate-600 dark:text-slate-300 hover:border-indigo-400'}`}
                onClick={() => setForm({ ...form, periodicidade_tipo: t })}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          {form.periodicidade_tipo === 'semanal' && (
            <div className="flex gap-2 flex-wrap">
              {DIAS_SEMANA.map(d => (
                <button key={d.value} type="button"
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${(form.periodicidade_dias_semana || []).includes(d.value) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 text-slate-500 hover:border-indigo-400'}`}
                  onClick={() => toggleDia(d.value)}>
                  {d.label}
                </button>
              ))}
            </div>
          )}
          {form.periodicidade_tipo === 'mensal' && (
            <div className="flex items-center gap-2">
              <Label className="shrink-0">Dia do mês:</Label>
              <Input type="number" min="1" max="31" className="w-20 h-8" value={form.periodicidade_dia_mes || 1}
                onChange={e => setForm({ ...form, periodicidade_dia_mes: parseInt(e.target.value) || 1 })} />
            </div>
          )}
        </div>

        {/* Tarefas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Users className="w-4 h-4" /> Tarefas por Responsável</p>
            <Button type="button" variant="outline" size="sm" onClick={addTarefa} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar Tarefa
            </Button>
          </div>

          {(form.tarefas || []).map((tarefa, ti) => (
            <div key={ti} className="border rounded-xl p-4 space-y-3 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-bold text-indigo-600">{ti + 1}</div>
                <Input className="flex-1 h-8 text-sm" placeholder="Nome do responsável" value={tarefa.responsavel_nome}
                  onChange={e => updateTarefa(ti, { responsavel_nome: e.target.value })} />
                <Input className="flex-1 h-8 text-sm" placeholder="Grupo (ex: Insumos)" value={tarefa.grupo || ''}
                  onChange={e => updateTarefa(ti, { grupo: e.target.value })} />
                <button type="button" onClick={() => removeTarefa(ti)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Itens da tarefa */}
              <div className="space-y-1.5 ml-8">
                {(tarefa.itens || []).map((item, ii) => (
                  <div key={ii} className="flex items-center gap-2 text-xs bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                    <span className="flex-1 font-medium">{item.produto_nome}</span>
                    <button type="button" onClick={() => removeItemTarefa(ti, ii)} className="text-slate-400 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <ProdutoSearch produtos={produtos} onSelect={p => addItemTarefa(ti, p)} />
              </div>
            </div>
          ))}

          {(form.tarefas || []).length === 0 && (
            <div className="border-2 border-dashed rounded-xl p-6 text-center text-slate-400 text-sm">
              Adicione tarefas para cada responsável
            </div>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave}>Salvar Template</Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function TemplatesContagem() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [gerando, setGerando] = useState(null); // id do template em geração

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates-contagem'],
    queryFn: () => base44.entities.TemplateContagem.list('-created_date', 50),
  });
  const { data: lojas = [] } = useQuery({ queryKey: ['lojas'], queryFn: () => base44.entities.Loja.list() });
  const { data: produtos = [] } = useQuery({ queryKey: ['produtos'], queryFn: () => base44.entities.Produto.filter({ status: 'ativo' }) });

  const saveMutation = useMutation({
    mutationFn: async (form) => {
      const empresa = await getEmpresaAtiva();
      const data = { ...form, empresa_id: empresa.id };
      if (editingTemplate?.id) return base44.entities.TemplateContagem.update(editingTemplate.id, data);
      return base44.entities.TemplateContagem.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates-contagem'] });
      toast.success('Template salvo!');
      setModalOpen(false);
      setEditingTemplate(null);
    },
    onError: e => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TemplateContagem.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['templates-contagem'] }); toast.success('Template removido'); },
  });

  const handleGerar = async (template) => {
    setGerando(template.id);
    try {
      const { contagem } = await gerarContagemDeTemplate(template, produtos);
      queryClient.invalidateQueries({ queryKey: ['contagens'] });
      toast.success('Contagem gerada com sucesso!');
      navigate(createPageUrl('Contagens') + `?contagem_id=${contagem.id}`);
    } catch (e) {
      toast.error('Erro ao gerar: ' + e.message);
    } finally {
      setGerando(null);
    }
  };

  const handleEdit = (t) => { setEditingTemplate(t); setModalOpen(true); };

  const getLoja = (id) => lojas.find(l => l.id === id);
  const periodicidadeLabel = (t) => {
    if (t.periodicidade_tipo === 'diaria') return 'Diária';
    if (t.periodicidade_tipo === 'mensal') return `Mensal (dia ${t.periodicidade_dia_mes || 1})`;
    const dias = (t.periodicidade_dias_semana || []).map(d => DIAS_SEMANA[d]?.label).join(', ');
    return `Semanal${dias ? `: ${dias}` : ''}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates de Contagem"
        subtitle="Configure modelos periódicos para geração automática de contagens"
        icon={ClipboardList}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Templates Contagem' }]}
        actions={
          <Button onClick={() => { setEditingTemplate(null); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Template
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="border-2 border-dashed rounded-2xl p-12 text-center text-slate-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-slate-500">Nenhum template criado</p>
          <p className="text-sm mt-1">Crie um template para gerar contagens com tarefas por responsável.</p>
          <Button className="mt-4" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4 mr-2" />Criar Template</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 flex-row items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-white">{t.nome}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{getLoja(t.loja_id)?.nome || '-'}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(t)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {periodicidadeLabel(t)}
                </div>
                <div className="space-y-1">
                  {(t.tarefas || []).map((tar, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                      <span className="font-medium">{tar.responsavel_nome}</span>
                      {tar.grupo && <span className="text-slate-400">— {tar.grupo}</span>}
                      <span className="ml-auto text-slate-400">{(tar.itens || []).length} itens</span>
                    </div>
                  ))}
                  {(t.tarefas || []).length === 0 && <p className="text-xs text-slate-400">Sem tarefas configuradas</p>}
                </div>
                <Button
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-sm"
                  disabled={gerando === t.id}
                  onClick={() => handleGerar(t)}
                >
                  <Play className="w-4 h-4" />
                  {gerando === t.id ? 'Gerando...' : 'Gerar Contagem Agora'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={v => { setModalOpen(v); if (!v) setEditingTemplate(null); }}>
        <TemplateForm
          template={editingTemplate}
          lojas={lojas}
          produtos={produtos}
          onSave={d => saveMutation.mutate(d)}
          onClose={() => { setModalOpen(false); setEditingTemplate(null); }}
        />
      </Dialog>
    </div>
  );
}