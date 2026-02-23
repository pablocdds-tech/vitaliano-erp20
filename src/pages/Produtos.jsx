import React, { useState, useMemo } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { Package, Plus, Pencil, Trash2, Tags, Upload } from 'lucide-react';
import { toast } from 'sonner';
import ImportarCSVModal, { IMPORT_CONFIGS } from '@/components/importacao/ImportarCSVModal';
import { subDays } from 'date-fns';

export default function Produtos() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    codigo_barras: '',
    categoria_id: '',
    unidade_medida: 'un',
    tipo: 'insumo',
    controla_estoque: true,
    estoque_minimo: 0,
    custo_medio: 0,
    preco_venda: 0,
    ncm: '',
    observacoes: '',
    status: 'ativo'
  });

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list()
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => base44.entities.Categoria.list()
  });

  // Movimentações dos últimos 30 dias para custo médio real
  const { data: movimentacoes30d = [] } = useQuery({
    queryKey: ['movimentacoes-30d'],
    queryFn: () => base44.entities.MovimentacaoEstoque.filter({
      tipo: 'entrada'
    })
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Produto.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      setModalOpen(false);
      resetForm();
      toast.success('Produto criado com sucesso!');
    },
    onError: () => toast.error('Erro ao criar produto')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Produto.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      setModalOpen(false);
      resetForm();
      toast.success('Produto atualizado com sucesso!');
    },
    onError: () => toast.error('Erro ao atualizar produto')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Produto.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast.success('Produto excluído com sucesso!');
    },
    onError: () => toast.error('Erro ao excluir produto')
  });

  const handleBulkDelete = async (ids) => {
    if (!window.confirm(`Deseja excluir ${ids.length} produto(s) selecionado(s)?`)) return;
    for (const id of ids) {
      await base44.entities.Produto.delete(id);
    }
    queryClient.invalidateQueries({ queryKey: ['produtos'] });
    toast.success(`${ids.length} produto(s) excluído(s)!`);
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      codigo: '',
      codigo_barras: '',
      categoria_id: '',
      unidade_medida: 'un',
      tipo: 'insumo',
      controla_estoque: true,
      estoque_minimo: 0,
      custo_medio: 0,
      preco_venda: 0,
      ncm: '',
      observacoes: '',
      status: 'ativo'
    });
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      nome: item.nome || '',
      codigo: item.codigo || '',
      codigo_barras: item.codigo_barras || '',
      categoria_id: item.categoria_id || '',
      unidade_medida: item.unidade_medida || 'un',
      tipo: item.tipo || 'insumo',
      controla_estoque: item.controla_estoque !== false,
      estoque_minimo: item.estoque_minimo || 0,
      custo_medio: item.custo_medio || 0,
      preco_venda: item.preco_venda || 0,
      ncm: item.ncm || '',
      observacoes: item.observacoes || '',
      status: item.status || 'ativo'
    });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getCategoria = (id) => categorias.find(c => c.id === id);

  // Custo médio dos últimos 30 dias por produto
  const custoMedio30d = useMemo(() => {
    const corte = subDays(new Date(), 30);
    const mapa = {};
    for (const mov of movimentacoes30d) {
      if (!mov.custo_unitario || !mov.produto_id) continue;
      const data = new Date(mov.created_date);
      if (data < corte) continue;
      if (!mapa[mov.produto_id]) mapa[mov.produto_id] = { soma: 0, qtd: 0 };
      mapa[mov.produto_id].soma += mov.custo_unitario;
      mapa[mov.produto_id].qtd += 1;
    }
    const result = {};
    for (const [pid, val] of Object.entries(mapa)) {
      result[pid] = val.soma / val.qtd;
    }
    return result;
  }, [movimentacoes30d]);

  // Dados filtrados por categoria e status
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      if (filtroCategoria && p.categoria_id !== filtroCategoria) return false;
      if (filtroStatus && p.status !== filtroStatus) return false;
      return true;
    });
  }, [produtos, filtroCategoria, filtroStatus]);

  const columns = [
    {
      key: 'nome',
      label: 'Produto',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Package className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <p className="font-medium text-slate-800 dark:text-white">{value}</p>
            <p className="text-xs text-slate-500">{row.codigo || '-'}</p>
          </div>
        </div>
      )
    },
    {
      key: 'categoria_id',
      label: 'Categoria',
      render: (value) => {
        const cat = getCategoria(value);
        return cat ? (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <Tags className="w-3.5 h-3.5 text-slate-400" />
            {cat.nome}
          </span>
        ) : '-';
      }
    },
    {
      key: 'unidade_medida',
      label: 'Unidade',
      render: (value) => (
        <span className="uppercase text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
          {value}
        </span>
      )
    },
    {
      key: 'custo_medio',
      label: 'Custo Médio (30d)',
      sortable: true,
      render: (value, row) => {
        const c30 = custoMedio30d[row.id];
        return (
          <div>
            <MoneyDisplay value={c30 ?? value ?? 0} size="sm" />
            {c30 !== undefined && (
              <p className="text-xs text-slate-400">30d</p>
            )}
          </div>
        );
      }
    },
    {
      key: 'estoque_minimo',
      label: 'Est. Mínimo',
      sortable: true,
      render: (value, row) => (
        <span className="text-sm">{value || 0} {row.unidade_medida}</span>
      )
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
        title="Produtos"
        subtitle="Gerencie seus produtos e insumos"
        icon={Package}
        breadcrumbs={[
          { label: 'Dashboard', href: 'Dashboard' },
          { label: 'Produtos' }
        ]}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setImportarOpen(true)} className="gap-2 w-full sm:w-auto">
              <Upload className="w-4 h-4" /> Importar CSV
            </Button>
            <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" /> Novo Produto
            </Button>
          </div>
        }
      />

      {produtos.length === 0 && !isLoading ? (
        <EmptyState
          icon={Package}
          title="Nenhum produto cadastrado"
          description="Comece cadastrando seus produtos e insumos."
          actionLabel="Cadastrar Produto"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={produtosFiltrados}
          loading={isLoading}
          searchPlaceholder="Buscar produtos..."
          emptyIcon={Package}
          emptyTitle="Nenhum produto encontrado"
          onBulkDelete={handleBulkDelete}
          filterBar={
            <div className="flex gap-2 flex-wrap">
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="h-9 w-40 text-xs">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todas categorias</SelectItem>
                  {categorias.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="h-9 w-32 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="descontinuado">Descontinuado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          rowActions={(row) => [
            { label: 'Editar', icon: Pencil, onClick: () => handleEdit(row) },
            { label: 'Excluir', icon: Trash2, onClick: () => deleteMutation.mutate(row.id), destructive: true }
          ]}
        />
      )}

      <ImportarCSVModal
        open={importarOpen}
        onClose={() => setImportarOpen(false)}
        config={IMPORT_CONFIGS.produto}
        extraData={{ categorias }}
      />

      {/* Modal de Cadastro/Edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <Tabs defaultValue="dados" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="estoque">Estoque</TabsTrigger>
                <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <Label>Nome *</Label>
                    <Input
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Nome do produto"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Código SKU</Label>
                    <Input
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                      placeholder="SKU001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Código de Barras</Label>
                    <Input
                      value={formData.codigo_barras}
                      onChange={(e) => setFormData({ ...formData, codigo_barras: e.target.value })}
                      placeholder="7898..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select 
                      value={formData.categoria_id} 
                      onValueChange={(v) => setFormData({ ...formData, categoria_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select 
                      value={formData.tipo} 
                      onValueChange={(v) => setFormData({ ...formData, tipo: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="insumo">Insumo</SelectItem>
                        <SelectItem value="produto_final">Produto Final</SelectItem>
                        <SelectItem value="embalagem">Embalagem</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Unidade de Medida *</Label>
                    <Select 
                      value={formData.unidade_medida} 
                      onValueChange={(v) => setFormData({ ...formData, unidade_medida: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="un">Unidade (UN)</SelectItem>
                        <SelectItem value="kg">Quilograma (KG)</SelectItem>
                        <SelectItem value="g">Grama (G)</SelectItem>
                        <SelectItem value="l">Litro (L)</SelectItem>
                        <SelectItem value="ml">Mililitro (ML)</SelectItem>
                        <SelectItem value="cx">Caixa (CX)</SelectItem>
                        <SelectItem value="pc">Pacote (PC)</SelectItem>
                        <SelectItem value="fd">Fardo (FD)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select 
                      value={formData.status} 
                      onValueChange={(v) => setFormData({ ...formData, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                        <SelectItem value="descontinuado">Descontinuado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Observações sobre o produto..."
                    rows={3}
                  />
                </div>
              </TabsContent>

              <TabsContent value="estoque" className="space-y-4 mt-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-white">Controlar Estoque</p>
                    <p className="text-sm text-slate-500">Ativar gestão de estoque para este produto</p>
                  </div>
                  <Switch
                    checked={formData.controla_estoque}
                    onCheckedChange={(v) => setFormData({ ...formData, controla_estoque: v })}
                  />
                </div>

                {formData.controla_estoque && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Estoque Mínimo</Label>
                      <Input
                        type="number"
                        value={formData.estoque_minimo}
                        onChange={(e) => setFormData({ ...formData, estoque_minimo: parseFloat(e.target.value) || 0 })}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Custo Médio (R$)</Label>
                      <Input
                        type="number"
                        value={formData.custo_medio}
                        onChange={(e) => setFormData({ ...formData, custo_medio: parseFloat(e.target.value) || 0 })}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Preço de Venda (R$)</Label>
                      <Input
                        type="number"
                        value={formData.preco_venda}
                        onChange={(e) => setFormData({ ...formData, preco_venda: parseFloat(e.target.value) || 0 })}
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="fiscal" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>NCM</Label>
                    <Input
                      value={formData.ncm}
                      onChange={(e) => setFormData({ ...formData, ncm: e.target.value })}
                      placeholder="0000.00.00"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingItem ? 'Salvar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}