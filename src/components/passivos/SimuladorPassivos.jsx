import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, TrendingDown, Loader2 } from 'lucide-react';
import { format, addMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function SimuladorPassivos() {
  const [teto, setTeto] = useState('');
  const [estrategia, setEstrategia] = useState('caixa');
  const [horizonte, setHorizonte] = useState('12');
  const [loading, setLoading] = useState(false);
  const [plano, setPlano] = useState(null);
  const [installments, setInstallments] = useState([]);
  const [liabilities, setLiabilities] = useState([]);

  useEffect(() => {
    const load = async () => {
      const [libs, insts] = await Promise.all([
        base44.entities.FinancialLiability.filter({ status: 'ativo' }),
        base44.entities.LiabilityInstallment.filter({ status: 'pendente' })
      ]);
      setLiabilities(libs);
      setInstallments(insts);
    };
    load();
  }, []);

  const gerarPlano = () => {
    if (!teto) return;
    setLoading(true);

    const tetoNum = parseFloat(teto);
    const meses = parseInt(horizonte);
    const today = new Date();
    const resultado = [];

    for (let m = 0; m < meses; m++) {
      const mesRef = addMonths(startOfMonth(today), m);
      const mesStr = format(mesRef, 'yyyy-MM');

      // Parcelas que vencem neste mês
      const parcelasMes = installments.filter(inst => {
        const d = inst.due_date?.substring(0, 7);
        return d === mesStr;
      });

      // Agrupar por passivo
      const gruposPorPassivo = {};
      for (const p of parcelasMes) {
        const lib = liabilities.find(l => l.id === p.liability_id);
        if (!gruposPorPassivo[p.liability_id]) {
          gruposPorPassivo[p.liability_id] = {
            title: lib?.title || 'Desconhecido',
            type: lib?.type,
            parcelas: []
          };
        }
        gruposPorPassivo[p.liability_id].parcelas.push(p);
      }

      const totalMes = parcelasMes.reduce((s, p) => s + (p.amount || 0), 0);
      const excede = totalMes > tetoNum;

      resultado.push({
        mes: format(mesRef, 'MMM/yyyy', { locale: ptBR }),
        total: totalMes,
        excede,
        grupos: Object.values(gruposPorPassivo),
        qtd: parcelasMes.length
      });
    }

    setPlano(resultado);
    setLoading(false);
  };

  const totalExcedente = plano ? plano.filter(m => m.excede).length : 0;
  const maiorMes = plano ? Math.max(...plano.map(m => m.total)) : 0;

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingDown className="w-5 h-5 text-blue-500" />Simulador de Pagamentos</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <Label>Teto Mensal (R$)</Label>
              <Input type="number" placeholder="10.000" value={teto} onChange={e => setTeto(e.target.value)} />
            </div>
            <div className="space-y-1">
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
            <div className="space-y-1">
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
            <Button onClick={gerarPlano} disabled={loading || !teto}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Gerar Plano
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {plano && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-slate-200">
              <CardContent className="pt-4">
                <p className="text-xs text-slate-500">Meses Críticos (acima do teto)</p>
                <p className={`text-2xl font-bold ${totalExcedente > 0 ? 'text-red-600' : 'text-green-600'}`}>{totalExcedente}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-slate-500">Maior Mês Previsto</p>
                <p className="text-2xl font-bold text-slate-800">{fmt(maiorMes)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-slate-500">Teto Configurado</p>
                <p className="text-2xl font-bold text-blue-600">{fmt(parseFloat(teto))}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Plano Mês a Mês</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2 text-slate-600">Mês</th>
                      <th className="text-center px-4 py-2 text-slate-600">Parcelas</th>
                      <th className="text-right px-4 py-2 text-slate-600">Total</th>
                      <th className="text-right px-4 py-2 text-slate-600">Folga/Déficit</th>
                      <th className="text-center px-4 py-2 text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plano.map((m, idx) => {
                      const delta = parseFloat(teto) - m.total;
                      return (
                        <tr key={idx} className={`border-b hover:bg-slate-50 ${m.excede ? 'bg-red-50' : ''}`}>
                          <td className="px-4 py-3 font-medium capitalize">{m.mes}</td>
                          <td className="px-4 py-3 text-center text-slate-500">{m.qtd}</td>
                          <td className="px-4 py-3 text-right font-bold">{fmt(m.total)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {delta >= 0 ? '+' : ''}{fmt(delta)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {m.excede ? (
                              <Badge className="bg-red-100 text-red-700 border-red-200">
                                <AlertTriangle className="w-3 h-3 mr-1" />ALERTA
                              </Badge>
                            ) : m.total === 0 ? (
                              <Badge className="bg-slate-100 text-slate-500">Sem parcelas</Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-700 border-green-200">
                                <CheckCircle2 className="w-3 h-3 mr-1" />OK
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}