import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Este worker simula o disparo de uma campanha para a audiência segmentada.
// Em um ambiente real com milhares de clientes, isso deveria enfileirar jobs.
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { campaign_id } = body;

        const campaign = await base44.entities.CRMCampaign.get(campaign_id);
        if (!campaign) throw new Error("Campanha não encontrada");

        // 1. Atualiza status para rodando
        await base44.entities.CRMCampaign.update(campaign.id, { status: 'running' });

        // 2. Busca audiência (simulação simples baseada no segment)
        let query = {};
        if (campaign.segment_filter?.segment !== 'all') {
            query.rfv_segment = campaign.segment_filter.segment;
        }
        // Buscar apenas clientes com telefone
        const audience = await base44.entities.CRMCustomer.filter(query);
        const validAudience = audience.filter(c => c.phone);

        // Atualiza contagem total alvo
        await base44.entities.CRMCampaign.update(campaign.id, { target_count: validAudience.length });

        const accessToken = Deno.env.get("META_ACCESS_TOKEN");
        const phoneId = Deno.env.get("META_PHONE_NUMBER_ID");

        let sentCount = 0;

        // Disparo (Rate limit na Meta é 80 msg/seg tier 1, estamos enviando em batch)
        // Como o tempo do Deno Deploy é curto, processamos o máximo possível
        for (const customer of validAudience) {
            // Em produção: Usaria a fila BullMQ ou base44 Automations para desdobrar.
            
            // Simula Log
            await base44.entities.CRMMessageLog.create({
                campaign_id: campaign.id,
                customer_id: customer.id,
                channel: 'whatsapp',
                status: 'queued',
                external_message_id: 'simulated_id_' + Date.now()
            });
            sentCount++;
            
            // Aqui seria feito o fetch real para a Meta:
            /*
            if(accessToken && phoneId) {
                await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {...})
            }
            */
        }

        // Finaliza a campanha (Num fluxo real, um webhook iria atualizando os logs)
        await base44.entities.CRMCampaign.update(campaign.id, { 
            status: 'completed', 
            sent_count: sentCount,
            completed_at: new Date().toISOString()
        });

        return Response.json({ success: true, targets: validAudience.length, sent: sentCount });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});