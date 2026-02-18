/**
 * SERVIÇO DE VENDAS
 * Centraliza as regras de importação e gestão de vendas:
 * - Importação em lote com criação automática de contas a receber
 * - Garante empresa_id e loja_id em todos os registros (multi-tenant)
 * - Rastreabilidade via AcaoIA
 */

import { base44 } from '@/api/base44Client';
import { criarContaReceberVenda } from './financeiroService';

/**
 * Importa array de vendas processadas pela IA.
 * Para cada venda: cria Venda + gera ContaReceber.
 *
 * @param {Array}  vendasData  - Array de objetos venda extraídos pelo LLM
 * @param {Object} tenant      - { empresa_id, loja_id }
 * @returns {Array} vendas criadas
 */
export async function importarVendas(vendasData, { empresa_id, loja_id }) {
  if (!empresa_id) throw new Error('[vendasService] empresa_id é obrigatório');
  if (!loja_id) throw new Error('[vendasService] loja_id é obrigatório');
  if (!vendasData || vendasData.length === 0) return [];

  const resultados = [];

  for (const v of vendasData) {
    const venda = await base44.entities.Venda.create({
      ...v,
      empresa_id,
      loja_id,
    });

    // Gerar conta a receber para cada venda com valor positivo
    await criarContaReceberVenda({ empresa_id, loja_id, venda });

    resultados.push(venda);
  }

  // Rastreabilidade: registrar ação executada pela IA
  await base44.entities.AcaoIA.create({
    empresa_id,
    tipo_acao: 'processar_vendas',
    descricao: `Importação de ${resultados.length} venda(s) via IA`,
    status: 'concluida',
    saida: { total_vendas: resultados.length },
  });

  return resultados;
}