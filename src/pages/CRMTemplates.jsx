import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, MessageSquare, Image as ImageIcon, FileText, CheckCircle2, Clock, XCircle } from 'lucide-react';
import PageHeader from '@/components/ui-custom/PageHeader';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const statusConfig = {
  pending: { icon: Clock, text: 'Pendente', color: 'text-amber-500' },
  approved: { icon: CheckCircle2, text: 'Aprovado', color: 'text-emerald-500' },
  rejected: { icon: XCircle, text: 'Rejeitado', color: 'text-red-500' }
};

export default function CRMTemplates() {
  const qc = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', category: 'marketing', body: '', header_type: 'none' });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['crm-templates'],
    queryFn: () => base44.entities.CRMMessageTemplate.list('-created_date', 100)
  });

  const { mutate: createTemplate, isPending } = useMutation({
    mutationFn: (data) => base44.entities.CRMMessageTemplate.create({
      ...data,
      channel: 'whatsapp',
      meta_template_status: 'pending' // Simula o envio para a Meta
    }),
    onSuccess: () => {
      toast.success('Template criado e enviado para aprovação!');
      setIsModalOpen(false);
      setFormData({ name: '', category: 'marketing', body: '', header_type: 'none' });
      qc.invalidateQueries({ queryKey: ['crm-templates'] });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createTemplate(formData);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Templates de Mensagem" 
        subtitle="Gerencie os modelos de mensagens do WhatsApp (sujeitos à aprovação da Meta)."
        icon={MessageSquare}
        actions={
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Novo Template</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Criar Template do WhatsApp</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do Template (sem espaços)</label>
                  <Input 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_')})} 
                    placeholder="ex: promo_hamburguer_v1" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Corpo da Mensagem</label>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-emerald-600 gap-1"
                      onClick={async () => {
                        try {
                          toast.info('Gerando sugestão...');
                          const res = await base44.integrations.Core.InvokeLLM({
                            prompt: `Crie um texto curto e persuasivo de marketing para WhatsApp para uma hamburgueria/pizzaria. 
                            Use emojis, seja direto e use as variáveis {{nome}} e {{dias_ausente}}. Não use aspas no começo ou no fim.`
                          });
                          setFormData(prev => ({...prev, body: res}));
                        } catch (err) {
                          toast.error('Erro ao gerar texto: ' + err.message);
                        }
                      }}
                    >
                      <MessageSquare className="w-3 h-3" /> Gerar com IA
                    </Button>
                  </div>
                  <Textarea 
                    value={formData.body} 
                    onChange={e => setFormData({...formData, body: e.target.value})} 
                    placeholder="Olá {{nome}}! Que tal um lanche hoje? 🍔" 
                    rows={5}
                    required 
                  />
                  <p className="text-xs text-slate-500">Use {'{{nome}}'}, {'{{dias_ausente}}'}, {'{{ticket_medio}}'} para variáveis dinâmicas.</p>
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={isPending}>{isPending ? 'Criando...' : 'Salvar e Enviar à Meta'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-10 text-slate-500">Carregando templates...</div>
        ) : templates.length === 0 ? (
          <div className="col-span-full text-center py-10 text-slate-500 bg-white dark:bg-slate-900 rounded-lg border border-dashed">
            Nenhum template cadastrado.
          </div>
        ) : (
          templates.map(template => {
            const StatusIcon = statusConfig[template.meta_template_status || 'pending'].icon;
            const statusColor = statusConfig[template.meta_template_status || 'pending'].color;
            
            return (
              <Card key={template.id} className="relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4">
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${statusColor}`}>
                    <StatusIcon className="w-4 h-4" />
                    <span className="capitalize">{statusConfig[template.meta_template_status || 'pending'].text}</span>
                  </div>
                </div>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base truncate pr-24">{template.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg text-sm whitespace-pre-wrap min-h-[100px]">
                    {template.body}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                    <span>Usado {template.times_used} vezes</span>
                    <span>{template.language}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}