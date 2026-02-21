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

    // LIMPEZA DA IMAGEM: Remove o prefixo "data:image/..." caso ele tenha sido enviado
    const cleanBase64 = image_base64.includes(',') 
      ? image_base64.split(',')[1] 
      : image_base64;

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 });
    }

    const prompt = `Analise esta nota fiscal e extraia os dados para JSON.
Retorne APENAS o objeto JSON puro, sem markdown e sem explicações.
Use null para campos não encontrados.

Estrutura desejada:
{
  "fornecedor": { "razao_social": null, "cnpj": null },
  "numero": null,
  "chave_acesso": null,
  "data_emissao": null,
  "itens": [{ "descricao": "string", "quantidade": 0, "valor_total": 0 }],
  "valor_total": 0
}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { 
                inline_data: { 
                  mime_type: mime_type, 
                  data: cleanBase64 
                } 
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            response_mime_type: "application/json"
          }
        })
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      return Response.json({ error: `Erro Gemini: ${err}` }, { status: 502 });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Tenta capturar apenas o que está dentro das chaves {} para evitar erros de parse
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      return Response.json({ 
        error: 'A IA não retornou um formato JSON válido', 
        raw: rawText 
      }, { status: 422 });
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return Response.json({ success: true, data: parsed });
    } catch (e) {
      return Response.json({ 
        error: 'Erro ao processar o JSON final', 
        details: e.message,
        raw: rawText 
      }, { status: 422 });
    }

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});