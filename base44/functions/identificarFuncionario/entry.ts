import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import OpenAI from 'npm:openai';

const openai = new OpenAI({
    apiKey: Deno.env.get("OPENAI_API_KEY"),
});

Deno.serve(async (req) => {
    try {
        const { fotoUrl } = await req.json();
        if (!fotoUrl) {
            return Response.json({ error: 'fotoUrl required' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Busca funcionários ativos
        const funcionarios = await base44.entities.Funcionario.filter({ status: 'ativo' });
        
        // Filtra apenas os que possuem foto de perfil cadastrada
        const funcionariosComFoto = funcionarios.filter(f => f.foto_url);

        if (funcionariosComFoto.length === 0) {
            return Response.json({ funcionario_id: null, error: 'Nenhum funcionário com foto de perfil para comparar.' });
        }

        // Constrói o array de conteúdo com a foto capturada e a galeria de fotos de perfil
        const content = [
            {
                type: "text",
                text: "Você atua como um sistema de comparação de imagens e reconhecimento facial. A primeira imagem é uma foto capturada agora. As imagens seguintes são fotos de perfil de candidatos. Sua tarefa é comparar o rosto da primeira foto com as outras e me dizer qual candidato corresponde à primeira foto.\n\nRetorne APENAS um JSON no formato: {\"id\": \"id_do_candidato\"}. Caso nenhum candidato corresponda, retorne {\"id\": null}.\n\nFOTO CAPTURADA AGORA:"
            },
            {
                type: "image_url",
                image_url: { url: fotoUrl }
            }
        ];

        funcionariosComFoto.forEach((f) => {
            content.push({
                type: "text",
                text: `CANDIDATO -> ID: ${f.id}`
            });
            content.push({
                type: "image_url",
                image_url: { url: f.foto_url }
            });
        });

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: content
                }
            ],
            response_format: { type: "json_object" },
            max_tokens: 50,
            temperature: 0.1
        });

        const result = JSON.parse(response.choices[0].message.content);

        return Response.json({ 
            funcionario_id: result.id || null 
        });

    } catch (error) {
        console.error("Erro no reconhecimento facial:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});