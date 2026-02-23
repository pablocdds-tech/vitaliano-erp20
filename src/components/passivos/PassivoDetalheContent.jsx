import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, Clock, ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { formatMoney } from '../ui-custom/MoneyDisplay';
import { sincronizarParcelas } from '../services/passivoService';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

const tipoLabels = {
  cartao: 'Cartão', emprestimo: 'Empréstimo', financiamento: 'Financiamento',
  fornecedor: 'Fornecedor', cheque_especial: 'Cheque Especial', acordo: 'Acordo'
};
const responsavelLabels = { NB: 'NB', Praca: 'Praça', Pablo_PF: 'Pablo PF' };

export default function PassivoDetalheContent({ passivo, parcelas, onRefresh }) {
  const [syncing, setSyncing] = useState(false);

  // Sincronizar ao abrir
  useEffect(() => {
    if (passivo?.id && passivo?.empresa_id) {
      handleSync();
    }
  }, [passivo?.id]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await sincronizarParcelas(passivo.id, passivo.empresa_id);
      onRefresh();
    } catch (err) {
      toast.error('Erro ao sincronizar: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const parcelasOrdenadas = [...parcelas].sort((a, b) => a.numero_parcela - b.numero_parcela);
  const pagas = parcelasOrdenadas.filter(p => p.status === 'pago').length;
  const total = parcelasOrdenadas.length;
  const progresso = total > 0 ? (pagas / total) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to={createPageUrl('Passivos')}>
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
        </Link>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
          {syncing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Sincronizar com AP
        </Button>
      </div>

      {/* Dados principais */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{passivo.titulo}</CardTitle>
            <Badge className={passivo.status === 'ativo' ? 'bg-blue-100 text-blue-800' : passivo.status === 'quitado' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
              {passivo.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">Tipo:</span> <p className="font-medium">{tipoLabels[passivo.tipo]}</p></div>
            <div><span className="text-muted-foreground">Credor:</span> <p className="font-medium">{passivo.credor_nome}</p></div>
            <div><span className="text-muted-foreground">Responsável:</span> <p className="font-medium">{responsavelLabels[passivo.responsavel]}</p></div>
            <div><span className="text-muted-foreground">Juros Mensal:</span> <p className="font-medium">{passivo.taxa_juros_mensal ? `${passivo.taxa_juros_mensal}%` : '—'}</p></div>
            <div><span className="text-muted-foreground">Valor Original:</span> <p className="font-medium">{formatMoney(passivo.valor_original)}</p></div>
            <div><span className="text-muted-foreground">Saldo Atual:</span> <p className="font-bold text-red-600">{formatMoney(passivo.saldo_atual)}</p></div>
            <div><span className="text-muted-foreground">Parcelas:</span> <p className="font-medium">{passivo.total_parcelas}x de {formatMoney(passivo.valor_parcela)}</p></div>
            <div><span className="text-muted-foreground">Início:</span> <p className="font-medium">{passivo.data_inicio ? new Date(passivo.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</p></div>
          </div>
          {passivo.observacoes && <p className="mt-4 text-sm text-muted-foreground border-t pt-3">{passivo.observacoes}</p>}
        </CardContent>
      </Card>

      {/* Progresso */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso de Pagamento</span>
            <span className="text-sm font-bold">{pagas}/{total} parcelas pagas</span>
          </div>
          <Progress value={progresso} className="h-3" />
        </CardContent>
      </Card>

      {/* Parcelas */}
      <Card>
        <CardHeader><CardTitle>Parcelas</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pago em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcelasOrdenadas.map(p => {
                  const vencida = p.status === 'pendente' && new Date(p.data_vencimento) < new Date();
                  return (
                    <TableRow key={p.id} className={vencida ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                      <TableCell className="font-medium">{p.numero_parcela}</TableCell>
                      <TableCell>{new Date(p.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(p.valor)}</TableCell>
                      <TableCell>
                        {p.status === 'pago' ? (
                          <Badge className="bg-green-100 text-green-800 gap-1"><CheckCircle2 className="w-3 h-3" /> Pago</Badge>
                        ) : vencida ? (
                          <Badge variant="destructive">Vencida</Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-700 gap-1"><Clock className="w-3 h-3" /> Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell>{p.data_pagamento ? new Date(p.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}