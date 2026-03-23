import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { messages, systemPrompt } = await req.json();

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return Response.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 });

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const body = {
      system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );

    const data = await res.json();
    if (!res.ok) return Response.json({ error: data.error?.message || 'Erro Gemini' }, { status: 500 });

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return Response.json({ reply: text });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});