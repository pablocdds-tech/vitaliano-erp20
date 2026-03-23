import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { ArrowLeft, User, Phone, Mail, MapPin, Briefcase, CreditCard, FileText, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function DossieFuncionario({ funcionario, lojas = [], onBack }) {
  const lojasMap = Object.fromEntries(lojas.map(l => [l.id, l.nome]));

  const { data: contratos = [] } = useQuery({
    queryKey: ['contratos-func', funcionario.id],
    queryFn: () => base44.entities.ContratoRH.filter({ funcionario_id: funcionario.id })
  });

  const { data: pontos = [] } = useQuery({
    queryKey: ['pontos-func', funcionario.id],
    queryFn: () => base44.entities.RegistroPonto.filter({ funcionario_id: funcionario.id }, '-horario', 20)
  });

  const tipoLabels = { clt: 'CLT', pj: 'PJ', freelancer: 'Freelancer', estagiario: 'Estagiário', temporario: 'Temporário' };
  const tiposPonto = { entrada: 'Entrada', saida_almoco: 'Saída Almoço', volta_almoco: 'Volta Almoço', saida: 'Saída' };

  return (
    <div>
      <Button variant="ghost" onClick={onBack} className="gap-2 mb-4"><ArrowLeft className="w-4 h-4" /> Voltar</Button>

      <div className="flex flex-col sm:flex-row items-start gap-4 mb-6">
        <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
          {funcionario.foto_url ? <img src={funcionario.foto_url} className="w-20 h-20 rounded-full object-cover" /> : <User className="w-10 h-10 text-slate-400" />}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{funcionario.nome}</h1>
          <p className="text-muted-foreground">{funcionario.cargo} • {tipoLabels[funcionario.tipo] || funcionario.tipo}</p>
          <StatusBadge status={funcionario.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4" /> Dados Pessoais</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p><strong>CPF:</strong> {funcionario.cpf || '-'}</p>
            <p><strong>RG:</strong> {funcionario.rg || '-'}</p>
            <p><strong>Nascimento:</strong> {funcionario.data_nascimento || '-'}</p>
            <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {funcionario.telefone || '-'}</div>
            <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {funcionario.email || '-'}</div>
            {funcionario.endereco?.logradouro && (
              <div className="flex items-start gap-1"><MapPin className="w-3 h-3 mt-0.5" /><span>{funcionario.endereco.logradouro}, {funcionario.endereco.numero} - {funcionario.endereco.bairro}, {funcionario.endereco.cidade}/{funcionario.endereco.estado}</span></div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Briefcase className="w-4 h-4" /> Dados Profissionais</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p><strong>Loja:</strong> {lojasMap[funcionario.loja_id] || '-'}</p>
            <p><strong>Departamento:</strong> {funcionario.departamento || '-'}</p>
            <p><strong>Admissão:</strong> {funcionario.data_admissao || '-'}</p>
            <p><strong>Salário:</strong> {funcionario.salario ? `R$ ${Number(funcionario.salario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><CreditCard className="w-4 h-4" /> Dados Bancários</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p><strong>PIX:</strong> {funcionario.pix || '-'}</p>
            <p><strong>Banco:</strong> {funcionario.banco || '-'}</p>
            <p><strong>Agência:</strong> {funcionario.agencia || '-'}</p>
            <p><strong>Conta:</strong> {funcionario.conta || '-'}</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Contratos ({contratos.length})</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {contratos.length === 0 && <p className="text-muted-foreground">Nenhum contrato</p>}
            {contratos.map(c => (
              <div key={c.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                <span>{c.titulo}</span>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" /> Últimas Marcações de Ponto</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {pontos.length === 0 && <p className="text-muted-foreground">Nenhum registro</p>}
            <div className="space-y-1">
              {pontos.slice(0, 10).map(p => (
                <div key={p.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded text-xs">
                  <span className="font-medium">{tiposPonto[p.tipo]}</span>
                  <span>{p.horario ? format(new Date(p.horario), 'dd/MM/yyyy HH:mm') : '-'}</span>
                  <span className="text-muted-foreground">{p.latitude ? `${Number(p.latitude).toFixed(4)}, ${Number(p.longitude).toFixed(4)}` : 'Sem GPS'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {funcionario.observacoes && (
        <Card className="mt-4">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Observações</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{funcionario.observacoes}</CardContent>
        </Card>
      )}
    </div>
  );
}