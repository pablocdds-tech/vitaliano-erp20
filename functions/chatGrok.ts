import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { messages, systemPrompt } = await req.json();

    const apiKey = Deno.env.get('GROK_API_KEY');
    if (!apiKey) return Response.json({ error: 'GROK_API_KEY não configurada' }, { status: 500 });

    const chatMessages = [];
    if (systemPrompt) chatMessages.push({ role: 'system', content: systemPrompt });
    chatMessages.push(...messages);

    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'grok-2-latest',
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 4096
      })
    });

    const data = await res.json();
    if (!res.ok) return Response.json({ error: data.error?.message || 'Erro Grok' }, { status: 500 });

    const text = data.choices?.[0]?.message?.content || '';
    return Response.json({ reply: text });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});