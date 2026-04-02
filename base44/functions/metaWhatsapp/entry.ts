import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Este serviço lida tanto com o disparo de mensagens quanto com os webhooks recebidos da Meta
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);

    // 1. VALIDAÇÃO DO WEBHOOK (GET)
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      
      const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");
      
      if (mode === 'subscribe' && token === verifyToken) {
        return new Response(challenge, { status: 200 });
      }
      return new Response('Forbidden', { status: 403 });
    }

    // 2. RECEBIMENTO DE EVENTOS E DISPARO DE MENSAGENS (POST)
    if (req.method === 'POST') {
      const body = await req.json();
      
      // A. Processar Webhook da Meta (Status de leitura, entrega ou mensagens recebidas)
      if (body.object === 'whatsapp_business_account') {
         // Aqui processaremos a fila de status: 'sent', 'delivered', 'read', 'failed'
         // e atualizaremos a tabela CRMMessageLog no banco.
         return Response.json({ success: true });
      }

      // B. Disparar Mensagem (Chamada interna via Dashboard/Workers)
      const user = await base44.auth.me();
      if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { action, payload } = body;
      const accessToken = Deno.env.get("META_ACCESS_TOKEN");
      const phoneId = Deno.env.get("META_PHONE_NUMBER_ID");

      if (!accessToken || !phoneId) {
        return Response.json({ error: 'Faltam chaves da Meta API' }, { status: 400 });
      }

      if (action === 'send_message') {
        const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        return Response.json(data);
      }

      return Response.json({ error: 'Ação desconhecida' }, { status: 400 });
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});