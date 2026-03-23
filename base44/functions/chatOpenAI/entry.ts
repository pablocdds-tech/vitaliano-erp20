import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { messages, systemPrompt, model } = await req.json();

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return Response.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 });

    const chatMessages = [];
    if (systemPrompt) chatMessages.push({ role: 'system', content: systemPrompt });

    // Converte mensagens com file_urls para o formato vision da OpenAI
    for (const msg of messages) {
      if (msg.file_urls && msg.file_urls.length > 0) {
        const contentParts = [];
        if (msg.content) contentParts.push({ type: 'text', text: msg.content });
        for (const url of msg.file_urls) {
          contentParts.push({ type: 'image_url', image_url: { url, detail: 'high' } });
        }
        chatMessages.push({ role: msg.role, content: contentParts });
      } else {
        chatMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model || 'gpt-4o',
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 4096
      })
    });

    const data = await res.json();
    if (!res.ok) return Response.json({ error: data.error?.message || 'Erro OpenAI' }, { status: 500 });

    const text = data.choices?.[0]?.message?.content || '';
    return Response.json({ reply: text });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});