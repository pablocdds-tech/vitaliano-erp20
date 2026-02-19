import { base44 } from '@/api/base44Client';
import { getEmpresaAtiva } from '@/components/services/tenantService';
import { format } from 'date-fns';

/** Gera token único para tarefa */
function gerarToken() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

/**
 * Gera uma Contagem completa a partir de um template.
 * Cria: Contagem + TarefaContagem[] com tokens.
 */
export async function gerarContagemDeTemplate(template, produtos) {
  const empresa = await getEmpresaAtiva();
  const hoje = format(new Date(), 'yyyy-MM-dd');

  // Busca saldos de estoque para preencher quantidade_sistema
  const estoques = await base44.entities.Estoque.filter({ loja_id: template.loja_id });
  const estoqueMap = {};
  estoques.forEach(e => { estoqueMap[e.produto_id] = e.quantidade || 0; });

  const prodMap = {};
  produtos.forEach(p => { prodMap[p.id] = p; });

  // Cria a contagem geral
  const contagem = await base44.entities.Contagem.create({
    empresa_id: empresa.id,
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
        quantidade_sistema: estoqueMap[item.produto_id] ?? null, // null = não exibir pro funcionário
        quantidade_contada: null,
        observacao: '',
      };
    });

    const t = await base44.entities.TarefaContagem.create({
      empresa_id: empresa.id,
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

      // Busca estoque atual pelo saldo real atual (não o snapshot da contagem)
      const estoques = await base44.entities.Estoque.filter({
        loja_id: contagem.loja_id,
        produto_id: item.produto_id,
      });
      const estoque = estoques[0];
      const qtdAtual = estoque?.quantidade || 0;
      // Aplica o diff relativo: nova qtd = qtd_contada (substitui pelo valor físico)
      const qtdNova = item.quantidade_contada;
      const custoUnit = estoque?.custo_medio || 0;

      if (estoque) {
        await base44.entities.Estoque.update(estoque.id, { quantidade: Math.max(0, qtdNova) });
      } else {
        // Cria registro de estoque se não existir
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