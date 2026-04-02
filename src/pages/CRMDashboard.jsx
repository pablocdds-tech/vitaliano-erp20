import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Users, MessageSquare, DollarSign, Activity } from 'lucide-react';
import PageHeader from '@/components/ui-custom/PageHeader';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

export default function CRMDashboard() {
  const { data: customers = [] } = useQuery({
    queryKey: ['crm-dash-customers'],
    queryFn: () => base44.entities.CRMCustomer.list()
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['crm-dash-campaigns'],
    queryFn: () => base44.entities.CRMCampaign.list()
  });

  // Agrupar segmentos
  const segmentData = customers.reduce((acc, curr) => {
    const seg = curr.rfv_segment || 'none';
    if (!acc[seg]) acc[seg] = 0;
    acc[seg]++;
    return acc;
  }, {});

  const pieData = Object.entries(segmentData).map(([key, value], index) => ({
    name: key === 'champion' ? 'Campeão' : key === 'loyal' ? 'Fiel' : key === 'at_risk' ? 'Em Risco' : key === 'lost' ? 'Perdidos' : key === 'new' ? 'Novos' : key === 'promising' ? 'Promissores' : 'Outros',
    value,
    color: COLORS[index % COLORS.length]
  })).filter(d => d.value > 0);

  // Stats
  const totalRevenue = campaigns.reduce((acc, c) => acc + (c.revenue_generated || 0), 0);
  const totalSent = campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0);
  const atRiskCount = customers.filter(c => c.rfv_segment === 'at_risk').length;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Dashboard CRM & Marketing" 
        subtitle="Acompanhe o ROI de suas campanhas, retenção e comportamento da base de clientes."
        icon={Activity}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">Receita de Campanhas</p>
                <h3 className="text-2xl font-bold mt-2 text-emerald-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue)}
                </h3>
              </div>
              <div className="p-3 bg-emerald-100 rounded-lg text-emerald-600"><DollarSign className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">Base Ativa</p>
                <h3 className="text-2xl font-bold mt-2">{customers.length}</h3>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg text-blue-600"><Users className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">Msgs Enviadas</p>
                <h3 className="text-2xl font-bold mt-2">{totalSent}</h3>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg text-purple-600"><MessageSquare className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">Clientes em Risco</p>
                <h3 className="text-2xl font-bold mt-2 text-amber-600">{atRiskCount}</h3>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg text-amber-600"><TrendingUp className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição da Base RFV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value">
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">Dados insuficientes</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance das Últimas Campanhas (Abertura vs Clique)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
               {campaigns.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={campaigns.slice(0, 5)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{fontSize: 12}} />
                    <YAxis />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="sent_count" name="Enviadas" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="read_count" name="Lidas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
               ) : (
                <div className="flex items-center justify-center h-full text-slate-400">Nenhuma campanha disparada</div>
               )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}