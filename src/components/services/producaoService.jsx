/**
 * SERVIÇO DE PRODUÇÃO
 * Centraliza as regras de ordens de produção:
 * - Iniciar / Cancelar / Concluir produção
 * - Baixa automática de insumos via ficha técnica (com bloqueio de negativo)
 * - Entrada do produto final no estoque com custo real calculado
 * - Registro de custo total da produção
 * - Multi-tenant: empresa_id e loja_id obrigatórios
 */

import { base44 } from '@/api/base44Client';
import { processarEntrada, processarSaida } from './estoqueService';

/**
 * Retorna mapa { produto_id -> custo_medio } do estoque de uma loja.
 */
export async function obterCustoAtualInsumos(loja_id, empresa_id) {
  const estoques = await base44.entities.Estoque.filter({ loja_id, empresa_id });
  const mapa = {};
  for (const e of estoques) {
    mapa[e.produto_id] = e.custo_medio || 0;
  }
  return mapa;
}

/**
 * Calcula o custo total e unitário de uma ficha técnica,
 * usando o custo médio atual dos insumos no estoque.
 * Retorna { custo_total, custo_unitario, ingredientes_com_custo }
 */
export async function calcularCustoFicha(fichaTecnicaId, loja_id, empresa_id) {
  const ficha = await base44.entities.FichaTecnica.filter({ id: fichaTecnicaId });
  if (!ficha || ficha.length === 0) throw new Error('Ficha técnica não encontrada');
  const f = ficha[0];

  const custosMap = await obterCustoAtualInsumos(loja_id, empresa_id);

  const ingredientes_com_custo = (f.ingredientes || []).map(ing => ({
    ...ing,
    custo_unitario: custosMap[ing.produto_id] || 0,
    custo_linha: (ing.quantidade || 0) * (custosMap[ing.produto_id] || 0),
  }));

  const custo_total = ingredientes_com_custo.reduce((s, i) => s + i.custo_linha, 0);
  const custo_unitario = f.rendimento > 0 ? custo_total / f.rendimento : 0;

  return { custo_total, custo_unitario, ingredientes_com_custo, ficha: f };
}

/**
 * Inicia uma ordem de produção: planejada → em_andamento
 */
export async function iniciarProducao(producao) {
  if (producao.status !== 'planejada') {
    throw new Error('[producaoService] Somente ordens "planejada" podem ser iniciadas');
  }
  return base44.entities.Producao.update(producao.id, {
    status: 'em_andamento',
    data_inicio: new Date().toISOString(),
  });
}

/**
 * Cancela uma ordem de produção (qualquer status exceto concluída).
 */
export async function cancelarProducao(producaoId) {
  return base44.entities.Producao.update(producaoId, { status: 'cancelada' });
}

/**
 * Conclui uma ordem de produção:
 *  1. Valida que está em_andamento
 *  2. Baixa insumos utilizados (processarSaida → bloqueia negativo)
 *  3. Calcula custo real total baseado nos insumos consumidos
 *  4. Registra entrada do produto final no estoque
 *  5. Atualiza a ordem com quantidade produzida, custo total e perda
 *
 * @param {Object} producao             - Objeto da ordem
 * @param {number} quantidadeProduzida  - Quantidade efetivamente produzida
 */
export async function concluirProducao(producao, quantidadeProduzida) {
  if (producao.status !== 'em_andamento') {
    throw new Error('[producaoService] Somente ordens "em_andamento" podem ser concluídas');
  }
  if (!quantidadeProduzida || quantidadeProduzida <= 0) {
    throw new Error('[producaoService] Quantidade produzida inválida');
  }

  const { empresa_id, loja_id } = producao;
  if (!empresa_id) throw new Error('[producaoService] empresa_id é obrigatório na ordem de produção');
  if (!loja_id) throw new Error('[producaoService] loja_id é obrigatório na ordem de produção');

  let custoTotal = 0;

  // 1. Baixar insumos utilizados
  if (producao.insumos_utilizados?.length > 0) {
    for (const insumo of producao.insumos_utilizados) {
      if (!insumo.produto_id || !insumo.quantidade_utilizada) continue;

      await processarSaida({
        empresa_id,
        loja_id,
        produto_id: insumo.produto_id,
        quantidade: insumo.quantidade_utilizada,
        custo_unitario: insumo.custo_unitario || 0,
        documento_tipo: 'producao',
        documento_id: producao.id,
        observacao: `Baixa de insumo - OP ${producao.numero || producao.id}`,
      });

      custoTotal += (insumo.quantidade_utilizada || 0) * (insumo.custo_unitario || 0);
    }
  }

  // 2. Custo unitário real do produto produzido
  const custoUnitario = quantidadeProduzida > 0 ? custoTotal / quantidadeProduzida : 0;

  // 3. Entrada do produto final no estoque
  if (producao.produto_id) {
    await processarEntrada({
      empresa_id,
      loja_id,
      produto_id: producao.produto_id,
      quantidade: quantidadeProduzida,
      custo_unitario: custoUnitario,
      documento_tipo: 'producao',
      documento_id: producao.id,
      observacao: `Entrada produção - OP ${producao.numero || producao.id}`,
    });
  }

  // 4. Calcular perda
  const perda = Math.max(0, (producao.quantidade_planejada || 0) - quantidadeProduzida);

  // 5. Atualizar ordem
  return base44.entities.Producao.update(producao.id, {
    status: 'concluida',
    quantidade_produzida: quantidadeProduzida,
    quantidade_perda: perda,
    data_fim: new Date().toISOString(),
    custo_total: custoTotal,
  });
}