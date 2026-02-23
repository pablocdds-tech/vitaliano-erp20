import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { CreditCard, Plus, FileDown } from 'lucide-react';
import { isAfter } from 'date-fns';
import { toast } from 'sonner';
import PageHeader from '@/components/ui-custom/PageHeader';
import ContasPagarKPIs from '@/components/contas-pagar/ContasPagarKPIs';
import ContasPagarFilters from '@/components/contas-pagar/ContasPagarFilters';
import ContasPagarList from '@/components/contas-pagar/ContasPagarList';
import ContaPagarFormModal from '@/components/contas-pagar/ContaPagarFormModal';
import RegistrarPagamentoModal from '@/components/contas/RegistrarPagamentoModal';

export default function ContasPagar() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [pagamentoModal, setPagamentoModal] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['contas-pagar'],
    queryFn: () => base44.entities.ContaPagar.list('-data_vencimento'),
  });

  const { data: lojas = [] } = useQuery({ queryKey: ['lojas'], queryFn: () => base44.entities.Loja.list() });
  const { data: fornecedores = [] } = useQuery({ queryKey: ['fornecedores'], queryFn: () => base44.entities.Fornecedor.list() });
  const { data: categoriasDRE = [] } = useQuery({ queryKey: ['categorias-dre'], queryFn: () => base44.entities.CategoriaDRE.list() });
  const { data: contasBancarias = [] } = useQuery({ queryKey: ['contas-bancarias'], queryFn: () => base44.entities.ContaBancaria.filter({ status: 'ativo' }) });
  const { data: cofres = [] } = useQuery({ queryKey: ['cofres'], queryFn: () => base44.entities.Cofre.filter({ status: 'ativo' }) });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContaPagar.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      toast.success('Conta excluída!');
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const hoje = new Date();

  const filteredContas = useMemo(() => {
    let result = contas;

    // Status filter
    if (statusFilter === 'vencido') {
      result = result.filter(c => (c.status === 'pendente' || c.status === 'parcial') && c.data_vencimento && isAfter(hoje, new Date(c.data_vencimento + 'T23:59:59')));
    } else if (statusFilter !== 'todos') {
      result = result.filter(c => c.status === statusFilter);
    }

    // Search
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(c =>
        (c.descricao || '').toLowerCase().includes(term) ||
        (c.credor_nome || '').toLowerCase().includes(term) ||
        (c.documento_numero || '').toLowerCase().includes(term)
      );
    }

    return result;
  }, [contas, statusFilter, search]);

  const handleEdit = (item) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contas a Pagar"
        subtitle={`${contas.length} contas cadastradas`}
        icon={CreditCard}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Contas a Pagar' }]}
        actions={
          <Button onClick={() => { setEditingItem(null); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Conta
          </Button>
        }
      />

      <ContasPagarKPIs contas={contas} />

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
        <ContasPagarFilters
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          </div>
        ) : (
          <ContasPagarList
            contas={filteredContas}
            lojas={lojas}
            fornecedores={fornecedores}
            onEdit={handleEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
            onPagar={(conta) => setPagamentoModal(conta)}
          />
        )}

        {!isLoading && filteredContas.length > 0 && (
          <p className="text-xs text-slate-400 text-center pt-2">
            Mostrando {filteredContas.length} de {contas.length} contas
          </p>
        )}
      </div>

      <ContaPagarFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingItem(null); }}
        editingItem={editingItem}
        lojas={lojas}
        fornecedores={fornecedores}
        categoriasDRE={categoriasDRE}
      />

      <RegistrarPagamentoModal
        open={!!pagamentoModal}
        onClose={() => setPagamentoModal(null)}
        conta={pagamentoModal}
        contasBancarias={contasBancarias}
        cofres={cofres}
        lojas={lojas}
      />
    </div>
  );
}