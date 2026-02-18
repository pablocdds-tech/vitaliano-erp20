import React from 'react';
import { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CupomConferencia({ pedido, cd, lojaDestino }) {
  if (!pedido) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-lg mx-auto font-mono text-sm">
      <div className="text-center border-b pb-4 mb-4">
        <h2 className="text-lg font-bold">CUPOM DE CONFERÊNCIA</h2>
        <p className="text-xs text-slate-500">Pedido Interno CD → Loja</p>
        <p className="text-xs text-slate-400 mt-1">#{pedido.id.slice(-8).toUpperCase()}</p>
      </div>

      <div className="space-y-1 text-xs mb-4">
        <div className="flex justify-between">
          <span className="text-slate-500">Origem:</span>
          <span className="font-semibold">{cd?.nome || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Destino:</span>
          <span className="font-semibold">{lojaDestino?.nome || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Data:</span>
          <span>{pedido.data ? format(new Date(pedido.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Confirmado por:</span>
          <span>{pedido.confirmado_por || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Confirmado em:</span>
          <span>{pedido.data_confirmacao ? format(new Date(pedido.data_confirmacao), 'dd/MM/yyyy HH:mm') : '-'}</span>
        </div>
      </div>

      <div className="border-t border-dashed pt-3 mb-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left pb-1">Produto</th>
              <th className="text-center pb-1 w-12">Qtd</th>
              <th className="text-right pb-1 w-20">Unit.</th>
              <th className="text-right pb-1 w-20">Total</th>
            </tr>
          </thead>
          <tbody>
            {(pedido.itens || []).map((item, idx) => (
              <tr key={idx} className="border-b border-dashed last:border-0">
                <td className="py-1">{item.produto_nome}</td>
                <td className="py-1 text-center">{item.quantidade}</td>
                <td className="py-1 text-right">{formatMoney(item.preco_unitario)}</td>
                <td className="py-1 text-right font-semibold">{formatMoney(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t-2 pt-3 flex justify-between items-center">
        <span className="font-bold text-base">{pedido.total_itens} itens</span>
        <div className="text-right">
          <span className="text-xs text-slate-500 block">TOTAL</span>
          <span className="text-xl font-bold">{formatMoney(pedido.valor_total)}</span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t text-center text-xs text-slate-400">
        <p>Documento gerado automaticamente pelo sistema.</p>
        <p>Banco Virtual debitado na loja — crédito no CD.</p>
      </div>
    </div>
  );
}