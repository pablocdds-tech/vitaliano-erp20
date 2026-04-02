import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Workflow, Plus, Play, Pause, GitBranch } from 'lucide-react';
import PageHeader from '@/components/ui-custom/PageHeader';

export default function CRMJourneys() {
  const { data: journeys = [], isLoading } = useQuery({
    queryKey: ['crm-journeys'],
    queryFn: () => base44.entities.CRMJourney.list()
  });

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Jornadas de Automação" 
        subtitle="Crie fluxos condicionais para nutrir leads automaticamente."
        icon={Workflow}
        actions={
          <Button className="gap-2"><Plus className="w-4 h-4" /> Nova Jornada</Button>
        }
      />

      <div className="grid gap-4">
        {isLoading ? (
          <div className="text-center py-10 text-slate-500">Carregando jornadas...</div>
        ) : journeys.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-300">
            <GitBranch className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Nenhuma jornada criada</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-2 mb-6">
              Jornadas são sequências automáticas de mensagens baseadas no comportamento do cliente (ex: Boas vindas, Recuperação de inativos).
            </p>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Criar Primeira Jornada</Button>
          </div>
        ) : (
          journeys.map(journey => (
            <Card key={journey.id}>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{journey.name}</h3>
                  <p className="text-sm text-slate-500">{journey.description}</p>
                </div>
                <div className="flex gap-2">
                  {journey.status === 'active' ? (
                    <Button variant="outline" size="sm" className="text-amber-600 gap-2"><Pause className="w-4 h-4" /> Pausar</Button>
                  ) : (
                    <Button size="sm" className="gap-2"><Play className="w-4 h-4" /> Ativar</Button>
                  )}
                  <Button variant="ghost" size="sm">Editar Fluxo</Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}