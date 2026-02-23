import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/ui-custom/PageHeader';
import PassivoKPIs from '../components/passivos/PassivoKPIs';
import PassivoTable from '../components/passivos/PassivoTable';
import PassivoForm from '../components/passivos/PassivoForm';
import SimuladorPassivos from '../components/passivos/SimuladorPassivos';
import { criarPassivoCompleto } from '../components/services/passivoService';
import { getEmpresaIdAtual } from '../components/services/tenantService';

export default function Passivos() {
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();

  const { data: empresaId } = useQuery({
    queryKey: ['empresa-id-passivos'],
    queryFn: getEmpresaIdAtual
  });

  const { data: passivos = [], isLoading } = useQuery({
    queryKey: ['passivos', empresaId],
    queryFn: () => base44.entities.PassivoFinanceiro.filter({ empresa_id: empresaId }, '-created_date'),
    enabled: !!empresaId
  });

  const { data: parcelas = [] } = useQuery({
    queryKey: ['parcelas-passivos', empresaId],
    queryFn: () => base44.entities.ParcelaPassivo.filter({ empresa_id: empresaId }),
    enabled: !!empresaId
  });

  const handleCriar = async (formData) => {
    setCreating(true);
    try {
      await criarPassivoCompleto({ ...formData, empresa_id: empresaId });
      toast.success(`Passivo criado com ${formData.total_parcelas} parcelas e contas a pagar geradas!`);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['passivos'] });
      queryClient.invalidateQueries({ queryKey: ['parcelas-passivos'] });
    } catch (err) {
      toast.error('Erro ao criar passivo: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Passivos & Planejamento"
        subtitle="Estrutura de dívidas e simulador financeiro"
        breadcrumbs={[{ label: 'Financeiro' }, { label: 'Passivos' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['passivos'] });
              queryClient.invalidateQueries({ queryKey: ['parcelas-passivos'] });
            }}>
              <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
            </Button>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-1" /> Novo Passivo
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="passivos">
        <TabsList>
          <TabsTrigger value="passivos">Passivos</TabsTrigger>
          <TabsTrigger value="simulador">Simulador</TabsTrigger>
        </TabsList>

        <TabsContent value="passivos" className="space-y-6 mt-4">
          <PassivoKPIs passivos={passivos} parcelas={parcelas} />
          <PassivoTable passivos={passivos} parcelas={parcelas} />
        </TabsContent>

        <TabsContent value="simulador" className="mt-4">
          <SimuladorPassivos parcelas={parcelas} passivos={passivos} />
        </TabsContent>
      </Tabs>

      <PassivoForm open={showForm} onClose={() => setShowForm(false)} onSubmit={handleCriar} loading={creating} />
    </div>
  );
}