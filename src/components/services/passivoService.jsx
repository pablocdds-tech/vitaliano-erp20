/**
 * Serviço de Passivos Financeiros
 * Gera parcelas e contas a pagar automaticamente ao criar um passivo.
 */
import { base44 } from '@/api/base44Client';
import { addMonths, format } from 'date-fns';

/**
 * Cria um passivo financeiro com todas as parcelas e contas a pagar vinculadas.
 */
export async function criarPassivoCompleto(dadosPassivo) {
  const { empresa_id, titulo, total_parcelas, valor_parcela, primeiro_vencimento, responsavel, credor_nome, tipo } = dadosPassivo;

  // 1. Criar o passivo
  const passivo = await base44.entities.PassivoFinanceiro.create({
    ...dadosPassivo,
    saldo_atual: dadosPassivo.saldo_atual ?? dadosPassivo.valor_original
  });

  // 2. Buscar ou criar categoria DRE "Dívida / Passivo Financeiro"
  let categoriaDRE = null;
  const categorias = await base44.entities.CategoriaDRE.filter({ empresa_id, nome: 'Dívida / Passivo Financeiro' });
  if (categorias.length > 0) {
    categoriaDRE = categorias[0];
  } else {
    categoriaDRE = await base44.entities.CategoriaDRE.create({
      empresa_id,
      nome: 'Dívida / Passivo Financeiro',
      tipo: 'despesa_fixa',
      grupo: 'despesas_financeiras',
      codigo: 'DIV-001',
      status: 'ativo'
    });
  }

  // 3. Mapear responsável para loja_id
  const lojas = await base44.entities.Loja.filter({ empresa_id, status: 'ativo' });
  const responsavelMap = {
    'NB': lojas.find(l => l.nome?.toLowerCase().includes('nb') || l.codigo?.toLowerCase() === 'nb'),
    'Praca': lojas.find(l => l.nome?.toLowerCase().includes('pra') || l.codigo?.toLowerCase() === 'praca'),
    'Pablo_PF': lojas.find(l => l.nome?.toLowerCase().includes('pablo') || l.codigo?.toLowerCase() === 'pablo_pf')
  };
  const lojaDestino = responsavelMap[responsavel] || lojas[0];
  const loja_id = lojaDestino?.id || '';

  // 4. Gerar parcelas e contas a pagar
  const baseDate = new Date(primeiro_vencimento + 'T12:00:00');
  
  for (let i = 0; i < total_parcelas; i++) {
    const vencimento = addMonths(baseDate, i);
    const dataVencStr = format(vencimento, 'yyyy-MM-dd');
    const descricaoAP = `Parcela ${i + 1}/${total_parcelas} - ${titulo}`;

    // Criar conta a pagar
    const contaPagar = await base44.entities.ContaPagar.create({
      empresa_id,
      loja_id,
      descricao: descricaoAP,
      credor_nome: credor_nome,
      credor_tipo: tipo === 'fornecedor' ? 'fornecedor' : 'banco',
      documento_tipo: 'contrato',
      data_vencimento: dataVencStr,
      valor_original: valor_parcela,
      parcela_atual: i + 1,
      total_parcelas,
      categoria_dre_id: categoriaDRE.id,
      status: 'pendente'
    });

    // Criar parcela do passivo vinculada à conta a pagar
    await base44.entities.ParcelaPassivo.create({
      empresa_id,
      passivo_id: passivo.id,
      numero_parcela: i + 1,
      data_vencimento: dataVencStr,
      valor: valor_parcela,
      status: 'pendente',
      conta_pagar_id: contaPagar.id
    });
  }

  return passivo;
}

/**
 * Sincroniza status das parcelas com base nas contas a pagar vinculadas.
 * Chamado ao abrir detalhe de um passivo.
 */
export async function sincronizarParcelas(passivo_id, empresa_id) {
  const parcelas = await base44.entities.ParcelaPassivo.filter({ empresa_id, passivo_id });
  
  let totalPago = 0;
  
  for (const parcela of parcelas) {
    if (parcela.status === 'pago') {
      totalPago += parcela.valor;
      continue;
    }
    
    if (parcela.conta_pagar_id) {
      const contas = await base44.entities.ContaPagar.filter({ id: parcela.conta_pagar_id });
      const conta = contas[0];
      if (conta && conta.status === 'pago') {
        await base44.entities.ParcelaPassivo.update(parcela.id, {
          status: 'pago',
          data_pagamento: conta.data_pagamento || new Date().toISOString().split('T')[0]
        });
        totalPago += parcela.valor;
      }
    }
  }

  // Atualizar saldo do passivo
  const passivos = await base44.entities.PassivoFinanceiro.filter({ id: passivo_id });
  const passivo = passivos[0];
  if (passivo) {
    const novoSaldo = passivo.valor_original - totalPago;
    const updates = { saldo_atual: Math.max(0, novoSaldo) };
    if (novoSaldo <= 0) updates.status = 'quitado';
    await base44.entities.PassivoFinanceiro.update(passivo_id, updates);
  }

  return totalPago;
}