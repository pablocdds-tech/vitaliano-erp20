import React, { useRef } from 'react';
import { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export default function CupomConferencia({ pedido, cd, lojaDestino }) {
  const printRef = useRef();

  if (!pedido) return null;

  const handlePrint = () => {
    const conteudo = printRef.current.innerHTML;
    const janela = window.open('', '_blank', 'width=800,height=900');
    janela.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Cupom de Conferência #${pedido.id.slice(-8).toUpperCase()}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; background: #fff; padding: 24px; }
            .cupom { max-width: 640px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
            .header h1 { font-size: 18px; font-weight: bold; letter-spacing: 2px; }
            .header p { font-size: 11px; color: #555; margin-top: 4px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-bottom: 16px; font-size: 11px; }
            .info-row { display: flex; justify-content: space-between; }
            .info-row span:first-child { color: #555; }
            .info-row span:last-child { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
            thead tr { border-bottom: 1px solid #000; }
            th { text-align: left; padding: 4px 6px; font-weight: bold; }
            th:nth-child(2), td:nth-child(2) { text-align: center; }
            th:nth-child(3), td:nth-child(3), th:nth-child(4), td:nth-child(4) { text-align: right; }
            tbody tr { border-bottom: 1px dashed #aaa; }
            td { padding: 5px 6px; }
            .total-row { border-top: 2px solid #000; padding-top: 10px; display: flex; justify-content: space-between; align-items: flex-end; margin-top: 4px; }
            .total-row .label { font-size: 13px; font-weight: bold; }
            .total-row .valor { text-align: right; }
            .total-row .valor small { display: block; font-size: 10px; color: #555; }
            .total-row .valor strong { font-size: 20px; }
            .rodape { margin-top: 16px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 10px; color: #666; text-align: center; }
            .assinaturas { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .assinatura-box { text-align: center; }
            .assinatura-linha { border-top: 1px solid #000; padding-top: 6px; margin-top: 50px; }
            .assinatura-linha p { font-size: 11px; font-weight: bold; }
            .assinatura-linha small { font-size: 10px; color: #555; }
            @media print {
              body { padding: 16px; }
            }
          </style>
        </head>
        <body>
          <div class="cupom">
            ${conteudo}
          </div>
          <script>window.onload = function() { window.print(); }<\/script>
        </body>
      </html>
    `);
    janela.document.close();
  };

  const dataFormatada = pedido.data
    ? format(new Date(pedido.data + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : '-';

  return (
    <div className="space-y-4">
      {/* Botão imprimir — não aparece na impressão */}
      <div className="flex justify-end print:hidden">
        <Button onClick={handlePrint} variant="outline" className="gap-2">
          <Printer className="w-4 h-4" />
          Imprimir Cupom
        </Button>
      </div>

      {/* Conteúdo do cupom */}
      <div ref={printRef}>
        <div className="header">
          <h1>CUPOM DE CONFERÊNCIA</h1>
          <p>Pedido Interno CD → Loja &nbsp;|&nbsp; #{pedido.id.slice(-8).toUpperCase()}</p>
        </div>

        <div className="info-grid">
          <div className="info-row"><span>Origem (CD):</span><span>{cd?.nome || '-'}</span></div>
          <div className="info-row"><span>Destino (Loja):</span><span>{lojaDestino?.nome || '-'}</span></div>
          <div className="info-row"><span>Data:</span><span>{dataFormatada}</span></div>
          <div className="info-row"><span>Emitido por:</span><span>{pedido.confirmado_por || '-'}</span></div>
          <div className="info-row">
            <span>Confirmado em:</span>
            <span>{pedido.data_confirmacao ? format(new Date(pedido.data_confirmacao), 'dd/MM/yyyy HH:mm') : '-'}</span>
          </div>
          <div className="info-row"><span>Total de itens:</span><span>{pedido.total_itens || 0}</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th style={{textAlign:'center', width:'60px'}}>Qtd</th>
              <th style={{textAlign:'right', width:'90px'}}>Unit.</th>
              <th style={{textAlign:'right', width:'90px'}}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(pedido.itens || []).map((item, idx) => (
              <tr key={idx}>
                <td>{item.produto_nome}</td>
                <td style={{textAlign:'center'}}>{item.quantidade}</td>
                <td style={{textAlign:'right'}}>{formatMoney(item.preco_unitario)}</td>
                <td style={{textAlign:'right', fontWeight:'bold'}}>{formatMoney(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="total-row">
          <span className="label">{pedido.total_itens} {pedido.total_itens === 1 ? 'item' : 'itens'}</span>
          <div className="valor">
            <small>VALOR TOTAL</small>
            <strong>{formatMoney(pedido.valor_total)}</strong>
          </div>
        </div>

        {/* Assinaturas */}
        <div className="assinaturas">
          <div className="assinatura-box">
            <div className="assinatura-linha">
              <p>Responsável pela Expedição</p>
              <small>{cd?.nome || 'CD'}</small>
            </div>
          </div>
          <div className="assinatura-box">
            <div className="assinatura-linha">
              <p>Responsável pelo Recebimento</p>
              <small>{lojaDestino?.nome || 'Loja'}</small>
            </div>
          </div>
        </div>

        <div className="rodape">
          <p>Documento gerado automaticamente pelo sistema Vitaliano ERP.</p>
          <p>Banco Virtual: débito na loja — crédito no CD. Movimentos de estoque registrados.</p>
        </div>
      </div>

      {/* Preview visual no sistema (sem estilos inline do print) */}
      <style>{`
        .header { text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 16px; }
        .header h1 { font-size: 16px; font-weight: 800; letter-spacing: 2px; color: #0f172a; }
        .header p { font-size: 11px; color: #64748b; margin-top: 4px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-bottom: 16px; font-size: 11px; }
        .info-row { display: flex; justify-content: space-between; padding: 2px 0; }
        .info-row span:first-child { color: #64748b; }
        .info-row span:last-child { font-weight: 600; color: #0f172a; }
        .total-row { border-top: 2px solid #0f172a; padding-top: 10px; display: flex; justify-content: space-between; align-items: flex-end; margin-top: 4px; }
        .total-row .label { font-size: 14px; font-weight: 700; }
        .total-row .valor { text-align: right; }
        .total-row .valor small { display: block; font-size: 10px; color: #64748b; }
        .total-row .valor strong { font-size: 22px; color: #059669; }
        .rodape { margin-top: 16px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
        .assinaturas { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .assinatura-box { text-align: center; }
        .assinatura-linha { border-top: 1px solid #334155; padding-top: 6px; margin-top: 50px; }
        .assinatura-linha p { font-size: 11px; font-weight: 700; color: #0f172a; }
        .assinatura-linha small { font-size: 10px; color: #64748b; }
      `}</style>

      <div className="border border-slate-200 rounded-xl p-6 bg-white font-mono text-sm">
        {/* preview renderiza o mesmo ref, então já está visível acima */}
      </div>
    </div>
  );
}