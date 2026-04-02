import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Play, Pause, XCircle, Plus, Eye } from 'lucide-react';
import PageHeader from '@/components/ui-custom/PageHeader';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CRMCampaigns() {
  const qc = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', type: 'one_time', segment: 'all', template_id: '' });

  const { data: campaigns = [], isLoading: loadingCamp } = useQuery({
    queryKey: ['crm-campaigns'],
    queryFn: () => base44.entities.CRMCampaign.list('-created_date', 50)
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['crm-templates'],
    queryFn: () => base44.entities.CRMMessageTemplate.filter({ meta_template_status: 'approved' })
  });

  const { mutate: createCampaign, isPending } = useMutation({
    mutationFn: (data) => base44.entities.CRMCampaign.create({
      name: data.name,
      type: data.type,
      channel: 'whatsapp',
      segment_filter: { segment: data.segment },
      message_template_id: data.template_id,
      status: 'draft'
    }),
    onSuccess: () => {
      toast.success('Campanha criada!');
      setIsModalOpen(false);
      qc.invalidateQueries({ queryKey: ['crm-campaigns'] });
    }
  });

  const { mutate: fireCampaign, isPending: isFiring } = useMutation({
    mutationFn: async (id) => {
      const res = await base44.functions.invoke('sendCampaign', { campaign_id: id });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Disparo de campanha iniciado em background!');
      qc.invalidateQueries({ queryKey: ['crm-campaigns'] });
    },
    onError: (err) => toast.error('Erro: ' + err.message)
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createCampaign(formData);
  };

  const getStatusBadge = (status) => {
    const map = {
      draft: { variant: 'secondary', label: 'Rascunho' },
      running: { variant: 'default', label: 'Em Andamento', className: 'bg-blue-500' },
      completed: { variant: 'default', label: 'Concluída', className: 'bg-emerald-500' },
      paused: { variant: 'outline', label: 'Pausada' }
    };
    const conf = map[status] || map.draft;
    return <Badge variant={conf.variant} className={conf.className}>{conf.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Campanhas de Marketing" 
        subtitle="Crie disparos em massa no WhatsApp focados por segmento de clientes."
        icon={Megaphone}
        actions={
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Nova Campanha</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Campanha Broadcast</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome da Campanha</label>
                  <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Público Alvo (Segmento RFV)</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.segment} onChange={e => setFormData({...formData, segment: e.target.value})}>
                    <option value="all">Todos os Clientes</option>
                    <option value="champion">Campeões (Alto Valor)</option>
                    <option value="at_risk">Em Risco (Inativos)</option>
                    <option value="new">Novos Clientes</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Template Aprovado (Meta)</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.template_id} onChange={e => setFormData({...formData, template_id: e.target.value})} required>
                    <option value="">Selecione...</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={isPending}>{isPending ? 'Salvando...' : 'Salvar Campanha'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4">
        {loadingCamp ? <div className="text-center py-8 text-slate-500">Carregando campanhas...</div> : 
         campaigns.length === 0 ? <div className="text-center py-8 text-slate-500 bg-white dark:bg-slate-900 rounded-lg">Nenhuma campanha criada.</div> : 
         campaigns.map(camp => (
          <Card key={camp.id}>
            <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-lg">{camp.name}</h3>
                  {getStatusBadge(camp.status)}
                </div>
                <div className="text-sm text-slate-500 flex gap-4">
                  <span>Alvo: <strong className="text-slate-700 dark:text-slate-300">{camp.segment_filter?.segment || 'Todos'}</strong></span>
                  <span>Enviadas: <strong>{camp.sent_count}</strong></span>
                  <span>Lidas: <strong>{camp.read_count}</strong></span>
                  <span>ROI: <strong className="text-emerald-500">R$ {camp.revenue_generated?.toFixed(2)}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {camp.status === 'draft' && (
                  <Button variant="default" size="sm" className="gap-2" onClick={() => fireCampaign(camp.id)} disabled={isFiring}>
                    <Play className="w-4 h-4" /> Iniciar Disparo
                  </Button>
                )}
                {camp.status === 'running' && (
                  <Button variant="outline" size="sm" className="gap-2 text-amber-600">
                    <Pause className="w-4 h-4" /> Pausar
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="gap-2 text-slate-500">
                  <Eye className="w-4 h-4" /> Métricas
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}