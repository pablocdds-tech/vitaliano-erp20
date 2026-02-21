import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { image_base64, mime_type = 'image/jpeg' } = await req.json();

    if (!image_base64) {
      return Response.json({ error: 'image_base64 é obrigatório' }, { status: 400 });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 });
    }

    const prompt = `Você é um especialista em leitura de notas fiscais brasileiras.
Analise a imagem desta nota fiscal e extraia TODOS os dados disponíveis.
Retorne o JSON conforme a estrutura solicitada.

Regras importantes:
- Valores monetários devem ser números (ex: 150.50)
- Datas no formato YYYY-MM-DD
- CNPJ e chave de acesso somente dígitos
- Se não encontrar um campo, use null`;

    // CORREÇÃO: Usando a rota do modelo estável gemini-2.5-flash
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type,
                    data: image_base64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            topP: 0.95,
            maxOutputTokens: 8192,
            // Força a saída a ser um JSON estruturado
            response_mime_type: "application/json",
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      // Se der 404 aqui, verifique se a GEMINI_API_KEY está correta e ativa no Google AI Studio
      return Response.json({ error: `Erro na API Gemini: ${err}` }, { status: 502 });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return Response.json({
        error: 'Erro ao processar JSON retornado pela IA',
        raw: rawText,
      }, { status: 422 });
    }

    return Response.json({ success: true, data: parsed });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});