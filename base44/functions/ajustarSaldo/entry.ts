import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tipoOrigem, contaId, valor, motivo, observacao, saldoAnterior, data } = body;

    if (!tipoOrigem || !contaId || valor === undefined || !motivo) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Buscar conta/cofre
    let conta;
    if (tipoOrigem === 'conta_bancaria') {
      conta = await base44.entities.ContaBancaria.filter({ id: contaId });
      conta = conta && conta.length > 0 ? conta[0] : null;
    } else {
      conta = await base44.entities.Cofre.filter({ id: contaId });
      conta = conta && conta.length > 0 ? conta[0] : null;
    }

    if (!conta) {
      return Response.json({ error: 'Conta/Cofre não encontrado' }, { status: 404 });
    }

    const novoSaldo = saldoAnterior + valor;

    // Atualizar saldo da conta/cofre
    if (tipoOrigem === 'conta_bancaria') {
      await base44.entities.ContaBancaria.update(contaId, {
        saldo_atual: novoSaldo
      });

      // Registrar transação bancária
      await base44.entities.TransacaoBancaria.create({
        conta_bancaria_id: contaId,
        tipo: valor > 0 ? 'credito' : 'debito',
        valor: Math.abs(valor),
        data_transacao: data,
        descricao: `Ajuste: ${motivo}`,
        observacoes: observacao,
        saldo_anterior: saldoAnterior,
        saldo_posterior: novoSaldo,
        status: 'confirmada'
      });
    } else {
      await base44.entities.Cofre.update(contaId, {
        saldo_atual: novoSaldo
      });

      // Registrar movimentação do cofre
      await base44.entities.MovimentacaoCofre.create({
        cofre_id: contaId,
        tipo: valor > 0 ? 'deposito' : 'saque',
        valor: Math.abs(valor),
        data: data,
        descricao: `Ajuste: ${motivo}`,
        observacoes: observacao,
        saldo_anterior: saldoAnterior,
        saldo_posterior: novoSaldo
      });
    }

    return Response.json({
      success: true,
      novoSaldo,
      tipo: tipoOrigem,
      contaId
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});