import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import EmptyState from '@/components/ui-custom/EmptyState';
import ContratoModal from '@/components/rh/ContratoModal';
import { Button } from '@/components/ui/button';
import { FileText, Plus, Send, Eye, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function RHContratos() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();

  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ['contratos'],
    queryFn: () => base44.entities.ContratoRH.list('-created_date', 200)
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['funcionarios'],
    queryFn: () => base44.entities.Funcionario.list()
  });

  const funcMap = Object.fromEntries(funcionarios.map(f => [f.id, f]));

  const enviarMut = useMutation({
    mutationFn: async (contrato) => {
      const func = funcMap[contrato.funcionario_id];
      if (!func?.email) { toast.error('Funcionário sem email cadastrado'); return; }
      const token = crypto.randomUUID();
      const linkAssinatura = `${window.location.origin}/RHAssinarContrato?token=${token}`;
      await base44.integrations.Core.SendEmail({
        to: func.email,
        subject: `Contrato para assinatura: ${contrato.titulo}`,
        body: `<h2>Olá ${func.nome},</h2><p>Você recebeu um contrato para assinatura digital.</p><p><strong>${contrato.titulo}</strong></p><p>Clique no link abaixo para visualizar e assinar:</p><p><a href="${linkAssinatura}" style="background:#0f172a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Assinar Contrato</a></p><p style="margin-top:16px;font-size:12px;color:#666;">Este link é único e intransferível. A assinatura digital tem validade jurídica conforme Lei 14.063/2020 e MP 2.200-2/2001.</p>`
      });
      await base44.entities.ContratoRH.update(contrato.id, {
        status: 'enviado',
        token_assinatura: token,
        enviado_email: func.email,
        data_envio: new Date().toISOString()
      });
      qc.invalidateQueries({ queryKey: ['contratos'] });
      toast.success(`Contrato enviado para ${func.email}`);
    }
  });

  const assinarEmpresaMut = useMutation({
    mutationFn: async (contrato) => {
      const user = await base44.auth.me();
      const newStatus = contrato.assinatura_funcionario?.assinado ? 'assinado_ambos' : contrato.status;
      await base44.entities.ContratoRH.update(contrato.id, {
        assinatura_empresa: { assinado: true, data: new Date().toISOString(), assinado_por: user.email },
        status: contrato.assinatura_funcionario?.assinado ? 'assinado_ambos' : contrato.status
      });
      qc.invalidateQueries({ queryKey: ['contratos'] });
      toast.success('Contrato assinado pela empresa');
    }
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.ContratoRH.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contratos'] }); toast.success('Contrato removido'); }
  });

  const tipoLabels = { admissao: 'Admissão', experiencia: 'Experiência', aditivo: 'Aditivo', rescisao: 'Rescisão', confidencialidade: 'Confidencialidade', outro: 'Outro' };

  const columns = [
    { key: 'titulo', label: 'Título', sortable: true },
    { key: 'funcionario_id', label: 'Funcionário', render: (_, r) => funcMap[r.funcionario_id]?.nome || '-' },
    { key: 'tipo', label: 'Tipo', render: (_, r) => tipoLabels[r.tipo] || r.tipo },
    { key: 'data_envio', label: 'Enviado', render: (_, r) => r.data_envio ? format(new Date(r.data_envio), 'dd/MM/yyyy HH:mm') : '-' },
    { key: 'assinatura_funcionario', label: 'Func.', render: (_, r) => r.assinatura_funcionario?.assinado ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <span className="text-xs text-muted-foreground">Pendente</span> },
    { key: 'assinatura_empresa', label: 'Empresa', render: (_, r) => r.assinatura_empresa?.assinado ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <span className="text-xs text-muted-foreground">Pendente</span> },
    { key: 'status', label: 'Status', render: (_, r) => <StatusBadge status={r.status} /> }
  ];

  return (
    <div>
      <PageHeader
        title="Contratos"
        subtitle="Gestão de contratos com assinatura digital"
        icon={FileText}
        breadcrumbs={[{ label: 'RH', href: '/RHFuncionarios' }, { label: 'Contratos' }]}
        actions={
          <Button onClick={() => { setEditing(null); setShowModal(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Contrato
          </Button>
        }
      />

      <DataTable
        data={contratos}
        columns={columns}
        isLoading={isLoading}
        searchField="titulo"
        searchPlaceholder="Buscar contrato..."
        actions={(row) => [
          ...(row.status === 'rascunho' ? [{ label: 'Enviar por Email', icon: <Send className="w-4 h-4" />, onClick: () => enviarMut.mutate(row) }] : []),
          ...(!row.assinatura_empresa?.assinado ? [{ label: 'Assinar (Empresa)', icon: <CheckCircle2 className="w-4 h-4" />, onClick: () => assinarEmpresaMut.mutate(row) }] : []),
          { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onClick: () => { setEditing(row); setShowModal(true); }},
          { label: 'Excluir', icon: <Trash2 className="w-4 h-4" />, onClick: () => deleteMut.mutate(row.id), variant: 'destructive' }
        ]}
        emptyState={<EmptyState icon={FileText} title="Nenhum contrato" description="Crie o primeiro contrato" actionLabel="Novo Contrato" onAction={() => setShowModal(true)} />}
      />

      {showModal && (
        <ContratoModal
          open={showModal}
          onClose={() => { setShowModal(false); setEditing(null); }}
          contrato={editing}
          funcionarios={funcionarios}
        />
      )}
    </div>
  );
}