import React, { useRef } from 'react';
import { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Receipt } from 'lucide-react';

const TERMICA_CSS = `
  @page { size: 80mm auto; margin: 2mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', 'Lucida Console', monospace;
    font-size: 11px;
    color: #000;
    background: #fff;
    width: 80mm;
    padding: 2mm;
    line-height: 1.3;
  }
  .cupom { width: 100%; }
  h1 { font-size: 13px; font-weight: 900; text-align: center; letter-spacing: 1px; margin-bottom: 2px; }
  .subtitle { text-align: center; font-size: 9px; color: #333; margin-bottom: 6px; }
  .sep { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  .sep-bold { border: none; border-top: 2px solid #000; margin: 4px 0; }
  .info { font-size: 10px; line-height: 1.5; }
  .info .row { display: flex; justify-content: space-between; }
  .info .label { color: #333; }
  .info .val { font-weight: bold; text-align: right; max-width: 55%; overflow-wrap: break-word; }
  .items { width: 100%; font-size: 10px; margin: 4px 0; }
  .items .item { padding: 2px 0; border-bottom: 1px dotted #aaa; }
  .items .item-name { font-weight: bold; font-size: 10px; }
  .items .item-detail { display: flex; justify-content: space-between; font-size: 9px; color: #333; }
  .total-section { text-align: right; padding: 6px 0 4px 0; }
  .total-section .total-label { font-size: 11px; font-weight: bold; }
  .total-section .total-value { font-size: 16px; font-weight: 900; }
  .total-section .total-itens { font-size: 9px; color: #333; }
  .assinatura { margin-top: 20px; text-align: center; }
  .assinatura .linha { border-top: 1px solid #000; margin: 0 10px; padding-top: 4px; margin-top: 30px; }
  .assinatura .nome { font-size: 9px; font-weight: bold; }
  .assinatura .sub { font-size: 8px; color: #555; }
  .rodape { margin-top: 10px; text-align: center; font-size: 8px; color: #777; border-top: 1px dashed #aaa; padding-top: 4px; }
`;

export default function CupomTermico({ pedido, cd, lojaDestino }) {
  const ref = useRef();

  if (!pedido) return null;

  const dataFormatada = pedido.data
    ? format(new Date(pedido.data + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })
    : '-';

  const horaConfirmacao = pedido.data_confirmacao
    ? format(new Date(pedido.data_confirmacao), 'dd/MM/yyyy HH:mm')
    : '-';

  const handlePrint = () => {
    const janela = window.open('', '_blank', 'width=350,height=700');
    janela.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Térmica #${pedido.id.slice(-8).toUpperCase()}</title><style>${TERMICA_CSS}</style></head><body><div class="cupom">${ref.current.innerHTML}</div><script>window.onload=()=>{setTimeout(()=>window.print(),300)}<\/script></body></html>`);
    janela.document.close();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handlePrint} variant="outline" className="gap-2">
          <Receipt className="w-4 h-4" />
          Impressão Térmica 80mm 🧾
        </Button>
      </div>

      {/* Preview visual (simula 80mm) */}
      <div className="mx-auto border border-slate-300 rounded-lg bg-white shadow-inner p-3 font-mono text-xs" style={{ maxWidth: '320px' }}>
        <div ref={ref}>
          <h1>CUPOM DE CONFERÊNCIA</h1>
          <p className="subtitle">CD → Loja &nbsp;|&nbsp; #{pedido.id.slice(-8).toUpperCase()}</p>
          <hr className="sep-bold" />

          <div className="info">
            <div className="row"><span className="label">Origem:</span><span className="val">{cd?.nome || '-'}</span></div>
            <div className="row"><span className="label">Destino:</span><span className="val">{lojaDestino?.nome || '-'}</span></div>
            <div className="row"><span className="label">Data:</span><span className="val">{dataFormatada}</span></div>
            <div className="row"><span className="label">Confirmado:</span><span className="val">{horaConfirmacao}</span></div>
            <div className="row"><span className="label">Emitido por:</span><span className="val">{pedido.confirmado_por || '-'}</span></div>
          </div>

          <hr className="sep" />

          <div className="items">
            {(pedido.itens || []).map((item, idx) => (
              <div key={idx} className="item">
                <div className="item-name">{item.produto_nome}</div>
                <div className="item-detail">
                  <span>{item.quantidade} x {formatMoney(item.preco_unitario)}</span>
                  <span style={{ fontWeight: 'bold' }}>{formatMoney(item.subtotal)}</span>
                </div>
              </div>
            ))}
          </div>

          <hr className="sep-bold" />

          <div className="total-section">
            <div className="total-itens">{pedido.total_itens || 0} {(pedido.total_itens || 0) === 1 ? 'item' : 'itens'}</div>
            <div className="total-label">TOTAL</div>
            <div className="total-value">{formatMoney(pedido.valor_total)}</div>
          </div>

          <div className="assinatura">
            <div className="linha">
              <p className="nome">Recebido por</p>
              <p className="sub">{lojaDestino?.nome || 'Loja'}</p>
            </div>
          </div>

          <div className="rodape">
            <p>Vitaliano ERP</p>
          </div>
        </div>
      </div>
    </div>
  );
}