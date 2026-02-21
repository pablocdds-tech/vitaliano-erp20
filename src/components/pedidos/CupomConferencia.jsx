import React, { useRef } from 'react';
import { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; background: #fff; padding: 28px; }
  .cupom { max-width: 640px; margin: 0 auto; }
  h1 { font-size: 18px; font-weight: 900; letter-spacing: 2px; text-align: center; }
  .subtitle { text-align: center; font-size: 11px; color: #555; margin-top: 4px; }
  hr { border: none; border-top: 2px solid #000; margin: 14px 0; }
  hr.dashed { border-top: 1px dashed #aaa; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 32px; margin: 14px 0; font-size: 11px; }
  .info-row { display: flex; justify-content: space-between; }
  .info-row .label { color: #555; }
  .info-row .val { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 12px 0; }
  thead th { border-bottom: 1px solid #000; padding: 4px 6px; font-weight: bold; }
  thead th:nth-child(2) { text-align: center; }
  thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
  tbody td { padding: 5px 6px; border-bottom: 1px dashed #ccc; }
  tbody td:nth-child(2) { text-align: center; }
  tbody td:nth-child(3), tbody td:nth-child(4) { text-align: right; }
  .total-line { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 10px; border-top: 2px solid #000; margin-top: 4px; }
  .total-line .itens { font-size: 13px; font-weight: bold; }
  .total-line .valor-wrap { text-align: right; }
  .total-line .valor-wrap small { display: block; font-size: 10px; color: #555; }
  .total-line .valor-wrap strong { font-size: 22px; }
  .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 52px; }
  .ass-box { text-align: center; }
  .ass-linha { border-top: 1px solid #000; padding-top: 6px; margin-top: 56px; }
  .ass-linha .nome { font-size: 11px; font-weight: bold; }
  .ass-linha .sub { font-size: 10px; color: #555; }
  .rodape { margin-top: 20px; padding-top: 12px; border-top: 1px dashed #aaa; font-size: 10px; color: #777; text-align: center; line-height: 1.6; }
`;

export default function CupomConferencia({ pedido, cd, lojaDestino }) {
  const cupomRef = useRef();

  if (!pedido) return null;

  const dataFormatada = pedido.data
    ? format(new Date(pedido.data + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : '-';

  const handlePrint = () => {
    const janela = window.open('', '_blank', 'width=820,height=950');
    janela.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Cupom #${pedido.id.slice(-8).toUpperCase()}</title><style>${PRINT_CSS}</style></head><body><div class="cupom">${cupomRef.current.innerHTML}</div><script>window.onload=()=>window.print()<\/script></body></html>`);
    janela.document.close();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handlePrint} variant="outline" className="gap-2">
          <Printer className="w-4 h-4" />
          Impressão A4 🖨️
        </Button>
      </div>

      {/* Preview visual */}
      <div className="border border-slate-200 rounded-xl p-6 bg-white font-mono text-sm shadow-inner">
        <div ref={cupomRef}>
          {/* Cabeçalho */}
          <h1>CUPOM DE CONFERÊNCIA</h1>
          <p className="subtitle">Pedido Interno CD → Loja &nbsp;|&nbsp; #{pedido.id.slice(-8).toUpperCase()}</p>
          <hr />

          {/* Info */}
          <div className="info-grid">
            <div className="info-row"><span className="label">Origem (CD):</span><span className="val">{cd?.nome || '-'}</span></div>
            <div className="info-row"><span className="label">Destino (Loja):</span><span className="val">{lojaDestino?.nome || '-'}</span></div>
            <div className="info-row"><span className="label">Data:</span><span className="val">{dataFormatada}</span></div>
            <div className="info-row"><span className="label">Emitido por:</span><span className="val">{pedido.confirmado_por || '-'}</span></div>
            <div className="info-row">
              <span className="label">Confirmado em:</span>
              <span className="val">{pedido.data_confirmacao ? format(new Date(pedido.data_confirmacao), 'dd/MM/yyyy HH:mm') : '-'}</span>
            </div>
            <div className="info-row"><span className="label">Qtd de itens:</span><span className="val">{pedido.total_itens || 0}</span></div>
          </div>

          <hr className="dashed" />

          {/* Tabela de itens */}
          <table>
            <thead>
              <tr>
                <th style={{textAlign:'left'}}>Produto</th>
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

          {/* Total */}
          <div className="total-line">
            <span className="itens">{pedido.total_itens} {pedido.total_itens === 1 ? 'item' : 'itens'}</span>
            <div className="valor-wrap">
              <small>VALOR TOTAL</small>
              <strong>{formatMoney(pedido.valor_total)}</strong>
            </div>
          </div>

          {/* Assinaturas */}
          <div className="assinaturas">
            <div className="ass-box">
              <div className="ass-linha">
                <p className="nome">Responsável pela Expedição</p>
                <span className="sub">{cd?.nome || 'CD'}</span>
              </div>
            </div>
            <div className="ass-box">
              <div className="ass-linha">
                <p className="nome">Responsável pelo Recebimento</p>
                <span className="sub">{lojaDestino?.nome || 'Loja'}</span>
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div className="rodape">
            <p>Documento gerado automaticamente pelo sistema Vitaliano ERP.</p>
            <p>Banco Virtual: débito na loja · crédito no CD · Estoque registrado.</p>
          </div>
        </div>
      </div>
    </div>
  );
}