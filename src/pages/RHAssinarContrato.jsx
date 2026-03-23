import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function RHAssinarContrato() {
  const [contrato, setContrato] = useState(null);
  const [funcionario, setFuncionario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aceite, setAceite] = useState(false);
  const [assinando, setAssinando] = useState(false);
  const [assinado, setAssinado] = useState(false);
  const [erro, setErro] = useState('');

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  useEffect(() => {
    if (!token) { setErro('Link inválido'); setLoading(false); return; }
    loadContrato();
  }, [token]);

  const loadContrato = async () => {
    const contratos = await base44.entities.ContratoRH.filter({ token_assinatura: token });
    if (!contratos.length) { setErro('Contrato não encontrado ou link expirado'); setLoading(false); return; }
    const c = contratos[0];
    if (c.assinatura_funcionario?.assinado) { setAssinado(true); setContrato(c); setLoading(false); return; }
    if (c.status === 'cancelado' || c.status === 'expirado') { setErro('Contrato cancelado ou expirado'); setLoading(false); return; }
    setContrato(c);
    const funcs = await base44.entities.Funcionario.filter({ id: c.funcionario_id });
    if (funcs.length) setFuncionario(funcs[0]);
    setLoading(false);
  };

  const handleAssinar = async () => {
    setAssinando(true);
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(contrato.conteudo_html + contrato.id + new Date().toISOString()));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    await base44.entities.ContratoRH.update(contrato.id, {
      assinatura_funcionario: {
        assinado: true,
        data: new Date().toISOString(),
        ip: 'capturado-no-servidor',
        user_agent: navigator.userAgent,
        hash_documento: hashHex,
        aceite_termos: true
      },
      status: contrato.assinatura_empresa?.assinado ? 'assinado_ambos' : 'assinado_funcionario'
    });
    setAssinado(true);
    setAssinando(false);
    toast.success('Contrato assinado com sucesso!');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>
  );

  if (erro) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-8 pb-8"><AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" /><h2 className="text-xl font-bold mb-2">Erro</h2><p className="text-muted-foreground">{erro}</p></CardContent>
      </Card>
    </div>
  );

  if (assinado) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-8 pb-8"><CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500 mb-4" /><h2 className="text-xl font-bold mb-2">Contrato Assinado</h2><p className="text-muted-foreground">O contrato <strong>{contrato?.titulo}</strong> foi assinado com sucesso.</p><p className="text-xs text-muted-foreground mt-4">Assinatura registrada com hash SHA-256, data/hora, IP e User-Agent conforme Lei 14.063/2020.</p></CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <div className="max-w-3xl mx-auto">
        <Card className="mb-4">
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> {contrato.titulo}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Funcionário: <strong>{funcionario?.nome}</strong> • CPF: {funcionario?.cpf || 'Não informado'}</p>
            <div className="prose prose-sm max-w-none bg-white dark:bg-slate-900 border rounded-lg p-6" dangerouslySetInnerHTML={{ __html: contrato.conteudo_html }} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox id="aceite" checked={aceite} onCheckedChange={setAceite} />
              <label htmlFor="aceite" className="text-sm leading-relaxed cursor-pointer">
                Declaro que li e concordo com todos os termos deste contrato. Reconheço que esta assinatura digital tem validade jurídica conforme a Lei 14.063/2020 e Medida Provisória 2.200-2/2001.
              </label>
            </div>
            <Button onClick={handleAssinar} disabled={!aceite || assinando} className="w-full gap-2" size="lg">
              {assinando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {assinando ? 'Assinando...' : 'Assinar Contrato Digitalmente'}
            </Button>
            <p className="text-xs text-center text-muted-foreground">Ao assinar, serão registrados: data/hora, hash do documento, IP e navegador para fins de auditoria e validade jurídica.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}