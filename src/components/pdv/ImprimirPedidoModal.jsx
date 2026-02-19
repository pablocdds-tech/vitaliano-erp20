/**
 * Modal de impressão do pedido PDV — Cupom 80mm ou A4
 */
import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Receipt, FileText } from 'lucide-react';
import { formatMoney } from '@/components/ui-custom/MoneyDisplay';
import { format } from 'date-fns';

function CupomTemplate({ pedido }) {
  return (
    <div style={{ width: '80mm', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.4', padding: '8px' }}>
      <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '8px' }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold' }}>PEDIDO INTERNO</div>
        <div>CD → {pedido.lojaDestino}</div>
        <div style={{ fontSize: '11px' }}>{pedido.cd}</div>
        <div style={{ fontSize: '11px' }}>{format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
        <div style={{ fontSize: '11px' }}>Ref: #{pedido.id?.slice(-6).toUpperCase()}</div>
      </div>

      <div style={{ marginBottom: '8px' }}>
        {pedido.itens.map((item, i) => (
          <div key={i} style={{ marginBottom: '4px' }}>
            <div style={{ fontWeight: 'bold', wordBreak: 'break-word' }}>{item.produto_nome}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{item.quantidade} un × {formatMoney(item.preco_unitario)}</span>
              <span style={{ fontWeight: 'bold' }}>{formatMoney(item.subtotal)}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px dashed #000', paddingTop: '8px', marginTop: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold' }}>
          <span>TOTAL</span>
          <span>{formatMoney(pedido.total)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '4px' }}>
          <span>{pedido.itens.length} produto(s)</span>
          <span>{pedido.itens.reduce((s, i) => s + i.quantidade, 0)} un</span>
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #000', paddingTop: '12px', marginTop: '12px', fontSize: '11px' }}>
        <div>Conferente: ________________________________</div>
        <div style={{ marginTop: '24px' }}>Assinatura: _________________________________</div>
        <div style={{ textAlign: 'center', marginTop: '12px' }}>*** Documento interno ***</div>
      </div>
    </div>
  );
}

function A4Template({ pedido }) {
  return (
    <div style={{ width: '210mm', minHeight: '297mm', fontFamily: 'Arial, sans-serif', fontSize: '12px', padding: '20mm', boxSizing: 'border-box', color: '#1a1a1a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #333', paddingBottom: '12px', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>PEDIDO INTERNO</div>
          <div style={{ fontSize: '12px', color: '#666' }}>Transferência CD → Loja</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '11px' }}>
          <div><b>Ref:</b> #{pedido.id?.slice(-6).toUpperCase()}</div>
          <div><b>Data:</b> {format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '40px', marginBottom: '20px' }}>
        <div style={{ flex: 1, background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
          <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', marginBottom: '4px' }}>ORIGEM (CD)</div>
          <div style={{ fontWeight: 'bold' }}>{pedido.cd}</div>
        </div>
        <div style={{ flex: 1, background: '#f0f9f4', padding: '10px', borderRadius: '4px' }}>
          <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', marginBottom: '4px' }}>DESTINO (LOJA)</div>
          <div style={{ fontWeight: 'bold' }}>{pedido.lojaDestino}</div>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
        <thead>
          <tr style={{ background: '#333', color: 'white' }}>
            <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '11px' }}>#</th>
            <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '11px' }}>Produto</th>
            <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '11px' }}>Qtd</th>
            <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '11px' }}>Custo Un.</th>
            <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '11px' }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {pedido.itens.map((item, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fafafa' : 'white', borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '7px 10px', fontSize: '11px', color: '#666' }}>{i + 1}</td>
              <td style={{ padding: '7px 10px', fontWeight: '500' }}>{item.produto_nome}</td>
              <td style={{ padding: '7px 10px', textAlign: 'right' }}>{item.quantidade}</td>
              <td style={{ padding: '7px 10px', textAlign: 'right' }}>{formatMoney(item.preco_unitario)}</td>
              <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 'bold' }}>{formatMoney(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f0f9f4', fontWeight: 'bold', borderTop: '2px solid #333' }}>
            <td colSpan={2} style={{ padding: '8px 10px' }}>TOTAL</td>
            <td style={{ padding: '8px 10px', textAlign: 'right' }}>{pedido.itens.reduce((s, i) => s + i.quantidade, 0)} un</td>
            <td></td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '14px' }}>{formatMoney(pedido.total)}</td>
          </tr>
        </tfoot>
      </table>

      <div style={{ display: 'flex', gap: '40px', marginTop: '40px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ borderTop: '1px solid #333', paddingTop: '8px', fontSize: '11px', color: '#666' }}>
            Responsável CD / Expedição
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ borderTop: '1px solid #333', paddingTop: '8px', fontSize: '11px', color: '#666' }}>
            Responsável Loja / Recebimento
          </div>
        </div>
      </div>

      <div style={{ marginTop: '20px', fontSize: '10px', color: '#999', borderTop: '1px solid #eee', paddingTop: '8px' }}>
        Documento interno de controle. Gerado em {format(new Date(), 'dd/MM/yyyy HH:mm:ss')}
      </div>
    </div>
  );
}

export default function ImprimirPedidoModal({ open, onClose, pedido }) {
  const [formato, setFormato] = useState('cupom');
  const printRef = useRef(null);

  if (!pedido) return null;

  const handlePrint = () => {
    const conteudo = printRef.current?.innerHTML;
    if (!conteudo) return;

    const estilo = formato === 'cupom'
      ? `@media print { body { margin: 0; } } @page { size: 80mm auto; margin: 0; }`
      : `@media print { body { margin: 0; } } @page { size: A4; margin: 0; }`;

    const janela = window.open('', '_blank');
    janela.document.write(`
      <html><head><title>Pedido #${pedido.id?.slice(-6).toUpperCase()}</title>
      <style>${estilo}</style></head>
      <body>${conteudo}</body></html>
    `);
    janela.document.close();
    janela.focus();
    setTimeout(() => { janela.print(); janela.close(); }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" /> Imprimir Pedido
          </DialogTitle>
        </DialogHeader>

        {/* Seletor de formato */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setFormato('cupom')}
            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              formato === 'cupom' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <Receipt className={`w-8 h-8 ${formato === 'cupom' ? 'text-indigo-500' : 'text-slate-400'}`} />
            <div className="text-center">
              <p className="font-semibold text-sm">Cupom Térmico</p>
              <p className="text-xs text-slate-400">80mm — impressora térmica</p>
            </div>
          </button>
          <button
            onClick={() => setFormato('a4')}
            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              formato === 'a4' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <FileText className={`w-8 h-8 ${formato === 'a4' ? 'text-indigo-500' : 'text-slate-400'}`} />
            <div className="text-center">
              <p className="font-semibold text-sm">Folha A4</p>
              <p className="text-xs text-slate-400">Impressora comum</p>
            </div>
          </button>
        </div>

        {/* Preview */}
        <div className="border rounded-xl overflow-auto max-h-72 bg-white p-3">
          <div ref={printRef} className="scale-[0.6] origin-top-left" style={{ width: formato === 'cupom' ? '80mm' : '210mm' }}>
            {formato === 'cupom'
              ? <CupomTemplate pedido={pedido} />
              : <A4Template pedido={pedido} />
            }
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Imprimir {formato === 'cupom' ? 'Cupom' : 'A4'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}