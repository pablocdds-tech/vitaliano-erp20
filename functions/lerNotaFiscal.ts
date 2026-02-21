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
Retorne APENAS um JSON válido, sem markdown, sem explicações, somente o JSON puro.

O JSON deve seguir exatamente esta estrutura:
{
  "fornecedor": {
    "razao_social": "string ou null",
    "nome_fantasia": "string ou null",
    "cnpj": "string (somente números) ou null",
    "inscricao_estadual": "string ou null",
    "endereco": "string ou null"
  },
  "numero": "string ou null",
  "serie": "string ou null",
  "chave_acesso": "string (44 dígitos, somente números) ou null",
  "data_emissao": "string no formato YYYY-MM-DD ou null",
  "data_vencimento": "string no formato YYYY-MM-DD ou null",
  "forma_pagamento": "boleto | pix | transferencia | dinheiro | cartao | cheque | null",
  "itens": [
    {
      "descricao": "string",
      "codigo": "string ou null",
      "ncm": "string ou null",
      "cfop": "string ou null",
      "unidade": "string ou null",
      "quantidade": number,
      "valor_unitario": number,
      "subtotal": number
    }
  ],
  "valor_produtos": number ou null,
  "valor_frete": number ou null,
  "valor_desconto": number ou null,
  "valor_ipi": number ou null,
  "valor_icms": number ou null,
  "valor_total": number ou null,
  "num_parcelas": number ou null,
  "observacoes": "string ou null"
}

Regras importantes:
- Valores monetários devem ser números (ex: 150.50, não "R$ 150,50")
- Datas no formato YYYY-MM-DD
- CNPJ e chave de acesso somente dígitos, sem pontos ou traços
- Se não encontrar um campo, use null
- Para itens, extraia TODOS os itens da nota
- Se houver dúvida entre dois valores para o total, prefira o "Valor Total da Nota"`;

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
            maxOutputTokens: 4096,
            response_mime_type: "application/json",
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      return Response.json({ error: `Erro na API Gemini: ${err}` }, { status: 502 });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Limpa markdown caso venha envolvido em ```json ... ```
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return Response.json({
        error: 'Não foi possível interpretar o retorno do Gemini como JSON',
        raw: rawText,
      }, { status: 422 });
    }

    return Response.json({ success: true, data: parsed });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});