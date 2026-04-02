import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Buscar todos os clientes do CRM
        const customers = await base44.entities.CRMCustomer.list();
        
        let updatedCount = 0;
        const now = new Date();

        for (const customer of customers) {
            const rScore = calculateRecency(customer.last_order_at, now);
            const fScore = calculateFrequency(customer.total_orders);
            const vScore = calculateValue(customer.avg_ticket || (customer.total_spent / (customer.total_orders || 1)));
            
            const segment = determineSegment(rScore, fScore, vScore, customer.first_order_at, now);
            
            await base44.entities.CRMCustomer.update(customer.id, {
                rfv_recency_score: rScore,
                rfv_frequency_score: fScore,
                rfv_value_score: vScore,
                rfv_segment: segment,
                rfv_updated_at: now.toISOString()
            });
            updatedCount++;
        }

        return Response.json({ success: true, updated: updatedCount });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

// Funções utilitárias de score e classificação RFV baseadas no prompt
function calculateRecency(lastOrderAt, now) {
    if (!lastOrderAt) return 1;
    const days = (now - new Date(lastOrderAt)) / (1000 * 60 * 60 * 24);
    if (days <= 7) return 5;
    if (days <= 30) return 4;
    if (days <= 60) return 3;
    if (days <= 120) return 2;
    return 1;
}

function calculateFrequency(totalOrders) {
    if (totalOrders >= 8) return 5;
    if (totalOrders >= 5) return 4;
    if (totalOrders >= 3) return 3;
    if (totalOrders === 2) return 2;
    return 1;
}

function calculateValue(avgTicket) {
    // Estimativa de quartis fixa (idealmente baseada na curva real do restaurante)
    if (avgTicket >= 100) return 5;
    if (avgTicket >= 70) return 4;
    if (avgTicket >= 50) return 3;
    if (avgTicket >= 30) return 2;
    return 1;
}

function determineSegment(r, f, v, firstOrderAt, now) {
    if (firstOrderAt) {
        const daysSinceFirst = (now - new Date(firstOrderAt)) / (1000 * 60 * 60 * 24);
        if (daysSinceFirst <= 30) return 'new'; // Novo cliente (<30 dias da 1ª compra)
    }
    
    if (r >= 4 && f >= 4 && v >= 4) return 'champion'; // Recente, Frequente e gasta bem
    if (r >= 3 && f >= 3) return 'loyal'; // Leal
    if (r <= 2 && f >= 3) return 'at_risk'; // Em risco: Comprava bastante mas sumiu
    if (r === 1 && f >= 2) return 'lost'; // Perdido
    if (r >= 4 && f === 1) return 'promising'; // Promissor: Comprou recentemente, mas só 1x
    
    return 'none';
}