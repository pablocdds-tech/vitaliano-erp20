/**
 * SERVIÇO DE ESTOQUE
 * Centraliza todas as regras de negócio relacionadas a estoque:
 * - Entradas e saídas com movimentações auditáveis
 * - Atualização de custo médio ponderado (FIFO/CMP)
 * - Bloqueio de estoque negativo por regra de negócio
 * - Multi-tenant: empresa_id obrigatório em todas as operações
 */

import { base44 } from '@/api/base44Client';

/**
 * Obtém registro de estoque existente ou cria registro zerado.
 */
async function obterOuCriarEstoque(empresa_id, loja_id, produto_id) {
  const existentes = await base44.entities.Estoque.filter({ loja_id, produto_id });
  if (existentes.length > 0) return existentes[0];
  return base44.entities.Estoque.create({
    empresa_id,
    loja_id,
    produto_id,
    quantidade: 0,
    quantidade_reservada: 0,
    custo_medio: 0,
  });
}

/**
 * Calcula novo custo médio ponderado.
 * CMP = (Qtd_atual × Custo_atual + Qtd_entrada × Custo_entrada) / (Qtd_atual + Qtd_entrada)
 */
function calcularCMP(qtdAtual, custoAtual, qtdEntrada, custoEntrada) {
  const totalQtd = qtdAtual + qtdEntrada;
  if (totalQtd <= 0) return custoEntrada || 0;
  return ((qtdAtual * custoAtual) + (qtdEntrada * custoEntrada)) / totalQtd;
}

/**
 * Processa ENTRADA de estoque.
 * Atualiza saldo + custo médio ponderado + cria movimentação auditável.
 *
 * Usado por: Lançamento de NF, Conclusão de Produção, Ajuste positivo.
 */
export async function processarEntrada({
  empresa_id,
  loja_id,
  produto_id,
  quantidade,
  custo_unitario = 0,
  documento_tipo = 'ajuste_manual',
  documento_id = null,
  observacao = '',
}) {
  if (!empresa_id) throw new Error('[estoqueService] empresa_id é obrigatório');
  if (!loja_id) throw new Error('[estoqueService] loja_id é obrigatório');
  if (!produto_id) throw new Error('[estoqueService] produto_id é obrigatório');
  if (!quantidade || quantidade <= 0)
    throw new Error(`[estoqueService] Quantidade inválida: ${quantidade}`);

  const estoque = await obterOuCriarEstoque(empresa_id, loja_id, produto_id);
  const qtdAnterior = estoque.quantidade || 0;
  const qtdNova = qtdAnterior + quantidade;
  const custoMedioNovo = calcularCMP(qtdAnterior, estoque.custo_medio || 0, quantidade, custo_unitario);

  await base44.entities.Estoque.update(estoque.id, {
    quantidade: qtdNova,
    custo_medio: custoMedioNovo,
    ultima_entrada: new Date().toISOString(),
  });

  await base44.entities.MovimentacaoEstoque.create({
    empresa_id,
    loja_id,
    produto_id,
    tipo: 'entrada',
    quantidade,
    quantidade_anterior: qtdAnterior,
    quantidade_posterior: qtdNova,
    custo_unitario,
    custo_total: quantidade * custo_unitario,
    documento_tipo,
    documento_id,
    observacao,
  });

  return { qtdAnterior, qtdNova, custoMedioNovo };
}

/**
 * Processa SAÍDA de estoque.
 * REGRA DE NEGÓCIO: bloqueia estoque negativo — lança erro se saldo insuficiente.
 *
 * Usado por: Produção (baixa de insumos), Ajuste negativo, Transferência saída.
 */
export async function processarSaida({
  empresa_id,
  loja_id,
  produto_id,
  quantidade,
  custo_unitario,
  documento_tipo = 'ajuste_manual',
  documento_id = null,
  observacao = '',
  permitir_negativo = false,
}) {
  if (!empresa_id) throw new Error('[estoqueService] empresa_id é obrigatório');
  if (!loja_id) throw new Error('[estoqueService] loja_id é obrigatório');
  if (!produto_id) throw new Error('[estoqueService] produto_id é obrigatório');
  if (!quantidade || quantidade <= 0)
    throw new Error(`[estoqueService] Quantidade inválida: ${quantidade}`);

  const estoque = await obterOuCriarEstoque(empresa_id, loja_id, produto_id);
  const qtdAtual = estoque.quantidade || 0;

  // Bloquear estoque negativo (exceto transferências CD→Loja onde o CD pode não ter entrada formal)
  if (!permitir_negativo && qtdAtual < quantidade) {
    throw new Error(
      `[estoqueService] Estoque insuficiente. Disponível: ${qtdAtual}, Solicitado: ${quantidade}`
    );
  }

  const qtdNova = qtdAtual - quantidade;
  const custoUnit = custo_unitario ?? estoque.custo_medio ?? 0;

  await base44.entities.Estoque.update(estoque.id, {
    quantidade: qtdNova,
    ultima_saida: new Date().toISOString(),
  });

  await base44.entities.MovimentacaoEstoque.create({
    empresa_id,
    loja_id,
    produto_id,
    tipo: 'saida',
    quantidade: -quantidade,
    quantidade_anterior: qtdAtual,
    quantidade_posterior: qtdNova,
    custo_unitario: custoUnit,
    custo_total: quantidade * custoUnit,
    documento_tipo,
    documento_id,
    observacao,
  });

  return { qtdAnterior: qtdAtual, qtdNova };
}