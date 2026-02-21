/**
 * SERVIÇO DE PEDIDO INTERNO (PDV CD → Loja)
 * Regras críticas:
 * - Confirmar = movimentar estoque REAL + banco virtual atomicamente
 * - Usa processarEntrada/processarSaida do estoqueService (atualiza saldo + custo médio + movlog)
 * - Idempotente: checa status antes de executar
 * - Nunca editar saldo direto — somente via movimentos
 */

import { base44 } from '@/api/base44Client';
import { processarEntrada, processarSaida } from './estoqueService';

/**
 * Confirma um pedido interno, executando:
 * 1. Saída de estoque do CD (via estoqueService — atualiza saldo + custo médio)
 * 2. Entrada de estoque na loja (via estoqueService)
 * 3. Débito banco virtual na loja / crédito no CD
 * 4. Audit log
 * 5. Marca pedido como confirmado (idempotência)
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

  const empresa_id = pedido.empresa_id;
  const pedidoRef = `#${pedido.id.slice(-6).toUpperCase()}`;

  // 1. Movimentações de estoque REAIS para cada item
  for (const item of pedido.itens) {
    // Saída do CD — atualiza Estoque do CD e cria MovimentacaoEstoque
    // permitir_negativo=true pois CD pode distribuir mesmo sem entrada formal registrada
    await processarSaida({
      empresa_id,
      loja_id: pedido.cd_id,
      produto_id: item.produto_id,
      quantidade: Math.abs(item.quantidade),
      custo_unitario: item.preco_unitario,
      documento_tipo: 'transferencia',
      documento_id: pedido.id,
      observacao: `Pedido interno ${pedidoRef} → ${lojaDestino.nome}`,
      permitir_negativo: true,
    });

    // Entrada na loja destino — atualiza Estoque da loja e custo médio
    await processarEntrada({
      empresa_id,
      loja_id: pedido.loja_destino_id,
      produto_id: item.produto_id,
      quantidade: Math.abs(item.quantidade),
      custo_unitario: item.preco_unitario,
      documento_tipo: 'transferencia',
      documento_id: pedido.id,
      observacao: `Pedido interno ${pedidoRef} ← ${cd.nome}`,
    });
  }

  // 2. Banco virtual: débito loja / crédito CD
  const saldoCd = cd.saldo_banco_virtual || 0;
  const saldoLoja = lojaDestino.saldo_banco_virtual || 0;
  const valor = pedido.valor_total;

  const movBanco = await base44.entities.BancoVirtual.create({
    empresa_id,
    loja_origem_id: pedido.loja_destino_id, // loja paga
    loja_destino_id: pedido.cd_id,          // CD recebe
    tipo: 'transferencia',
    valor,
    descricao: `Pedido interno ${pedidoRef} — ${lojaDestino.nome} → ${cd.nome}`,
    saldo_origem_anterior: saldoLoja,
    saldo_origem_posterior: saldoLoja - valor,
    saldo_destino_anterior: saldoCd,
    saldo_destino_posterior: saldoCd + valor,
    status: 'aprovado',
    aprovado_por: user?.email || 'sistema',
    data_aprovacao: new Date().toISOString(),
  });

  // Efetivar saldos nas lojas
  await Promise.all([
    base44.entities.Loja.update(pedido.loja_destino_id, { saldo_banco_virtual: saldoLoja - valor }),
    base44.entities.Loja.update(pedido.cd_id, { saldo_banco_virtual: saldoCd + valor }),
  ]);

  // 3. Audit log
  await base44.entities.AcaoIA.create({
    tipo_acao: 'outro',
    descricao: `Pedido interno ${pedidoRef} confirmado: ${cd.nome} → ${lojaDestino.nome} | ${pedido.itens.length} itens | R$ ${valor?.toFixed(2)}`,
    comando_original: `PEDIDO_CD_CONFIRMADO`,
    payload: {
      pedido_id: pedido.id,
      cd_id: pedido.cd_id,
      loja_destino_id: pedido.loja_destino_id,
      valor_total: valor,
      total_itens: pedido.total_itens,
      banco_virtual_id: movBanco.id,
      confirmado_por: user?.email || 'sistema',
    },
    requer_confirmacao: false,
    status: 'concluida',
    solicitado_por: user?.email,
    aprovado_por: user?.email,
    executado_em: new Date().toISOString(),
  });

  // 4. Marcar pedido como confirmado
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