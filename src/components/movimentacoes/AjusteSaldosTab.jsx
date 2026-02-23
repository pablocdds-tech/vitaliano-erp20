import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MoneyDisplay from '@/components/ui-custom/MoneyDisplay';
import { AlertCircle, DollarSign, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function AjusteSaldosTab() {
  const [tipoOrigem, setTipoOrigem] = useState('conta_bancaria');
  const [contaSelecionada, setContaSelecionada] = useState('');
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [saldoAnterior, setSaldoAnterior] = useState(null);

  const queryClient = useQueryClient();

  // Buscar contas bancárias
  const { data: contasBancarias = [] } = useQuery({
    queryKey: ['contas-bancarias'],
    queryFn: () => base44.entities.ContaBancaria.list()
  });

  // Buscar cofres
  const { data: cofres = [] } = useQuery({
    queryKey: ['cofres'],
    queryFn: () => base44.entities.Cofre.list()
  });

  // Mutation para ajustar saldo
  const ajusteMutation = useMutation({
    mutationFn: async (dados) => {
      const response = await base44.functions.invoke('ajustarSaldo', dados);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-bancarias'] });
      queryClient.invalidateQueries({ queryKey: ['cofres'] });
      setContaSelecionada('');
      setValor('');
      setMotivo('');
      setObservacao('');
      setSaldoAnterior(null);
      alert('Ajuste registrado com sucesso!');
    },
    onError: (error) => {
      alert('Erro ao registrar ajuste: ' + error.message);
    }
  });

  const handleSelecionarConta = (id) => {
    setContaSelecionada(id);
    
    if (tipoOrigem === 'conta_bancaria') {
      const conta = contasBancarias.find(c => c.id === id);
      setSaldoAnterior(conta?.saldo_atual || 0);
    } else {
      const cofre = cofres.find(c => c.id === id);
      setSaldoAnterior(cofre?.saldo_atual || 0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!contaSelecionada || !valor || !motivo) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    const valorNum = parseFloat(valor);
    if (isNaN(valorNum) || valorNum === 0) {
      alert('Informe um valor válido (diferente de zero)');
      return;
    }

    ajusteMutation.mutate({
      tipoOrigem,
      contaId: contaSelecionada,
      valor: valorNum,
      motivo,
      observacao,
      saldoAnterior: saldoAnterior || 0,
      data: format(new Date(), 'yyyy-MM-dd')
    });
  };

  const contasDisponiveis = tipoOrigem === 'conta_bancaria' ? contasBancarias : cofres;
  const contaSelecionadaObj = contasDisponiveis.find(c => c.id === contaSelecionada);
  const novoSaldo = saldoAnterior !== null ? saldoAnterior + parseFloat(valor || 0) : null;

  return (
    <div className="space-y-6">
      {/* Alerta */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 dark:text-amber-200">
          <p className="font-medium">Ajuste Manual de Saldos</p>
          <p className="text-xs mt-1">Use apenas para corrigir discrepâncias identificadas. Todo ajuste é registrado e auditável.</p>
        </div>
      </div>

      {/* Formulário */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tipo de Origem */}
          <div className="space-y-2">
            <Label>Tipo de Conta *</Label>
            <Select value={tipoOrigem} onValueChange={(val) => {
              setTipoOrigem(val);
              setContaSelecionada('');
              setSaldoAnterior(null);
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conta_bancaria">Conta Bancária</SelectItem>
                <SelectItem value="cofre">Cofre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Seleção de Conta */}
          <div className="space-y-2">
            <Label>Selecionar {tipoOrigem === 'conta_bancaria' ? 'Conta' : 'Cofre'} *</Label>
            <Select value={contaSelecionada} onValueChange={handleSelecionarConta}>
              <SelectTrigger>
                <SelectValue placeholder={`Escolha uma ${tipoOrigem === 'conta_bancaria' ? 'conta' : 'cofre'}`} />
              </SelectTrigger>
              <SelectContent>
                {contasDisponiveis.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nome || item.descricao} - Saldo: R$ {(item.saldo_atual || 0).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Exibição do Saldo Anterior */}
          {saldoAnterior !== null && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Saldo Anterior</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  <MoneyDisplay value={saldoAnterior} />
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Ajuste</p>
                <p className={`text-lg font-semibold ${parseFloat(valor || 0) > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {parseFloat(valor || 0) > 0 ? '+' : ''}<MoneyDisplay value={parseFloat(valor || 0)} />
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Novo Saldo</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  {novoSaldo !== null ? <MoneyDisplay value={novoSaldo} /> : '-'}
                </p>
              </div>
            </div>
          )}

          {/* Valor */}
          <div className="space-y-2">
            <Label>Valor do Ajuste (R$) *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-slate-500">
              Use valores positivos para aumentar ou negativos para diminuir o saldo
            </p>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label>Motivo do Ajuste *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="correcao_contagem">Correção de Contagem</SelectItem>
                <SelectItem value="erro_lancamento">Erro de Lançamento</SelectItem>
                <SelectItem value="conciliacao_bancaria">Conciliação Bancária</SelectItem>
                <SelectItem value="reembolso">Reembolso</SelectItem>
                <SelectItem value="diferenca_auditoria">Diferença Auditoria</SelectItem>
                <SelectItem value="ajuste_manual">Ajuste Manual</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Observação */}
          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea
              placeholder="Detalhes adicionais sobre este ajuste..."
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setContaSelecionada('');
                setValor('');
                setMotivo('');
                setObservacao('');
                setSaldoAnterior(null);
              }}
            >
              Limpar
            </Button>
            <Button
              type="submit"
              disabled={ajusteMutation.isPending || !contaSelecionada || !valor || !motivo}
              className="gap-2"
            >
              {ajusteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Registrar Ajuste
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}