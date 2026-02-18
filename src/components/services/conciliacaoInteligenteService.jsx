/**
 * Serviço de Conciliação Inteligente com IA
 * A IA apenas SUGERE — nunca executa sozinha.
 * Toda sugestão é registrada no Action Log (AcaoIA).
 */

import { base44 } from '@/api/base44Client';

/**
 * Analisa uma transação bancária e sugere a melhor conciliação.
 * @param {Object} transacao - TransacaoBancaria
 * @param {Array} contasReceber - lista de ContaReceber pendentes
 * @param {Array} contasPagar - lista de ContaPagar pendentes
 * @returns {Object} { tipo, id, score, explicacao, itemSugerido }
 */
export async function sugerirConciliacao(transacao, contasReceber, contasPagar) {
  const valor = transacao.valor;
  const descricao = transacao.descricao || transacao.memo || '';
  const dataTransacao = transacao.data;

  // Montar contexto resumido das contas abertas (max 30 itens para não estourar tokens)
  const resumoReceber = contasReceber.slice(0, 20).map(c => ({
    id: c.id,
    descricao: c.descricao,
    valor: c.valor_original,
    vencimento: c.data_vencimento,
    cliente: c.cliente_nome,
  }));

  const resumoPagar = contasPagar.slice(0, 20).map(c => ({
    id: c.id,
    descricao: c.descricao,
    valor: c.valor_original,
    vencimento: c.data_vencimento,
  }));

  const prompt = `Você é um sistema de conciliação bancária. Analise a transação bancária abaixo e sugira a melhor correspondência entre as contas abertas.

TRANSAÇÃO BANCÁRIA:
- Valor: ${valor} (positivo=crédito, negativo=débito)
- Data: ${dataTransacao}
- Descrição: ${descricao}

CONTAS A RECEBER ABERTAS (créditos esperados):
${JSON.stringify(resumoReceber)}

CONTAS A PAGAR ABERTAS (débitos esperados):
${JSON.stringify(resumoPagar)}

Regras:
- Se valor > 0, buscar match em contas_a_receber
- Se valor < 0, buscar match em contas_a_pagar
- Comparar valor, data próxima e palavras-chave da descrição
- Se nenhuma conta corresponder bem, retornar tipo "movimento_avulso"

Retorne JSON com:
- tipo: "conta_receber" | "conta_pagar" | "movimento_avulso"
- id: id da conta sugerida (ou null se movimento_avulso)
- score: número de 0 a 100 indicando confiança
- explicacao: frase curta em português explicando o motivo da sugestão`;

  const resposta = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string' },
        id: { type: 'string' },
        score: { type: 'number' },
        explicacao: { type: 'string' },
      }
    }
  });

  // Enriquecer com item encontrado
  let itemSugerido = null;
  if (resposta.tipo === 'conta_receber' && resposta.id) {
    itemSugerido = contasReceber.find(c => c.id === resposta.id);
  } else if (resposta.tipo === 'conta_pagar' && resposta.id) {
    itemSugerido = contasPagar.find(c => c.id === resposta.id);
  }

  // Registrar no Action Log
  await base44.entities.AcaoIA.create({
    tipo_acao: 'outro',
    descricao: `IA sugeriu conciliação para transação "${descricao}" (${valor > 0 ? '+' : ''}${valor})`,
    comando_original: `Conciliação automática: ${descricao}`,
    payload: {
      transacao_id: transacao.id,
      transacao_descricao: descricao,
      transacao_valor: valor,
      transacao_data: dataTransacao,
      sugestao_tipo: resposta.tipo,
      sugestao_id: resposta.id,
      sugestao_score: resposta.score,
    },
    requer_confirmacao: true,
    status: 'aguardando_confirmacao',
  });

  return { ...resposta, itemSugerido };
}