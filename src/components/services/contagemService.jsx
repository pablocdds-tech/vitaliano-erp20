import { base44 } from '@/api/base44Client';

/** Gera token único para tarefa */
function gerarToken() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

/**
 * Cria uma contagem direta com tarefas e tokens.
 * @param {object} params - { empresa_id, loja_id, responsavel_nome, grupo, produto_ids, produtos, observacoes }
 */
export async function criarContagemDireta({ empresa_id, loja_id, responsavel_nome, grupo, produto_ids, produtos, observacoes }) {
  // Busca saldos de estoque
  const estoques = await base44.entities.Estoque.filter({ empresa_id, loja_id });
  const estoqueMap = {};
  estoques.forEach(e => { estoqueMap[e.produto_id] = e.quantidade || 0; });

  const prodMap = {};
  produtos.forEach(p => { prodMap[p.id] = p; });

  const itensComSaldo = produto_ids.map(pid => {
    const prod = prodMap[pid];
    return {
      produto_id: pid,
      produto_nome: prod?.nome || '?',
      unidade_medida: prod?.unidade_medida || 'un',
      quantidade_sistema: estoqueMap[pid] ?? 0,
      quantidade_contada: null,
      observacao: '',
    };
  });

  const token = gerarToken();

  // Cria a contagem
  const contagem = await base44.entities.Contagem.create({
    empresa_id,
    loja_id,
    tipo: 'parcial',
    data_abertura: new Date().toISOString(),
    responsavel: responsavel_nome,
    total_itens: itensComSaldo.length,
    itens_contados: 0,
    status: 'aberta',
    observacoes: observacoes || grupo || '',
  });

  // Cria a tarefa com token
  const tarefa = await base44.entities.TarefaContagem.create({
    empresa_id,
    contagem_id: contagem.id,
    loja_id,
    responsavel_nome,
    grupo: grupo || '',
    token,
    itens: itensComSaldo,
    total_itens: itensComSaldo.length,
    itens_preenchidos: 0,
    status: 'pendente',
  });

  return { contagem, tarefa, token };
}

/**
 * Gera uma Contagem completa a partir de um template.
 * Cria: Contagem + TarefaContagem[] com tokens.
 */
export async function gerarContagemDeTemplate(template, produtos) {
  const user = await base44.auth.me();
  const empresa_id = user.empresa_id;
  
  // Busca saldos de estoque para preencher quantidade_sistema
  const estoques = await base44.entities.Estoque.filter({ empresa_id, loja_id: template.loja_id });
  const estoqueMap = {};
  estoques.forEach(e => { estoqueMap[e.produto_id] = e.quantidade || 0; });

  const prodMap = {};
  produtos.forEach(p => { prodMap[p.id] = p; });

  // Cria a contagem geral
  const contagem = await base44.entities.Contagem.create({
    empresa_id,
    loja_id: template.loja_id,
    tipo: 'parcial',
    data_abertura: new Date().toISOString(),
    responsavel: 'Sistema (Template)',
    total_itens: (template.tarefas || []).reduce((s, t) => s + (t.itens || []).length, 0),
    itens_contados: 0,
    status: 'aberta',
    observacoes: `Gerada do template: ${template.nome}`,
  });

  // Cria tarefas com tokens
  const tarefasCriadas = [];
  for (const tarefa of (template.tarefas || [])) {
    const token = gerarToken();
    const itensComSaldo = (tarefa.itens || []).map(item => {
      const prod = prodMap[item.produto_id];
      return {
        produto_id: item.produto_id,
        produto_nome: item.produto_nome || prod?.nome || '',
        unidade_medida: prod?.unidade_medida || 'un',
        quantidade_sistema: estoqueMap[item.produto_id] ?? 0,
        quantidade_contada: null,
        observacao: '',
      };
    });

    const t = await base44.entities.TarefaContagem.create({
      empresa_id,
      contagem_id: contagem.id,
      loja_id: template.loja_id,
      responsavel_nome: tarefa.responsavel_nome,
      grupo: tarefa.grupo || '',
      token,
      itens: itensComSaldo,
      total_itens: itensComSaldo.length,
      itens_preenchidos: 0,
      status: 'pendente',
    });
    tarefasCriadas.push(t);
  }

  return { contagem, tarefas: tarefasCriadas };
}

/**
 * Aprova ajuste de divergências de uma contagem.
 * Gera MovimentacaoEstoque tipo 'ajuste' para cada item divergente.
 */
export async function aprovarAjusteContagem(contagem, tarefas, empresa_id) {
  let temDivergencia = false;

  for (const tarefa of tarefas) {
    for (const item of (tarefa.itens || [])) {
      if (item.quantidade_contada === null || item.quantidade_contada === undefined) continue;
      if (item.quantidade_sistema === null || item.quantidade_sistema === undefined) continue;
      const diff = (item.quantidade_contada || 0) - (item.quantidade_sistema || 0);
      if (Math.abs(diff) < 0.001) continue;

      temDivergencia = true;

      const estoques = await base44.entities.Estoque.filter({
        loja_id: contagem.loja_id,
        produto_id: item.produto_id,
      });
      const estoque = estoques[0];
      const qtdAtual = estoque?.quantidade || 0;
      const qtdNova = item.quantidade_contada;
      const custoUnit = estoque?.custo_medio || 0;

      if (estoque) {
        await base44.entities.Estoque.update(estoque.id, { quantidade: Math.max(0, qtdNova) });
      } else {
        await base44.entities.Estoque.create({
          empresa_id,
          loja_id: contagem.loja_id,
          produto_id: item.produto_id,
          quantidade: Math.max(0, qtdNova),
          custo_medio: 0,
        });
      }

      await base44.entities.MovimentacaoEstoque.create({
        empresa_id,
        loja_id: contagem.loja_id,
        produto_id: item.produto_id,
        tipo: 'ajuste',
        quantidade: diff,
        quantidade_anterior: qtdAtual,
        quantidade_posterior: Math.max(0, qtdNova),
        custo_unitario: custoUnit,
        custo_total: Math.abs(diff) * custoUnit,
        documento_tipo: 'contagem',
        documento_id: contagem.id,
        observacao: `Ajuste contagem ${contagem.id} — responsável: ${tarefa.responsavel_nome}`,
      });
    }
  }

  await base44.entities.Contagem.update(contagem.id, {
    status: temDivergencia ? 'ajustada' : 'aprovada',
    data_fechamento: new Date().toISOString(),
  });
}