import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import EmptyState from '@/components/ui-custom/EmptyState';
import FuncionarioModal from '@/components/rh/FuncionarioModal';
import DossieFuncionario from '@/components/rh/DossieFuncionario';
import { Button } from '@/components/ui/button';
import { Users, Plus, Eye, Pencil, Trash2, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';

export default function RHFuncionarios() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showDossie, setShowDossie] = useState(null);
  const qc = useQueryClient();

  const { data: funcionarios = [], isLoading } = useQuery({
    queryKey: ['funcionarios'],
    queryFn: () => base44.entities.Funcionario.list('-created_date', 200)
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Funcionario.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['funcionarios'] }); toast.success('Funcionário removido'); }
  });

  const lojasMap = Object.fromEntries(lojas.map(l => [l.id, l.nome]));

  const columns = [
    { key: 'nome', label: 'Nome', sortable: true },
    { key: 'cargo', label: 'Cargo' },
    { key: 'tipo', label: 'Tipo', render: (_, r) => {
      const labels = { clt: 'CLT', pj: 'PJ', freelancer: 'Freelancer', estagiario: 'Estagiário', temporario: 'Temporário' };
      return labels[r.tipo] || r.tipo;
    }},
    { key: 'loja_id', label: 'Loja', render: (_, r) => lojasMap[r.loja_id] || '-' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'status', label: 'Status', render: (_, r) => <StatusBadge status={r.status} /> }
  ];

  if (showDossie) {
    return <DossieFuncionario funcionario={showDossie} lojas={lojas} onBack={() => setShowDossie(null)} />;
  }

  return (
    <div>
      <PageHeader
        title="Funcionários"
        subtitle="Dossiê e cadastro de colaboradores"
        icon={Users}
        breadcrumbs={[{ label: 'RH', href: '/RHFuncionarios' }, { label: 'Funcionários' }]}
        actions={
          <Button onClick={() => { setEditing(null); setShowModal(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Funcionário
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Ativos', val: funcionarios.filter(f => f.status === 'ativo').length, icon: UserCheck, color: 'text-emerald-600' },
          { label: 'CLT', val: funcionarios.filter(f => f.tipo === 'clt').length, icon: Users, color: 'text-blue-600' },
          { label: 'Freelancers', val: funcionarios.filter(f => f.tipo === 'freelancer').length, icon: Users, color: 'text-amber-600' },
          { label: 'Desligados', val: funcionarios.filter(f => f.status === 'desligado').length, icon: UserX, color: 'text-red-600' },
        ].map(k => (
          <div key={k.label} className="bg-white dark:bg-slate-900 border rounded-xl p-4 flex items-center gap-3">
            <k.icon className={`w-8 h-8 ${k.color}`} />
            <div><p className="text-2xl font-bold">{k.val}</p><p className="text-xs text-muted-foreground">{k.label}</p></div>
          </div>
        ))}
      </div>

      <DataTable
        data={funcionarios}
        columns={columns}
        isLoading={isLoading}
        searchField="nome"
        searchPlaceholder="Buscar funcionário..."
        actions={(row) => [
          { label: 'Ver Dossiê', icon: <Eye className="w-4 h-4" />, onClick: () => setShowDossie(row) },
          { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onClick: () => { setEditing(row); setShowModal(true); }},
          { label: 'Excluir', icon: <Trash2 className="w-4 h-4" />, onClick: () => deleteMut.mutate(row.id), variant: 'destructive' }
        ]}
        emptyState={<EmptyState icon={Users} title="Nenhum funcionário" description="Cadastre o primeiro funcionário" actionLabel="Novo Funcionário" onAction={() => setShowModal(true)} />}
      />

      {showModal && (
        <FuncionarioModal
          open={showModal}
          onClose={() => { setShowModal(false); setEditing(null); }}
          funcionario={editing}
          lojas={lojas}
        />
      )}
    </div>
  );
}