import { base44 } from '@/api/base44Client';
import { formatMoney } from '@/components/ui-custom/MoneyDisplay';

/**
 * Motor de eventos financeiros - monitora dados em tempo real
 * Gera alertas inteligentes sem automação
 */

export const eventosFinanceirosService = {
  /**
   * Detecta contas a pagar vencidas ou vencendo
   */
  async detectarContasVencidas(empresa_id, loja_id) {
    const contasPagar = await base44.entities.ContaPagar.filter({
      status: 'pendente'
    }, 'data_vencimento', 100);

    const hoje = new Date();
    const alertas = [];

    for (const conta of contasPagar) {
      const dataVenc = new Date(conta.data_vencimento);
      const diasAte = Math.ceil((dataVenc - hoje) / (1000 * 60 * 60 * 24));

      if (diasAte < 0) {
        // Vencida
        alertas.push({
          tipo_alerta: 'conta_vencida',
          gravidade: 'alta',
          titulo: `Conta vencida: ${conta.descricao}`,
          descricao: `${conta.descricao} está vencida há ${Math.abs(diasAte)} dias. Valor: ${formatMoney(conta.valor_original)}. Regularize imediatamente.`,
          sugestao_ia: `Priorize o pagamento de ${conta.descricao} para evitar multas e juros.`,
          entidade_tipo: 'ContaPagar',
          entidade_id: conta.id,
          dados_referencia: {
            valor: conta.valor_original,
            vencimento: conta.data_vencimento,
            dias_vencida: Math.abs(diasAte)
          }
        });
      } else if (diasAte > 0 && diasAte <= 3) {
        // Vencendo em breve
        alertas.push({
          tipo_alerta: 'conta_vencendo',
          gravidade: 'media',
          titulo: `Conta vencendo: ${conta.descricao}`,
          descricao: `${conta.descricao} vence em ${diasAte} dias. Valor: ${formatMoney(conta.valor_original)}. Prepare o pagamento.`,
          sugestao_ia: `Agende o pagamento de ${conta.descricao} para ${conta.data_vencimento}.`,
          entidade_tipo: 'ContaPagar',
          entidade_id: conta.id,
          dados_referencia: {
            valor: conta.valor_original,
            vencimento: conta.data_vencimento,
            dias_ate: diasAte
          }
        });
      }
    }

    return alertas;
  },

  /**
   * Detecta saldo projetado negativo
   */
  async detectarSaldoNegativo(empresa_id, loja_id) {
    const contasReceber = await base44.entities.ContaReceber.filter(
      { status: 'pendente' },
      'data_vencimento',
      100
    );
    const contasPagar = await base44.entities.ContaPagar.filter(
      { status: 'pendente' },
      'data_vencimento',
      100
    );

    const totalReceber = contasReceber.reduce((s, c) => s + (c.valor_original || 0), 0);
    const totalPagar = contasPagar.reduce((s, c) => s + (c.valor_original || 0), 0);
    const saldoProjetado = totalReceber - totalPagar;

    const alertas = [];

    if (saldoProjetado < 0) {
      alertas.push({
        tipo_alerta: 'saldo_negativo',
        gravidade: 'critica',
        titulo: 'Saldo projetado negativo',
        descricao: `O fluxo de caixa projetado é negativo em ${formatMoney(Math.abs(saldoProjetado))}. Há risco de insuficiência de recursos.`,
        sugestao_ia: `Accelere recebimentos pendentes ou negocie prazos de pagamento para evitar crise de fluxo.`,
        dados_referencia: {
          saldo_projetado: saldoProjetado,
          total_receber: totalReceber,
          total_pagar: totalPagar
        }
      });
    }

    return alertas;
  },

  /**
   * Detecta CMV anormalmente alto
   */
  async detectarCMVAlto(empresa_id) {
    const vendas = await base44.entities.Venda.list('-data', 30);
    
    if (vendas.length === 0) return [];

    const totalVendas = vendas.reduce((s, v) => s + (v.valor_bruto || 0), 0);
    const totalDesconto = vendas.reduce((s, v) => s + (v.valor_desconto || 0), 0);
    const taxaDesconto = totalDesconto / totalVendas;

    const alertas = [];

    if (taxaDesconto > 0.15) {
      // Mais de 15% em descontos
      alertas.push({
        tipo_alerta: 'despesa_anormal',
        gravidade: 'media',
        titulo: 'Desconto de vendas acima do normal',
        descricao: `Descontos representam ${(taxaDesconto * 100).toFixed(1)}% do faturamento (limite recomendado: 10%). Revise política de descontos.`,
        sugestao_ia: `Analise se descontos são competitivos ou se há desperdício. Considere estratégia de precificação.`,
        dados_referencia: {
          taxa_desconto: taxaDesconto,
          total_desconto: totalDesconto,
          total_vendas: totalVendas
        }
      });
    }

    return alertas;
  },

  /**
   * Detecta banco virtual com saldo muito negativo
   */
  async detectarBancoVirtualNegativo(empresa_id) {
    const bancoVirtual = await base44.entities.BancoVirtual.filter(
      { empresa_id },
      '-created_date',
      1000
    );

    const saldoAtual = bancoVirtual.reduce((s, mov) => {
      if (mov.tipo === 'credito') return s + (mov.valor || 0);
      if (mov.tipo === 'debito') return s - (mov.valor || 0);
      return s;
    }, 0);

    const alertas = [];

    if (saldoAtual < -10000) {
      // Significativamente negativo
      alertas.push({
        tipo_alerta: 'banco_virtual_negativo',
        gravidade: 'alta',
        titulo: 'Banco virtual com saldo crítico negativo',
        descricao: `Saldo do banco virtual: ${formatMoney(saldoAtual)}. Há excesso de empréstimos internos entre unidades.`,
        sugestao_ia: `Negocie liquidação de débitos entre CD e lojas, ou revise política de crédito interno.`,
        dados_referencia: {
          saldo_atual: saldoAtual
        }
      });
    }

    return alertas;
  },

  /**
   * Detecta queda brusca de faturamento
   */
  async detectarFaturamentoBaixo(empresa_id) {
    const vendas = await base44.entities.Venda.list('-data', 60);
    
    if (vendas.length < 10) return [];

    // Últimos 7 dias vs 7 dias anteriores
    const hoje = new Date();
    const dataAtras14 = new Date(hoje);
    dataAtras14.setDate(dataAtras14.getDate() - 14);
    const dataAtras7 = new Date(hoje);
    dataAtras7.setDate(dataAtras7.getDate() - 7);

    const vendasRecentes = vendas.filter(v => new Date(v.data) > dataAtras7);
    const vendasAnteriores = vendas.filter(
      v => new Date(v.data) <= dataAtras7 && new Date(v.data) > dataAtras14
    );

    const totalRecente = vendasRecentes.reduce((s, v) => s + (v.valor_bruto || 0), 0);
    const totalAnterior = vendasAnteriores.reduce((s, v) => s + (v.valor_bruto || 0), 0);

    if (totalAnterior === 0) return [];

    const queda = (totalRecente - totalAnterior) / totalAnterior;
    const alertas = [];

    if (queda < -0.20) {
      // Queda maior que 20%
      alertas.push({
        tipo_alerta: 'faturamento_baixo',
        gravidade: 'alta',
        titulo: 'Queda brusca de faturamento',
        descricao: `Faturamento caiu ${(Math.abs(queda) * 100).toFixed(1)}% em relação à semana anterior. Investigar causas.`,
        sugestao_ia: `Analise sazonalidade, campanhas de concorrentes ou problemas operacionais. Revise estratégia de vendas.`,
        dados_referencia: {
          percentual_queda: queda,
          faturamento_recente: totalRecente,
          faturamento_anterior: totalAnterior
        }
      });
    }

    return alertas;
  },

  /**
   * Executar todas as verificações
   */
  async executarVerificacoes(empresa_id, loja_id) {
    const alertas = [];

    try {
      alertas.push(...await this.detectarContasVencidas(empresa_id, loja_id));
    } catch (e) {
      console.error('Erro em detectarContasVencidas:', e);
    }

    try {
      alertas.push(...await this.detectarSaldoNegativo(empresa_id, loja_id));
    } catch (e) {
      console.error('Erro em detectarSaldoNegativo:', e);
    }

    try {
      alertas.push(...await this.detectarCMVAlto(empresa_id));
    } catch (e) {
      console.error('Erro em detectarCMVAlto:', e);
    }

    try {
      alertas.push(...await this.detectarBancoVirtualNegativo(empresa_id));
    } catch (e) {
      console.error('Erro em detectarBancoVirtualNegativo:', e);
    }

    try {
      alertas.push(...await this.detectarFaturamentoBaixo(empresa_id));
    } catch (e) {
      console.error('Erro em detectarFaturamentoBaixo:', e);
    }

    // Registrar alertas únicos (evitar duplicatas)
    const alertasUnicos = [];
    const chaves = new Set();

    for (const alerta of alertas) {
      const chave = `${alerta.tipo_alerta}_${alerta.entidade_id || alerta.titulo}`;
      if (!chaves.has(chave)) {
        chaves.add(chave);
        alertasUnicos.push({
          ...alerta,
          empresa_id,
          loja_id
        });
      }
    }

    return alertasUnicos;
  },

  /**
   * Registrar alerta na base de dados
   */
  async registrarAlerta(alertaData) {
    return await base44.entities.Notificacao.create(alertaData);
  },

  /**
   * Listar alertas ativos do usuário
   */
  async listarAlertasAtivos(empresa_id, loja_id = null) {
    const query = { empresa_id, status: 'ativa' };
    if (loja_id) query.loja_id = loja_id;

    return await base44.entities.Notificacao.filter(query, '-created_date', 50);
  },

  /**
   * Marcar alerta como lido
   */
  async marcarComoLido(alerta_id) {
    return await base44.entities.Notificacao.update(alerta_id, {
      lida: true
    });
  },

  /**
   * Resolver alerta (com ação tomada)
   */
  async resolverAlerta(alerta_id, acao_tomada) {
    return await base44.entities.Notificacao.update(alerta_id, {
      status: 'resolvida',
      acao_tomada,
      data_acao: new Date().toISOString(),
      lida: true
    });
  }
};