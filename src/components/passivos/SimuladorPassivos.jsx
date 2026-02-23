import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calculator, AlertTriangle } from 'lucide-react';
import { formatMoney } from '../ui-custom/MoneyDisplay';
import { addMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function SimuladorPassivos({ parcelas, passivos }) {
  const [teto, setTeto] = useState('');
  const [estrategia, setEstrategia] = useState('avalanche');
  const [horizonte, setHorizonte] = useState('12');
  const [resultado, setResultado] = useState(null);

  const gerarPlano = () => {
    const tetoVal = Number(teto);
    if (!tetoVal || tetoVal <= 0) return;

    const meses = Number(horizonte);
    const hoje = new Date();
    const plano = [];

    for (let i = 0; i < meses; i++) {
      const mesRef = addMonths(hoje, i);
      const mesStr = format(mesRef, 'yyyy-MM');
      const mesLabel = format(mesRef, 'MMM/yyyy', { locale: ptBR });

      // Parcelas pendentes desse mês
      const parcelasMes = parcelas.filter(p => {
        if (p.status === 'pago') return false;
        const venc = p.data_vencimento?.substring(0, 7);
        return venc === mesStr;
      });

      // Enriquecer com dados do passivo
      const detalhes = parcelasMes.map(pm => {
        const passivo = passivos.find(pa => pa.id === pm.passivo_id);
        return { ...pm, passivo_titulo: passivo?.titulo || '?', juros: passivo?.taxa_juros_mensal || 0, saldo: passivo?.saldo_atual || 0 };
      });

      // Ordenar conforme estratégia
      if (estrategia === 'avalanche') {
        detalhes.sort((a, b) => b.juros - a.juros);
      } else if (estrategia === 'snowball') {
        detalhes.sort((a, b) => a.saldo - b.saldo);
      }

      const totalMes = detalhes.reduce((s, d) => s + (d.valor || 0), 0);
      const alerta = totalMes > tetoVal;

      plano.push({ mes: mesLabel, total: totalMes, parcelas: detalhes.length, alerta, detalhes });
    }

    setResultado(plano);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calculator className="w-5 h-5" /> Simulador de Passivos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Teto Mensal (R$)</Label>
              <Input type="number" step="0.01" min="0" value={teto} onChange={e => setTeto(e.target.value)} placeholder="Ex: 15000" />
            </div>
            <div>
              <Label>Estratégia</Label>
              <Select value={estrategia} onValueChange={setEstrategia}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="avalanche">Avalanche (maior juros)</SelectItem>
                  <SelectItem value="snowball">Snowball (menor saldo)</SelectItem>
                  <SelectItem value="caixa">Caixa (reduzir pico)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Horizonte</Label>
              <Select value={horizonte} onValueChange={setHorizonte}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                  <SelectItem value="24">24 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={gerarPlano} className="w-full">Gerar Plano</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Total Planejado</TableHead>
                    <TableHead className="text-center">Parcelas</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.map((mes, idx) => (
                    <TableRow key={idx} className={mes.alerta ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                      <TableCell className="font-medium capitalize">{mes.mes}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(mes.total)}</TableCell>
                      <TableCell className="text-center">{mes.parcelas}</TableCell>
                      <TableCell className="text-center">
                        {mes.alerta ? (
                          <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Excede teto</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}