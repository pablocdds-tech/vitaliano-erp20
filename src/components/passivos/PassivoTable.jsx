import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye } from 'lucide-react';
import { formatMoney } from '../ui-custom/MoneyDisplay';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const tipoLabels = {
  cartao: 'Cartão', emprestimo: 'Empréstimo', financiamento: 'Financiamento',
  fornecedor: 'Fornecedor', cheque_especial: 'Cheque Especial', acordo: 'Acordo'
};
const responsavelLabels = { NB: 'NB', Praca: 'Praça', Pablo_PF: 'Pablo PF' };
const statusColors = { ativo: 'bg-blue-100 text-blue-800', quitado: 'bg-green-100 text-green-800', renegociado: 'bg-amber-100 text-amber-800' };

export default function PassivoTable({ passivos, parcelas }) {

  const getProxVencimento = (passivoId) => {
    const pends = parcelas.filter(p => p.passivo_id === passivoId && p.status === 'pendente')
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
    return pends[0]?.data_vencimento || '—';
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Saldo Atual</TableHead>
                <TableHead className="text-right">Parcela</TableHead>
                <TableHead>Próx. Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {passivos.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum passivo cadastrado</TableCell></TableRow>
              )}
              {passivos.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.titulo}</TableCell>
                  <TableCell>{tipoLabels[p.tipo] || p.tipo}</TableCell>
                  <TableCell>{responsavelLabels[p.responsavel] || p.responsavel}</TableCell>
                  <TableCell className="text-right font-mono">{formatMoney(p.saldo_atual)}</TableCell>
                  <TableCell className="text-right font-mono">{formatMoney(p.valor_parcela)}</TableCell>
                  <TableCell>{getProxVencimento(p.id) !== '—' ? new Date(getProxVencimento(p.id) + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[p.status] || ''}>{p.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link to={createPageUrl('PassivoDetalhe') + `?id=${p.id}`}>
                      <Button variant="ghost" size="sm"><Eye className="w-4 h-4 mr-1" /> Detalhar</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}