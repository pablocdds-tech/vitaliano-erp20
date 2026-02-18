/**
 * Tela pública de onboarding — "Criar minha empresa"
 * Cria: Empresa + Loja inicial + AssinaturaEmpresa (trial)
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Store, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { criarAssinaturaTrial } from '@/components/services/assinaturaService';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';

const STEPS = ['empresa', 'loja', 'confirmar', 'pronto'];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    empresa_nome: '',
    empresa_cnpj: '',
    loja_nome: '',
    responsavel_nome: '',
  });
  const [resultado, setResultado] = useState(null);

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleCriar = async () => {
    if (!form.empresa_nome.trim()) { toast.error('Informe o nome da empresa.'); return; }
    if (!form.loja_nome.trim()) { toast.error('Informe o nome da primeira loja.'); return; }

    setLoading(true);
    try {
      // 1. Criar empresa
      const empresa = await base44.entities.Empresa.create({
        nome: form.empresa_nome.trim(),
        razao_social: form.empresa_nome.trim(),
        cnpj: form.empresa_cnpj.trim() || '00.000.000/0001-00',
        plano: 'starter',
        status: 'ativo',
        configuracoes: { moeda: 'BRL', fuso_horario: 'America/Sao_Paulo', tema: 'system' },
      });

      // 2. Criar loja inicial
      await base44.entities.Loja.create({
        empresa_id: empresa.id,
        nome: form.loja_nome.trim(),
        tipo: 'loja',
        status: 'ativo',
        saldo_banco_virtual: 0,
      });

      // 3. Criar assinatura trial
      const user = await base44.auth.me().catch(() => null);
      const assinatura = await criarAssinaturaTrial(empresa.id, user?.email);

      setResultado({
        empresa,
        assinatura,
        vencimento: assinatura.data_vencimento,
      });
      setStep(3);
      toast.success('Empresa criada com sucesso! Trial de 14 dias ativado.');
    } catch (e) {
      toast.error('Erro ao criar empresa: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Vitaliano ERP</h1>
          <p className="text-slate-500 text-sm">Crie sua empresa e comece em 2 minutos</p>
        </div>

        {/* Indicador de steps */}
        {step < 3 && (
          <div className="flex items-center gap-2 justify-center">
            {['Empresa', 'Loja', 'Confirmar'].map((s, i) => (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-1.5 text-xs font-medium ${i <= step ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${i < step ? 'bg-emerald-600 text-white' : i === step ? 'border-2 border-emerald-600 text-emerald-600' : 'border border-slate-300 text-slate-400'}`}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className="hidden sm:inline">{s}</span>
                </div>
                {i < 2 && <div className={`flex-1 h-px max-w-8 ${i < step ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
              </React.Fragment>
            ))}
          </div>
        )}

        <Card className="shadow-xl border-0">
          <CardContent className="pt-6 space-y-4">
            {/* STEP 0 — Dados da empresa */}
            {step === 0 && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-semibold text-slate-800">Dados da Empresa</h2>
                </div>
                <div className="space-y-1">
                  <Label>Nome da Empresa *</Label>
                  <Input placeholder="Ex: Restaurante Bom Sabor Ltda" value={form.empresa_nome} onChange={e => upd('empresa_nome', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>CNPJ</Label>
                  <Input placeholder="00.000.000/0001-00 (opcional)" value={form.empresa_cnpj} onChange={e => upd('empresa_cnpj', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Nome do Responsável</Label>
                  <Input placeholder="Seu nome" value={form.responsavel_nome} onChange={e => upd('responsavel_nome', e.target.value)} />
                </div>
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2" onClick={() => {
                  if (!form.empresa_nome.trim()) { toast.error('Informe o nome da empresa.'); return; }
                  setStep(1);
                }}>
                  Próximo <ArrowRight className="w-4 h-4" />
                </Button>
              </>
            )}

            {/* STEP 1 — Dados da loja */}
            {step === 1 && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Store className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-semibold text-slate-800">Primeira Unidade</h2>
                </div>
                <div className="space-y-1">
                  <Label>Nome da Loja / Unidade *</Label>
                  <Input placeholder="Ex: Loja Centro" value={form.loja_nome} onChange={e => upd('loja_nome', e.target.value)} />
                </div>
                <p className="text-xs text-slate-400">Você poderá adicionar mais lojas depois.</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>Voltar</Button>
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2" onClick={() => {
                    if (!form.loja_nome.trim()) { toast.error('Informe o nome da loja.'); return; }
                    setStep(2);
                  }}>
                    Próximo <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}

            {/* STEP 2 — Confirmação */}
            {step === 2 && (
              <>
                <h2 className="font-semibold text-slate-800 mb-3">Confirmar Cadastro</h2>
                <div className="space-y-2 p-3 rounded-lg bg-slate-50 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Empresa:</span>
                    <span className="font-medium">{form.empresa_nome}</span>
                  </div>
                  {form.empresa_cnpj && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">CNPJ:</span>
                      <span className="font-medium">{form.empresa_cnpj}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Loja inicial:</span>
                    <span className="font-medium">{form.loja_nome}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-slate-500">Plano:</span>
                    <span className="font-bold text-emerald-600">Trial gratuito — 14 dias</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Voltar</Button>
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2" onClick={handleCriar} disabled={loading}>
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Criando...</> : 'Criar Empresa'}
                  </Button>
                </div>
              </>
            )}

            {/* STEP 3 — Sucesso */}
            {step === 3 && resultado && (
              <div className="text-center space-y-4 py-2">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Empresa criada!</h2>
                  <p className="text-slate-500 text-sm mt-1">Seu trial gratuito expira em <strong>{resultado.vencimento}</strong>.</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 text-sm text-emerald-700 font-medium">
                  {resultado.empresa.nome} — Trial 14 dias ativo
                </div>
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => window.location.href = createPageUrl('Dashboard')}>
                  Acessar o ERP
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400">
          Já tem uma conta?{' '}
          <a href={createPageUrl('Dashboard')} className="text-emerald-600 hover:underline">Entrar</a>
        </p>
      </div>
    </div>
  );
}