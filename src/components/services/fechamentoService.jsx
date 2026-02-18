import { addDays, addBusinessDays, nextDay, format, parseISO } from 'date-fns';

/**
 * Calcula a data prevista de recebimento com base na regra da forma de pagamento.
 * @param {string} dataFechamento - Data do fechamento no formato 'YYYY-MM-DD'
 * @param {string} regra - Regra de recebimento (D0, D1, D1_util, semanal, D2, D15, D30)
 * @param {number} diaSemana - Dia da semana para regra semanal (0=Dom...6=Sab)
 */
export function calcularDataRecebimento(dataFechamento, regra, diaSemana = 3) {
  const base = parseISO(dataFechamento);

  switch (regra) {
    case 'D0':
      return format(base, 'yyyy-MM-dd');
    case 'D1':
      return format(addDays(base, 1), 'yyyy-MM-dd');
    case 'D1_util':
      return format(addBusinessDays(base, 1), 'yyyy-MM-dd');
    case 'D2':
      return format(addDays(base, 2), 'yyyy-MM-dd');
    case 'D15':
      return format(addDays(base, 15), 'yyyy-MM-dd');
    case 'D30':
      return format(addDays(base, 30), 'yyyy-MM-dd');
    case 'semanal': {
      // Próxima ocorrência do dia da semana configurado após a data base
      const target = diaSemana;
      let d = addDays(base, 1);
      while (d.getDay() !== target) {
        d = addDays(d, 1);
      }
      return format(d, 'yyyy-MM-dd');
    }
    default:
      return format(addDays(base, 1), 'yyyy-MM-dd');
  }
}

/**
 * Calcula os valores de uma linha de fechamento.
 */
export function calcularLinha(valorBruto, taxaPercentual) {
  const taxa = taxaPercentual || 0;
  const valorTaxa = valorBruto * (taxa / 100);
  const valorLiquido = valorBruto - valorTaxa;
  return { valorTaxa, valorLiquido };
}

/**
 * Cria linhas de ContaReceber a partir das linhas do fechamento e salva via SDK.
 */
export async function gerarContasReceberFechamento(base44, fechamentoId, loja_id, dataFechamento, linhas) {
  const criadas = [];
  for (const linha of linhas) {
    if (!linha.valor_bruto || linha.valor_bruto <= 0) continue;
    const cr = await base44.entities.ContaReceber.create({
      loja_id,
      descricao: `Fechamento ${dataFechamento} — ${linha.forma_pagamento_nome}`,
      origem: 'venda',
      fechamento_id: fechamentoId,
      forma_pagamento_id: linha.forma_pagamento_id,
      cliente_nome: linha.forma_pagamento_nome,
      data_emissao: dataFechamento,
      data_vencimento: linha.data_prevista_recebimento,
      valor_original: linha.valor_liquido,
      valor_bruto: linha.valor_bruto,
      valor_taxa: linha.valor_taxa,
      status: 'pendente'
    });
    criadas.push(cr);
  }
  return criadas;
}