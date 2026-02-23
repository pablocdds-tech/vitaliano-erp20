import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building2, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { clearUserCache } from '@/components/services/tenantService';

export default function OnboardingEmpresa({ user, onComplete }) {
  const [step, setStep] = useState(1); // 1=nome empresa, 2=nome loja/CD, 3=concluído
  const [loading, setLoading] = useState(false);
  const [empresa, setEmpresa] = useState({ nome: '', cnpj: '', razao_social: '' });
  const [loja, setLoja] = useState({ nome: '', tipo: 'cd' });

  const handleCriarEmpresa = async (e) => {
    e.preventDefault();
    if (!empresa.nome.trim()) return toast.error('Informe o nome da empresa');
    setLoading(true);
    try {
      // Criar empresa
      const novaEmpresa = await base44.entities.Empresa.create({
        nome: empresa.nome,
        razao_social: empresa.razao_social || empresa.nome,
        cnpj: empresa.cnpj || '',
        status: 'ativo'
      });

      // Vincular usuário à empresa
      await base44.auth.updateMe({ empresa_id: novaEmpresa.id });
      clearUserCache();

      setEmpresa(prev => ({ ...prev, _id: novaEmpresa.id }));
      setStep(2);
    } catch (err) {
      toast.error('Erro ao criar empresa: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCriarLoja = async (e) => {
    e.preventDefault();
    if (!loja.nome.trim()) return toast.error('Informe o nome do CD/Loja');
    setLoading(true);
    try {
      await base44.entities.Loja.create({
        empresa_id: empresa._id,
        nome: loja.nome,
        tipo: loja.tipo,
        status: 'ativo'
      });
      setStep(3);
    } catch (err) {
      toast.error('Erro ao criar unidade: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 3) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 p-4">
        <Card className="w-full max-w-md text-center shadow-xl">
          <CardContent className="pt-10 pb-8 space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Tudo pronto!</h2>
            <p className="text-slate-500">Sua empresa <strong>{empresa.nome}</strong> foi configurada com sucesso.</p>
            <Button className="w-full gap-2 mt-4" onClick={onComplete}>
              Entrar no sistema
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Bem-vindo!</h1>
          <p className="text-slate-500 text-sm mt-1">Olá, <strong>{user?.full_name || user?.email}</strong>. Vamos configurar sua empresa.</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-emerald-500' : 'bg-slate-200'}`} />
          ))}
        </div>

        {step === 1 && (
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Dados da Empresa</CardTitle>
              <CardDescription>Informe os dados da sua empresa para começar</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCriarEmpresa} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome da Empresa *</Label>
                  <Input
                    placeholder="Ex: Padaria São José"
                    value={empresa.nome}
                    onChange={e => setEmpresa(p => ({ ...p, nome: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Razão Social</Label>
                  <Input
                    placeholder="Ex: São José Alimentos LTDA"
                    value={empresa.razao_social}
                    onChange={e => setEmpresa(p => ({ ...p, razao_social: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input
                    placeholder="00.000.000/0001-00"
                    value={empresa.cnpj}
                    onChange={e => setEmpresa(p => ({ ...p, cnpj: e.target.value }))}
                  />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Continuar
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Primeira Unidade</CardTitle>
              <CardDescription>Crie seu Centro de Distribuição (CD) ou primeira loja</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCriarLoja} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'cd', label: 'Centro de Distribuição', desc: 'Controla estoque central' },
                      { value: 'loja', label: 'Loja', desc: 'Ponto de venda' }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setLoja(p => ({ ...p, tipo: opt.value }))}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${loja.tipo === opt.value ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <p className="text-sm font-semibold">{opt.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    placeholder={loja.tipo === 'cd' ? 'Ex: CD Principal' : 'Ex: Loja Centro'}
                    value={loja.nome}
                    onChange={e => setLoja(p => ({ ...p, nome: e.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Finalizar configuração
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}