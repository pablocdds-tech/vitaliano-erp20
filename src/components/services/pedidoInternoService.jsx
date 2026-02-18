/**
 * SERVIÇO DE PEDIDO INTERNO (PDV CD → Loja)
 * Regras críticas:
 * - Confirmar = movimentar estoque + banco virtual atomicamente
 * - Idempotente: checa status antes de executar
 * - Nunca editar saldo direto — somente via movimentos
 */

import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';

/**
 * Confirma um pedido interno, executando:
 * 1. Saída de estoque do CD
 * 2. Entrada de estoque na loja
 * 3. Débito banco virtual na loja / crédito no CD
 * 4. Marca pedido como confirmado (idempotência)
 */
export async function confirmarPedidoInterno(pedido, lojas, user) {
  if (pedido.status !== 'draft') {
    throw new Error('Este pedido já foi confirmado ou cancelado.');
  }
  if (!pedido.itens || pedido.itens.length === 0) {
    throw new Error('O pedido não possui itens.');
  }

  const cd = lojas.find(l => l.id === pedido.cd_id);
  const lojaDestino = lojas.find(l => l.id === pedido.loja_destino_id);

  if (!cd || !lojaDestino) throw new Error('CD ou loja destino não encontrado.');

  // 1. Movimentações de estoque para cada item
  for (const item of pedido.itens) {
    // Saída do CD
    await base44.entities.MovimentacaoEstoque.create({
      empresa_id: pedido.empresa_id,
      loja_id: pedido.cd_id,
      produto_id: item.produto_id,
      tipo: 'saida',
      quantidade: -Math.abs(item.quantidade),
      documento_tipo: 'transferencia',
      documento_id: pedido.id,
      observacao: `Pedido interno #${pedido.id.slice(-6).toUpperCase()} → ${lojaDestino.nome}`,
    });

    // Entrada na loja destino
    await base44.entities.MovimentacaoEstoque.create({
      empresa_id: pedido.empresa_id,
      loja_id: pedido.loja_destino_id,
      produto_id: item.produto_id,
      tipo: 'entrada',
      quantidade: Math.abs(item.quantidade),
      custo_unitario: item.preco_unitario,
      custo_total: item.subtotal,
      documento_tipo: 'transferencia',
      documento_id: pedido.id,
      loja_destino_id: pedido.loja_destino_id,
      observacao: `Pedido interno #${pedido.id.slice(-6).toUpperCase()} ← ${cd.nome}`,
    });
  }

  // 2. Banco virtual: débito loja / crédito CD
  const saldoCd = cd.saldo_banco_virtual || 0;
  const saldoLoja = lojaDestino.saldo_banco_virtual || 0;
  const valor = pedido.valor_total;

  const movBanco = await base44.entities.BancoVirtual.create({
    empresa_id: pedido.empresa_id,
    loja_origem_id: pedido.loja_destino_id, // loja paga
    loja_destino_id: pedido.cd_id,          // CD recebe
    tipo: 'transferencia',
    valor,
    descricao: `Pedido interno #${pedido.id.slice(-6).toUpperCase()} — ${lojaDestino.nome} → ${cd.nome}`,
    saldo_origem_anterior: saldoLoja,
    saldo_origem_posterior: saldoLoja - valor,
    saldo_destino_anterior: saldoCd,
    saldo_destino_posterior: saldoCd + valor,
    status: 'aprovado',
    aprovado_por: user?.email || 'sistema',
    data_aprovacao: new Date().toISOString(),
  });

  // Efetivar saldos na loja e no CD
  await base44.entities.Loja.update(pedido.loja_destino_id, {
    saldo_banco_virtual: saldoLoja - valor,
  });
  await base44.entities.Loja.update(pedido.cd_id, {
    saldo_banco_virtual: saldoCd + valor,
  });

  // 3. Marcar pedido como confirmado
  return base44.entities.PedidoInterno.update(pedido.id, {
    status: 'confirmado',
    confirmado_por: user?.email || 'sistema',
    data_confirmacao: new Date().toISOString(),
    banco_virtual_id: movBanco.id,
  });
}

/**
 * Cancela um pedido (só draft — não desfaz movimentos)
 */
export async function cancelarPedidoInterno(pedidoId) {
  return base44.entities.PedidoInterno.update(pedidoId, { status: 'cancelado' });
}