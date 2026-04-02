import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCcw, Search, Plus, Filter, Users } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/ui-custom/PageHeader';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const segmentColors = {
  champion: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  loyal: 'bg-blue-100 text-blue-800 border-blue-200',
  at_risk: 'bg-amber-100 text-amber-800 border-amber-200',
  lost: 'bg-red-100 text-red-800 border-red-200',
  new: 'bg-purple-100 text-purple-800 border-purple-200',
  promising: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  none: 'bg-slate-100 text-slate-800 border-slate-200'
};

const segmentLabels = {
  champion: 'Campeão',
  loyal: 'Fiel',
  at_risk: 'Em Risco',
  lost: 'Perdido',
  new: 'Novo',
  promising: 'Promissor',
  none: 'Sem Classificação'
};

export default function CRMCustomers() {
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('all');

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['crm-customers'],
    queryFn: () => base44.entities.CRMCustomer.list('-rfv_updated_at', 200)
  });

  const { mutate: recalculateRFV, isPending: isCalculating } = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('calculateRFV', {});
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`RFV recalculado para ${data.updated} clientes com sucesso!`);
      qc.invalidateQueries({ queryKey: ['crm-customers'] });
    },
    onError: (err) => toast.error('Erro ao calcular RFV: ' + err.message)
  });

  const filteredCustomers = customers.filter(c => {
    const matchSearch = c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone?.includes(searchTerm);
    const matchSegment = segmentFilter === 'all' || c.rfv_segment === segmentFilter;
    return matchSearch && matchSegment;
  });

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Clientes & CRM" 
        subtitle="Gerencie a base de clientes do Delivery e Salão, segmentados automaticamente por RFV."
        icon={Users}
        actions={
          <Button onClick={() => recalculateRFV()} disabled={isCalculating} variant="outline" className="gap-2">
            <RefreshCcw className={`w-4 h-4 ${isCalculating ? 'animate-spin' : ''}`} />
            Recalcular RFV
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Buscar por nome ou telefone..." 
                className="pl-9"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-64">
              <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                <SelectTrigger>
                  <Filter className="w-4 h-4 mr-2 text-slate-400" />
                  <SelectValue placeholder="Filtrar por Segmento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Segmentos</SelectItem>
                  {Object.entries(segmentLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="gap-2 shrink-0">
              <Plus className="w-4 h-4" /> Novo Cliente
            </Button>
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b text-slate-600 dark:text-slate-400 font-medium">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Contato</th>
                  <th className="px-4 py-3">Segmento RFV</th>
                  <th className="px-4 py-3 text-right">Pedidos</th>
                  <th className="px-4 py-3 text-right">Total Gasto</th>
                  <th className="px-4 py-3">Último Pedido</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan="6" className="text-center py-8 text-slate-500">Carregando clientes...</td></tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-8 text-slate-500">Nenhum cliente encontrado.</td></tr>
                ) : (
                  filteredCustomers.map(customer => (
                    <tr key={customer.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{customer.name || 'Cliente Sem Nome'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        <div>{customer.phone}</div>
                        {customer.email && <div className="text-xs text-slate-400">{customer.email}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${segmentColors[customer.rfv_segment || 'none']}`}>
                          {segmentLabels[customer.rfv_segment || 'none']}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{customer.total_orders}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(customer.total_spent || 0)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {customer.last_order_at ? format(new Date(customer.last_order_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}