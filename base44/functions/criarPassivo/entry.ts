import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { liability, customInstallments } = body;

    if (!liability) return Response.json({ error: 'liability is required' }, { status: 400 });

    // Calcular saldo devedor atual
    const amountPaid = parseFloat(liability.amount_paid || 0);
    const currentBalance = parseFloat(liability.original_amount) - amountPaid;

    // 1. Criar o passivo
    const created = await base44.entities.FinancialLiability.create({
      ...liability,
      amount_paid: amountPaid,
      current_balance: currentBalance
    });

    // 2. Gerar parcelas + contas a pagar
    const firstDue = new Date(liability.first_due_date);
    const total = parseInt(liability.total_installments);
    const hasVariableInstallments = liability.has_variable_installments || false;

    // Mapear responsible para loja_id (se informado)
    const lojaId = liability.loja_id || null;

    // Buscar ou criar categoria DRE para dívidas
    let categoriaDRE = null;
    try {
      const cats = await base44.asServiceRole.entities.CategoriaDRE.filter({ nome: 'Dívida / Passivo Financeiro' });
      if (cats && cats.length > 0) {
        categoriaDRE = cats[0];
      }
    } catch (e) {
      // sem categoria DRE, tudo bem
    }

    const createdInstallments = [];

    for (let i = 0; i < total; i++) {
      const dueDate = new Date(firstDue);
      dueDate.setMonth(dueDate.getMonth() + i);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      // Determinar valor da parcela: customInstallments ou fixed
      let installmentValue = parseFloat(liability.installment_value || 0);
      if (hasVariableInstallments && customInstallments && customInstallments[i]) {
        installmentValue = parseFloat(customInstallments[i]);
      }

      const descricao = `Parcela ${i + 1}/${total} - ${liability.title}`;

      // Criar conta a pagar
      const apData = {
        descricao,
        credor_nome: liability.creditor_name || liability.title,
        credor_tipo: 'outro',
        documento_tipo: 'outros',
        data_vencimento: dueDateStr,
        valor_original: installmentValue,
        status: 'pendente',
        observacoes: `Passivo: ${liability.title} | Parcela ${i + 1}/${total}`,
        documento_numero: `PASS-${created.id}-${i + 1}`
      };

      if (lojaId) apData.loja_id = lojaId;
      if (categoriaDRE) apData.categoria_dre_id = categoriaDRE.id;

      // empresa_id obrigatório
      if (liability.empresa_id) apData.empresa_id = liability.empresa_id;

      let apRecord = null;
      try {
        apRecord = await base44.entities.ContaPagar.create(apData);
      } catch (e) {
        // tenta sem empresa_id
        try {
          delete apData.empresa_id;
          apRecord = await base44.entities.ContaPagar.create(apData);
        } catch (e2) {
          // ignora erro individual
        }
      }

      // Criar parcela
      const installmentData = {
        liability_id: created.id,
        installment_number: i + 1,
        due_date: dueDateStr,
        amount: installmentValue,
        status: 'pendente'
      };

      if (apRecord) installmentData.linked_ap_id = apRecord.id;

      const inst = await base44.entities.LiabilityInstallment.create(installmentData);
      createdInstallments.push(inst);
    }

    return Response.json({
      success: true,
      liability: created,
      installments_created: createdInstallments.length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});