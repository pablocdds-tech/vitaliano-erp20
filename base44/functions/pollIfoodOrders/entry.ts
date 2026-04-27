import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const clientId = Deno.env.get("IFOOD_CLIENT_ID");
    const clientSecret = Deno.env.get("IFOOD_CLIENT_SECRET");
    
    if (!clientId || !clientSecret) {
       return Response.json({ status: 'skipped', message: 'Credenciais do iFood não configuradas no ambiente.' });
    }
    
    // 1. Obter Token do iFood
    const tokenRes = await fetch('https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        clientId: clientId,
        clientSecret: clientSecret
      })
    });
    
    if (!tokenRes.ok) {
      throw new Error(`Falha na autenticação do iFood: ${await tokenRes.text()}`);
    }
    
    const { accessToken } = await tokenRes.json();
    
    // 2. Fazer Polling de Eventos
    const eventsRes = await fetch('https://merchant-api.ifood.com.br/order/v1.0/events:polling', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (eventsRes.status === 204) {
      return Response.json({ status: 'success', message: 'Nenhum novo evento no iFood' });
    }
    
    if (!eventsRes.ok) {
       throw new Error(`Falha no polling do iFood: ${await eventsRes.text()}`);
    }
    
    const events = await eventsRes.json();
    // Filtramos apenas eventos de pedidos criados ou confirmados
    const orderEvents = events.filter(e => e.code === 'PLC' || e.code === 'CON'); 
    
    const processedOrders = [];
    
    // 3. Processar Pedidos e atualizar o CRMCustomer
    for (const event of orderEvents) {
      const orderId = event.orderId;
      
      const orderRes = await fetch(`https://merchant-api.ifood.com.br/order/v1.0/orders/${orderId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (orderRes.ok) {
        const orderData = await orderRes.json();
        const customer = orderData.customer;
        
        if (customer && customer.phone && customer.phone.number) {
          const phone = customer.phone.number;
          const cpf = customer.documentNumber || null; // Extraindo o CPF conforme solicitado
          const name = customer.name;
          const lojaId = orderData.merchant?.id || 'ifood_merchant';
          const orderTotal = orderData.payments?.prepaid || orderData.payments?.pending || 0;
          
          // Buscar cliente existente
          const existingCustomers = await base44.asServiceRole.entities.CRMCustomer.filter({
            phone: phone
          });
          
          if (existingCustomers.length > 0) {
            const crmCustomer = existingCustomers[0];
            await base44.asServiceRole.entities.CRMCustomer.update(crmCustomer.id, {
              cpf: cpf || crmCustomer.cpf,
              name: name || crmCustomer.name,
              total_orders: (crmCustomer.total_orders || 0) + 1,
              total_spent: (crmCustomer.total_spent || 0) + orderTotal,
              last_order_at: new Date().toISOString()
            });
          } else {
            await base44.asServiceRole.entities.CRMCustomer.create({
              loja_id: lojaId,
              name: name || 'Cliente iFood',
              phone: phone,
              cpf: cpf,
              source: 'ifood',
              total_orders: 1,
              total_spent: orderTotal,
              first_order_at: new Date().toISOString(),
              last_order_at: new Date().toISOString()
            });
          }
          processedOrders.push(orderId);
        }
      }
    }
    
    // 4. Confirmar (Acknowledge) o recebimento dos eventos no iFood para não recebê-los novamente
    if (events.length > 0) {
      await fetch('https://merchant-api.ifood.com.br/order/v1.0/events/acknowledgment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(events.map(e => ({ id: e.id })))
      });
    }

    return Response.json({ status: 'success', processed: processedOrders.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});