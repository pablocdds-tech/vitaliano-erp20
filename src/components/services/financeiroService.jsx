/**
 * SERVIÇO FINANCEIRO
 * Centraliza regras de negócio financeiras:
 * - Contas a pagar geradas via NF (com suporte a parcelas)
 * - Contas a receber geradas via importação de vendas
 * - Banco Virtual: criação de operações pendentes + aprovação com validação de saldo
 * - Multi-tenant: empresa_id obrigatório em todas as operações
 */

import { base44 } from '@/api/base44Client';

/**
 * Cria conta(s) a pagar a partir do lançamento de uma Nota Fiscal.
 * Suporta fluxo CD (estoque) e Compra Direta Loja (financeiro-only).
 *
 * Para Compra Direta Loja:
 *   - loja_id na CP = loja_responsavel_id (a loja que vai pagar)
 *   - credor_nome = faturado_para_nome || loja faturada
 *   - categoria_dre_id propagada para classificação DRE/CMV
 */
export async function criarContasPagarNF({ empresa_id, loja_id, fornecedor_id, nota }) {
  if (!empresa_id) throw new Error('[financeiroService] empresa_id é obrigatório');
  if (!nota.valor_total || nota.valor_total <= 0) return;

  const numParcelas = nota.num_parcelas || 1;
  const primeiroVenc = nota.primeiro_vencimento || nota.data_entrada || nota.data_emissao;
  const baseDesc = `NF ${nota.numero || 'S/N'}/${nota.serie || '1'}`;

  // Para compra direta loja, a loja_id da CP é a responsável (quem paga)
  const lojaIdConta = nota.tipo_lancamento === 'compra_direta_loja'
    ? (nota.loja_responsavel_id || loja_id)
    : loja_id;

  const extraFields = {
    categoria_dre_id: nota.categoria_dre_id || null,
    credor_nome: nota.faturado_para_nome || null,
    tipo_lancamento_nf: nota.tipo_lancamento || 'compra_cd',
  };

  const formaBase = nota.forma_pagamento || 'boleto';

  const criarUmaConta = async ({ descricao, data_vencimento, valor_original, parcela_atual, total_parcelas }) => {
    await base44.entities.ContaPagar.create({
      empresa_id,
      loja_id: lojaIdConta,
      fornecedor_id: fornecedor_id || null,
      descricao,
      documento_tipo: nota.documento_tipo || 'nota_fiscal',
      documento_numero: nota.numero,
      documento_id: nota.id,
      data_emissao: nota.data_emissao,
      data_vencimento,
      valor_original,
      forma_pagamento: formaBase,
      status: 'pendente',
      parcela_atual: parcela_atual ?? 1,
      total_parcelas: total_parcelas ?? 1,
      ...extraFields,
    });
  };

  if (numParcelas > 1 && primeiroVenc) {
    const vlrParcela = parseFloat((nota.valor_total / numParcelas).toFixed(2));
    const diff = parseFloat((nota.valor_total - vlrParcela * numParcelas).toFixed(2));
    for (let i = 0; i < numParcelas; i++) {
      const vencDate = new Date(primeiroVenc + 'T12:00:00');
      vencDate.setMonth(vencDate.getMonth() + i);
      await criarUmaConta({
        descricao: `${baseDesc} - Parcela ${i + 1}/${numParcelas}`,
        data_vencimento: vencDate.toISOString().slice(0, 10),
        valor_original: i === numParcelas - 1 ? vlrParcela + diff : vlrParcela,
        parcela_atual: i + 1,
        total_parcelas: numParcelas,
      });
    }
  } else if (nota.parcelas?.length > 0) {
    for (const p of nota.parcelas) {
      await criarUmaConta({
        descricao: `${baseDesc} - Parcela ${p.numero}/${nota.parcelas.length}`,
        data_vencimento: p.vencimento,
        valor_original: p.valor,
        parcela_atual: p.numero,
        total_parcelas: nota.parcelas.length,
      });
    }
  } else {
    await criarUmaConta({
      descricao: baseDesc,
      data_vencimento: primeiroVenc,
      valor_original: nota.valor_total,
      parcela_atual: 1,
      total_parcelas: 1,
    });
  }
}

/**
 * Cria conta a receber para uma venda importada.
 */
export async function criarContaReceberVenda({ empresa_id, loja_id, venda }) {
  if (!empresa_id) throw new Error('[financeiroService] empresa_id é obrigatório');
  if (!venda.valor_liquido || venda.valor_liquido <= 0) return null;

  return base44.entities.ContaReceber.create({
    empresa_id,
    loja_id,
    descricao: `Venda ${venda.canal || 'balcão'} - ${venda.data}`,
    origem: 'venda',
    data_emissao: venda.data,
    data_vencimento: venda.data,
    valor_original: venda.valor_liquido,
    status: 'pendente',
  });
}

/**
 * Cria operação no Banco Virtual com status PENDENTE.
 * Registra saldos antes/depois para auditoria.
 * REGRA: Valida saldo disponível na origem antes de criar.
 */
export async function criarOperacaoBancoVirtual({
  empresa_id,
  loja_origem_id,
  loja_destino_id,
  tipo,
  valor,
  descricao,
  lojas,
}) {
  if (!empresa_id) throw new Error('[financeiroService] empresa_id é obrigatório');
  if (!valor || valor <= 0) throw new Error('[financeiroService] Valor inválido para operação bancária');

  const lojaOrigem = lojas.find(l => l.id === loja_origem_id);
  const lojaDestino = lojas.find(l => l.id === loja_destino_id);

  // ✅ REGRA: Validar saldo de origem antes de criar a operação
  if (loja_origem_id && lojaOrigem) {
    const saldoAtual = lojaOrigem.saldo_banco_virtual || 0;
    if (saldoAtual < valor) {
      throw new Error(
        `[financeiroService] Saldo insuficiente em "${lojaOrigem.nome}". ` +
        `Disponível: R$ ${saldoAtual.toFixed(2)}, Necessário: R$ ${valor.toFixed(2)}`
      );
    }
  }

  const saldoOrigemAnterior = lojaOrigem?.saldo_banco_virtual || 0;
  const saldoDestinoAnterior = lojaDestino?.saldo_banco_virtual || 0;

  return base44.entities.BancoVirtual.create({
    empresa_id,
    loja_origem_id: loja_origem_id || null,
    loja_destino_id: loja_destino_id || null,
    tipo,
    valor,
    descricao,
    saldo_origem_anterior: saldoOrigemAnterior,
    saldo_origem_posterior: loja_origem_id ? saldoOrigemAnterior - valor : null,
    saldo_destino_anterior: saldoDestinoAnterior,
    saldo_destino_posterior: loja_destino_id ? saldoDestinoAnterior + valor : null,
    status: 'pendente',
  });
}

/**
 * APROVA uma operação do Banco Virtual.
 * Efetiva débito na origem e crédito no destino.
 * REGRA: Idempotente — só aprova status "pendente".
 */
export async function aprovarOperacaoBancoVirtual(movimentacao, lojas, aprovadoPor = 'sistema') {
  if (movimentacao.status !== 'pendente') {
    throw new Error('[financeiroService] Somente operações pendentes podem ser aprovadas');
  }

  if (movimentacao.loja_origem_id) {
    const lojaOrigem = lojas.find(l => l.id === movimentacao.loja_origem_id);
    if (lojaOrigem) {
      await base44.entities.Loja.update(movimentacao.loja_origem_id, {
        saldo_banco_virtual: (lojaOrigem.saldo_banco_virtual || 0) - movimentacao.valor,
      });
    }
  }

  if (movimentacao.loja_destino_id) {
    const lojaDestino = lojas.find(l => l.id === movimentacao.loja_destino_id);
    if (lojaDestino) {
      await base44.entities.Loja.update(movimentacao.loja_destino_id, {
        saldo_banco_virtual: (lojaDestino.saldo_banco_virtual || 0) + movimentacao.valor,
      });
    }
  }

  return base44.entities.BancoVirtual.update(movimentacao.id, {
    status: 'aprovado',
    aprovado_por: aprovadoPor,
    data_aprovacao: new Date().toISOString(),
  });
}

/**
 * Rejeita uma operação pendente (sem alterar saldos).
 */
export async function rejeitarOperacaoBancoVirtual(movimentacaoId) {
  return base44.entities.BancoVirtual.update(movimentacaoId, { status: 'rejeitado' });
}