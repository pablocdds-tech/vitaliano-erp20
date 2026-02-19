/**
 * PAINEL ADMINISTRATIVO DO SaaS Vitaliano ERP
 * Restrito a role = admin.
 * Lista empresas, planos, status e ações de gestão.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Shield, Building2, CheckCircle2, AlertTriangle, Lock, Unlock,
  RefreshCw, Loader2, CalendarDays, Users, Store, Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { alterarPlanoEmpresa, alterarBloqueioEmpresa, estenderTrial, garantirPlanosPadrao } from '@/components/services/assinaturaService';
import { formatMoney } from '@/components/ui-custom/MoneyDisplay';

const STATUS_STYLE = {
  trial: 'bg-blue-100 text-blue-700',
  ativa: 'bg-emerald-100 text-emerald-700',
  vencida: 'bg-amber-100 text-amber-700',
  bloqueada: 'bg-red-100 text-red-700',
};

export default function AdminSaaS() {
  const qc = useQueryClient();
  const [modalEmpresa, setModalEmpresa] = useState(null); // empresa selecionada para ações
  const [acaoAtual, setAcaoAtual] = useState(''); // 'plano' | 'bloquear' | 'trial'
  const [novoPlanoCod, setNovoPlanoCod] = useState('');
  const [diasExtras, setDiasExtras] = useState(14);
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const { data: empresas = [], isLoading: loadEmp } = useQuery({
    queryKey: ['empresas-admin'],
    queryFn: () => base44.entities.Empresa.list('nome', 200),
  });
  const { data: assinaturas = [] } = useQuery({
    queryKey: ['assinaturas-admin'],
    queryFn: () => base44.entities.AssinaturaEmpresa.list('-created_date', 500),
  });
  const { data: planos = [], isLoading: loadPlanos } = useQuery({
    queryKey: ['planos-admin'],
    queryFn: garantirPlanosPadrao,
  });
  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas-admin'],
    queryFn: () => base44.entities.Loja.list('nome', 500),
  });

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <Shield className="w-12 h-12 text-slate-300" />
        <p className="text-lg font-semibold text-slate-600">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const getAssinatura = (emp_id) => assinaturas.find(a => a.empresa_id === emp_id);
  const getPlano = (plano_id) => planos.find(p => p.id === plano_id);
  const getLojas = (emp_id) => lojas.filter(l => l.empresa_id === emp_id);

  const kpiTrial = assinaturas.filter(a => a.status_assinatura === 'trial').length;
  const kpiAtiva = assinaturas.filter(a => a.status_assinatura === 'ativa').length;
  const kpiVencida = assinaturas.filter(a => a.status_assinatura === 'vencida').length;
  const kpiBloqueada = assinaturas.filter(a => a.status_assinatura === 'bloqueada').length;

  const handleAlterarPlano = async () => {
    if (!novoPlanoCod) { toast.error('Selecione um plano.'); return; }
    setLoading(true);
    try {
      await alterarPlanoEmpresa(modalEmpresa.id, novoPlanoCod, user.email, 30);
      qc.invalidateQueries({ queryKey: ['assinaturas-admin'] });
      toast.success('Plano alterado com sucesso.');
      setModalEmpresa(null);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const handleBloquear = async (bloquear) => {
    setLoading(true);
    try {
      await alterarBloqueioEmpresa(modalEmpresa.id, bloquear, motivo, user.email);
      qc.invalidateQueries({ queryKey: ['assinaturas-admin'] });
      toast.success(bloquear ? 'Empresa bloqueada.' : 'Empresa desbloqueada.');
      setModalEmpresa(null);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const handleEstenderTrial = async () => {
    setLoading(true);
    try {
      await estenderTrial(modalEmpresa.id, Number(diasExtras), user.email);
      qc.invalidateQueries({ queryKey: ['assinaturas-admin'] });
      toast.success(`Trial estendido por ${diasExtras} dias.`);
      setModalEmpresa(null);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin SaaS"
        subtitle="Gestão de empresas, planos e assinaturas"
        icon={Shield}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Admin SaaS' }]}
        actions={
          <Button variant="outline" size="sm" className="gap-2" onClick={() => qc.invalidateQueries()}>
            <RefreshCw className="w-4 h-4" /> Atualizar
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Trial', value: kpiTrial, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Ativas', value: kpiAtiva, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Vencidas', value: kpiVencida, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Bloqueadas', value: kpiBloqueada, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(k => (
          <div key={k.label} className={`p-4 rounded-xl border ${k.bg}`}>
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Planos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-500" /> Planos Disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {planos.map(p => (
              <div key={p.id} className="border rounded-lg p-3 space-y-1">
                <p className="font-semibold text-sm">{p.nome}</p>
                <p className="text-xs text-slate-500">{formatMoney(p.preco_mensal)}/mês</p>
                <div className="text-xs text-slate-500 space-y-0.5">
                  <p>{p.limite_lojas} lojas · {p.limite_usuarios} usuários</p>
                  <p>{p.acesso_ia ? '✓ IA' : '✗ IA'} · {p.acesso_cd ? '✓ CD' : '✗ CD'}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Empresas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-500" /> Empresas Cadastradas ({empresas.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadEmp ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="text-left p-3">Empresa</th>
                    <th className="text-left p-3">Plano</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Vencimento</th>
                    <th className="text-left p-3">Lojas</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {empresas.map(emp => {
                    const ass = getAssinatura(emp.id);
                    const plano = ass ? getPlano(ass.plano_id) : null;
                    const qtdLojas = getLojas(emp.id).length;
                    const status = ass?.status_assinatura || 'sem_assinatura';
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50">
                        <td className="p-3">
                          <p className="font-medium">{emp.nome}</p>
                          <p className="text-xs text-slate-400">{emp.cnpj}</p>
                        </td>
                        <td className="p-3 text-xs">{plano?.nome || ass?.plano_codigo || '—'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[status] || 'bg-slate-100 text-slate-500'}`}>
                            {status}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-slate-500">
                          {ass?.data_vencimento ? format(new Date(ass.data_vencimento + 'T12:00:00'), 'dd/MM/yyyy') : '—'}
                        </td>
                        <td className="p-3 text-xs">
                          <span className="flex items-center gap-1"><Store className="w-3 h-3" />{qtdLojas}</span>
                        </td>
                        <td className="p-3">
                          <Button size="sm" variant="outline" onClick={() => { setModalEmpresa(emp); setAcaoAtual('menu'); }}>
                            Gerenciar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {empresas.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400">Nenhuma empresa cadastrada</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de ações da empresa */}
      <Dialog open={!!modalEmpresa} onOpenChange={open => { if (!open) { setModalEmpresa(null); setAcaoAtual(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" /> {modalEmpresa?.nome}
            </DialogTitle>
          </DialogHeader>

          {acaoAtual === 'menu' && (
            <div className="space-y-2">
              {(() => {
                const ass = getAssinatura(modalEmpresa?.id);
                const status = ass?.status_assinatura;
                return (
                  <>
                    <p className="text-xs text-slate-500 mb-3">
                      Status: <strong>{status || '—'}</strong> · Vencimento: <strong>{ass?.data_vencimento || '—'}</strong>
                    </p>
                    <Button className="w-full gap-2" variant="outline" onClick={() => setAcaoAtual('plano')}>
                      <RefreshCw className="w-4 h-4" /> Alterar Plano
                    </Button>
                    <Button className="w-full gap-2" variant="outline" onClick={() => setAcaoAtual('trial')}>
                      <CalendarDays className="w-4 h-4" /> Estender Trial
                    </Button>
                    {status === 'bloqueada' ? (
                      <Button className="w-full gap-2 border-emerald-200 text-emerald-700" variant="outline" onClick={() => setAcaoAtual('desbloquear')}>
                        <Unlock className="w-4 h-4" /> Desbloquear Empresa
                      </Button>
                    ) : (
                      <Button className="w-full gap-2 border-red-200 text-red-600" variant="outline" onClick={() => setAcaoAtual('bloquear')}>
                        <Lock className="w-4 h-4" /> Bloquear Empresa
                      </Button>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {acaoAtual === 'plano' && (
            <div className="space-y-4">
              <Label>Novo Plano</Label>
              <Select value={novoPlanoCod} onValueChange={setNovoPlanoCod}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {planos.map(p => <SelectItem key={p.id} value={p.codigo}>{p.nome} — {formatMoney(p.preco_mensal)}/mês</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">Vigência de 30 dias a partir de hoje.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAcaoAtual('menu')}>Voltar</Button>
                <Button onClick={handleAlterarPlano} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
                </Button>
              </DialogFooter>
            </div>
          )}

          {acaoAtual === 'trial' && (
            <div className="space-y-4">
              <Label>Dias extras de trial</Label>
              <Input type="number" min={1} max={90} value={diasExtras} onChange={e => setDiasExtras(e.target.value)} />
              <DialogFooter>
                <Button variant="outline" onClick={() => setAcaoAtual('menu')}>Voltar</Button>
                <Button onClick={handleEstenderTrial} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Estender'}
                </Button>
              </DialogFooter>
            </div>
          )}

          {(acaoAtual === 'bloquear' || acaoAtual === 'desbloquear') && (
            <div className="space-y-4">
              {acaoAtual === 'bloquear' && (
                <>
                  <Label>Motivo do bloqueio</Label>
                  <Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex: inadimplência, solicitação..." />
                </>
              )}
              <p className="text-sm text-slate-500">
                {acaoAtual === 'bloquear'
                  ? 'A empresa perderá acesso às operações críticas. Dados são preservados.'
                  : 'A empresa voltará a ter acesso normal ao sistema.'}
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAcaoAtual('menu')}>Voltar</Button>
                <Button
                  onClick={() => handleBloquear(acaoAtual === 'bloquear')}
                  disabled={loading}
                  className={acaoAtual === 'bloquear' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : acaoAtual === 'bloquear' ? 'Bloquear' : 'Desbloquear'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}