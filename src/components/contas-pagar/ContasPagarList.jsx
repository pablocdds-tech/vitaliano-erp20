import React from 'react';
import { format, isAfter } from 'date-fns';
import { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, BanknoteIcon, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

function StatusBadgeInline({ status, vencida }) {
  if (vencida) return <Badge className="bg-red-100 text-red-700 border-0 text-[10px] font-medium">Vencida</Badge>;
  const map = {
    pendente: 'bg-amber-100 text-amber-700',
    parcial: 'bg-blue-100 text-blue-700',
    pago: 'bg-emerald-100 text-emerald-700',
    cancelado: 'bg-slate-100 text-slate-500',
  };
  const labels = { pendente: 'Pendente', parcial: 'Parcial', pago: 'Pago', cancelado: 'Cancelado' };
  return <Badge className={`${map[status] || 'bg-slate-100 text-slate-600'} border-0 text-[10px] font-medium`}>{labels[status] || status}</Badge>;
}

function StatusIcon({ status, vencida }) {
  if (vencida) return <div className="p-1.5 rounded-lg bg-red-50"><AlertTriangle className="w-4 h-4 text-red-500" /></div>;
  if (status === 'pago') return <div className="p-1.5 rounded-lg bg-emerald-50"><CheckCircle2 className="w-4 h-4 text-emerald-500" /></div>;
  if (status === 'parcial') return <div className="p-1.5 rounded-lg bg-blue-50"><Clock className="w-4 h-4 text-blue-500" /></div>;
  return <div className="p-1.5 rounded-lg bg-amber-50"><Clock className="w-4 h-4 text-amber-500" /></div>;
}

export default function ContasPagarList({ contas, lojas, fornecedores, onEdit, onDelete, onPagar }) {
  const hoje = new Date();

  const getCredor = (row) => {
    if (row.fornecedor_id) {
      const f = fornecedores.find(f => f.id === row.fornecedor_id);
      if (f) return f.nome_fantasia || f.razao_social;
    }
    return row.credor_nome || '';
  };

  const getLoja = (lojaId) => lojas.find(l => l.id === lojaId)?.nome || '';

  if (contas.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-sm">Nenhuma conta encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {contas.map(conta => {
        const vencida = (conta.status === 'pendente' || conta.status === 'parcial') && conta.data_vencimento && isAfter(hoje, new Date(conta.data_vencimento + 'T23:59:59'));
        const credor = getCredor(conta);
        const loja = getLoja(conta.loja_id);
        const saldoDevido = (conta.valor_original || 0) - (conta.valor_pago || 0);

        return (
          <div
            key={conta.id}
            className={`bg-white dark:bg-slate-900 rounded-xl border p-4 flex items-center gap-4 transition-colors hover:border-slate-300 dark:hover:border-slate-700 ${
              vencida ? 'border-red-200 dark:border-red-800/50' : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <StatusIcon status={conta.status} vencida={vencida} />

            {/* Info principal */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm text-slate-800 dark:text-white truncate">{conta.descricao}</p>
                <StatusBadgeInline status={conta.status} vencida={vencida} />
                {conta.total_parcelas > 1 && (
                  <span className="text-[10px] text-indigo-500 font-medium bg-indigo-50 px-1.5 py-0.5 rounded">{conta.parcela_atual}/{conta.total_parcelas}</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                {credor && <span>{credor}</span>}
                {loja && <span>• {loja}</span>}
                {conta.forma_pagamento && <span className="capitalize">• {conta.forma_pagamento.replace(/_/g, ' ')}</span>}
              </div>
            </div>

            {/* Vencimento */}
            <div className="text-right hidden sm:block">
              <p className={`text-xs font-medium ${vencida ? 'text-red-600' : 'text-slate-500'}`}>
                {conta.data_vencimento ? format(new Date(conta.data_vencimento + 'T12:00:00'), 'dd/MM/yyyy') : '-'}
              </p>
              <p className="text-[10px] text-slate-400">vencimento</p>
            </div>

            {/* Valor */}
            <div className="text-right min-w-[90px]">
              <p className={`text-sm font-bold ${conta.status === 'pago' ? 'text-emerald-600' : vencida ? 'text-red-600' : 'text-slate-800 dark:text-white'}`}>
                {formatMoney(conta.valor_original)}
              </p>
              {conta.valor_pago > 0 && conta.status !== 'pago' && (
                <p className="text-[10px] text-slate-400">Resta {formatMoney(saldoDevido)}</p>
              )}
            </div>

            {/* Ação rápida + menu */}
            <div className="flex items-center gap-1.5">
              {conta.status !== 'pago' && conta.status !== 'cancelado' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                  onClick={(e) => { e.stopPropagation(); onPagar(conta); }}
                >
                  <BanknoteIcon className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Pagar</span>
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {conta.status !== 'pago' && conta.status !== 'cancelado' && (
                    <DropdownMenuItem onClick={() => onPagar(conta)}>
                      <BanknoteIcon className="w-4 h-4 mr-2" /> Registrar Pagamento
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onEdit(conta)}>
                    <Pencil className="w-4 h-4 mr-2" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600" onClick={() => onDelete(conta.id)}>
                    <Trash2 className="w-4 h-4 mr-2" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
    </div>
  );
}