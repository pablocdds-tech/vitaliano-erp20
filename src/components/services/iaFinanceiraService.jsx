/**
 * IA FINANCEIRA GERENCIAL
 * Apenas ANALISA e SUGERE — nunca altera dados.
 * Toda análise é auditada no AcaoIA (Action Log).
 */

import { base44 } from '@/api/base44Client';
import { format, addDays, subDays } from 'date-fns';

// ─── coleta de dados reais ────────────────────────────────────────────────────

async function coletarDadosFinanceiros() {
  const hoje = new Date();
  const inicioMes = format(new Date(hoje.getFullYear(), hoje.getMonth(), 1), 'yyyy-MM-dd');
  const fimMes    = format(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0), 'yyyy-MM-dd');
  const ini30     = format(subDays(hoje, 30), 'yyyy-MM-dd');
  const fim30     = format(addDays(hoje, 30), 'yyyy-MM-dd');

  const [lojas, contasPagar, contasReceber, vendas, bancoVirtual] = await Promise.all([
    base44.entities.Loja.list('nome', 50),
    base44.entities.ContaPagar.list('-data_vencimento', 200),
    base44.entities.ContaReceber.list('-data_vencimento', 200),
    base44.entities.Venda.filter({ data: { $gte: ini30 } }, '-data', 200).catch(() => []),
    base44.entities.BancoVirtual.list('-created_date', 100),
  ]);

  // Resumos para o LLM (sem enviar milhares de registros)
  const pagarPendentes = contasPagar.filter(c => c.status === 'pendente');
  const receberPendentes = contasReceber.filter(c => c.status === 'pendente');
  const pagarVencidos = pagarPendentes.filter(c => c.data_vencimento < format(hoje, 'yyyy-MM-dd'));
  const receberVencidos = receberPendentes.filter(c => c.data_vencimento < format(hoje, 'yyyy-MM-dd'));

  // Fluxo dos próximos 30 dias
  const entradas30 = receberPendentes
    .filter(c => c.data_vencimento >= format(hoje, 'yyyy-MM-dd') && c.data_vencimento <= fim30)
    .reduce((s, c) => s + (c.valor_original || 0), 0);
  const saidas30 = pagarPendentes
    .filter(c => c.data_vencimento >= format(hoje, 'yyyy-MM-dd') && c.data_vencimento <= fim30)
    .reduce((s, c) => s + (c.valor_original || 0), 0);

  // Vendas do mês
  const vendasMes = vendas.filter(v => v.data >= inicioMes && v.data <= fimMes);
  const receitaMes = vendasMes.reduce((s, v) => s + (v.valor_bruto || 0), 0);

  // Saldos banco virtual por loja
  const saldosVirtuales = lojas.map(l => ({
    loja: l.nome,
    tipo: l.tipo,
    saldo_virtual: l.saldo_banco_virtual || 0,
  }));

  // Vencimentos dia-a-dia próximos 30 dias (para previsão)
  const fluxoDiario = [];
  for (let d = 0; d < 30; d++) {
    const dia = format(addDays(hoje, d), 'yyyy-MM-dd');
    const ent = receberPendentes.filter(c => c.data_vencimento === dia).reduce((s, c) => s + (c.valor_original || 0), 0);
    const sai = pagarPendentes.filter(c => c.data_vencimento === dia).reduce((s, c) => s + (c.valor_original || 0), 0);
    fluxoDiario.push({ dia, entradas: ent, saidas: sai, liquido: ent - sai });
  }

  return {
    hoje: format(hoje, 'yyyy-MM-dd'),
    inicioMes, fimMes,
    saldosVirtuales,
    pagarTotal: pagarPendentes.reduce((s, c) => s + (c.valor_original || 0), 0),
    pagarVencidoTotal: pagarVencidos.reduce((s, c) => s + (c.valor_original || 0), 0),
    pagarVencidoCount: pagarVencidos.length,
    receberTotal: receberPendentes.reduce((s, c) => s + (c.valor_original || 0), 0),
    receberVencidoTotal: receberVencidos.reduce((s, c) => s + (c.valor_original || 0), 0),
    receberVencidoCount: receberVencidos.length,
    entradas30, saidas30,
    saldoPrevisto30: entradas30 - saidas30,
    receitaMes,
    qtdVendasMes: vendasMes.length,
    fluxoDiario,
  };
}

// ─── funções públicas ────────────────────────────────────────────────────────

/**
 * Gera diagnóstico financeiro completo do período atual.
 * Registra no Action Log e retorna resultado estruturado.
 */
export async function gerarDiagnosticoPeriodo() {
  const dados = await coletarDadosFinanceiros();
  const user = await base44.auth.me().catch(() => null);

  const prompt = `Você é um CFO especialista em gestão financeira de restaurantes e redes varejistas.
Analise os dados financeiros abaixo e gere um diagnóstico gerencial completo.

DADOS FINANCEIROS (${dados.hoje}):

Receita bruta do mês: R$ ${dados.receitaMes.toFixed(2)} (${dados.qtdVendasMes} vendas)

Contas a Pagar (pendentes):
- Total: R$ ${dados.pagarTotal.toFixed(2)}
- Vencidos: R$ ${dados.pagarVencidoTotal.toFixed(2)} (${dados.pagarVencidoCount} contas)

Contas a Receber (pendentes):
- Total: R$ ${dados.receberTotal.toFixed(2)}
- Vencidos: R$ ${dados.receberVencidoTotal.toFixed(2)} (${dados.receberVencidoCount} contas)

Próximos 30 dias:
- Entradas previstas: R$ ${dados.entradas30.toFixed(2)}
- Saídas previstas: R$ ${dados.saidas30.toFixed(2)}
- Saldo líquido previsto: R$ ${dados.saldoPrevisto30.toFixed(2)}

Banco Virtual (saldo por unidade):
${dados.saldosVirtuales.map(s => `- ${s.loja} (${s.tipo}): R$ ${s.saldo_virtual.toFixed(2)}`).join('\n')}

Fluxo diário próximos 30 dias (top 5 piores dias):
${[...dados.fluxoDiario].sort((a,b) => a.liquido - b.liquido).slice(0,5).map(d => `- ${d.dia}: líquido R$ ${d.liquido.toFixed(2)} (entradas R$ ${d.entradas.toFixed(2)}, saídas R$ ${d.saidas.toFixed(2)})`).join('\n')}

Gere o diagnóstico com:
1. resumo_executivo: texto de 3-5 linhas sobre a saúde financeira atual
2. alertas: lista de alertas críticos (máx 5), cada um com "titulo" e "detalhe"
3. riscos: lista de riscos identificados com "nivel" (alto/medio/baixo), "titulo" e "descricao"
4. sugestoes: lista de sugestões de ação com "prioridade" (1-5), "acao" e "impacto_esperado"
5. previsao_caixa: objeto com "tendencia" (positiva/negativa/neutra), "dias_ate_deficit" (null se não houver), "observacao"
6. score_saude: número de 0 a 100 representando a saúde financeira geral`;

  const resultado = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        resumo_executivo: { type: 'string' },
        alertas: {
          type: 'array',
          items: { type: 'object', properties: { titulo: { type: 'string' }, detalhe: { type: 'string' } } }
        },
        riscos: {
          type: 'array',
          items: { type: 'object', properties: { nivel: { type: 'string' }, titulo: { type: 'string' }, descricao: { type: 'string' } } }
        },
        sugestoes: {
          type: 'array',
          items: { type: 'object', properties: { prioridade: { type: 'number' }, acao: { type: 'string' }, impacto_esperado: { type: 'string' } } }
        },
        previsao_caixa: {
          type: 'object',
          properties: {
            tendencia: { type: 'string' },
            dias_ate_deficit: { type: 'number' },
            observacao: { type: 'string' }
          }
        },
        score_saude: { type: 'number' }
      }
    }
  });

  // Audit log
  await base44.entities.AcaoIA.create({
    tipo_acao: 'gerar_relatorio',
    descricao: `IA Financeira: Diagnóstico do período ${dados.inicioMes} a ${dados.fimMes}`,
    comando_original: 'IA_ANALISE_FINANCEIRA',
    payload: dados,
    saida: resultado,
    solicitado_por: user?.email || 'sistema',
    requer_confirmacao: false,
    status: 'concluida',
    executado_em: new Date().toISOString(),
    aprovado_por: user?.email || 'sistema',
  });

  return { ...resultado, _dados: dados };
}

/**
 * Projeção de fluxo de caixa dia a dia (30 dias).
 * Retorna análise textual + array de dias com saldo acumulado.
 */
export async function preverFluxoCaixa() {
  const dados = await coletarDadosFinanceiros();
  const user = await base44.auth.me().catch(() => null);

  // Saldo inicial = total a receber - total a pagar pendentes vencidos + banco virtual líquido
  const saldoBancoVirtual = dados.saldosVirtuales.reduce((s, l) => s + l.saldo_virtual, 0);

  // Calcular saldo acumulado dia a dia
  let saldoAcumulado = saldoBancoVirtual;
  const projecaoDiaria = dados.fluxoDiario.map(d => {
    saldoAcumulado += d.liquido;
    return { ...d, saldo_acumulado: saldoAcumulado };
  });

  const primeiroDeficit = projecaoDiaria.find(d => d.saldo_acumulado < 0);

  const prompt = `Você é especialista em fluxo de caixa para restaurantes.
Analise a projeção abaixo e gere uma análise clara e acionável.

Saldo atual banco virtual: R$ ${saldoBancoVirtual.toFixed(2)}
Primeiro dia de déficit: ${primeiroDeficit ? primeiroDeficit.dia + ' (R$ ' + primeiroDeficit.saldo_acumulado.toFixed(2) + ')' : 'Não identificado nos próximos 30 dias'}

Projeção resumida (5 piores dias):
${projecaoDiaria.filter(d => d.saldo_acumulado < 0 || d.saidas > d.entradas * 1.5).slice(0, 5).map(d => `${d.dia}: entradas R$${d.entradas.toFixed(0)}, saídas R$${d.saidas.toFixed(0)}, saldo acum. R$${d.saldo_acumulado.toFixed(0)}`).join('\n') || 'Sem dias críticos identificados'}

Total entradas previstas 30 dias: R$ ${dados.entradas30.toFixed(2)}
Total saídas previstas 30 dias: R$ ${dados.saidas30.toFixed(2)}

Retorne:
- analise: texto de 4-6 linhas em linguagem de gestão clara
- alerta_critico: string com alerta principal (null se não houver)
- acoes_recomendadas: lista de até 4 ações concretas (strings)
- tendencia: "superavit" | "equilibrio" | "deficit_leve" | "deficit_critico"`;

  const resultado = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        analise: { type: 'string' },
        alerta_critico: { type: 'string' },
        acoes_recomendadas: { type: 'array', items: { type: 'string' } },
        tendencia: { type: 'string' }
      }
    }
  });

  // Audit log
  await base44.entities.AcaoIA.create({
    tipo_acao: 'gerar_relatorio',
    descricao: `IA Financeira: Previsão de fluxo de caixa 30 dias a partir de ${dados.hoje}`,
    comando_original: 'IA_ANALISE_FINANCEIRA',
    payload: { saldoBancoVirtual, entradas30: dados.entradas30, saidas30: dados.saidas30, primeiroDeficit },
    saida: resultado,
    solicitado_por: user?.email || 'sistema',
    requer_confirmacao: false,
    status: 'concluida',
    executado_em: new Date().toISOString(),
    aprovado_por: user?.email || 'sistema',
  });

  return { ...resultado, projecaoDiaria, _dados: dados };
}