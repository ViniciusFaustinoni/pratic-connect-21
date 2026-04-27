// Edge Function: gerar-prompt-correcao-erro
// Recebe um relato de erro (texto + imagens anexadas) e devolve um prompt
// pronto para colar no chat do Lovable, considerando o contexto do sistema.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const SYSTEM_CONTEXT = `Você é uma IA que prepara prompts para o Lovable (https://lovable.dev) corrigir bugs em uma aplicação React.

CONTEXTO DA APLICAÇÃO (Pratic Connect — CRM/operações de uma associação de proteção veicular):
- Stack: React 18 + Vite + TypeScript + Tailwind CSS v3 + shadcn/ui + react-router-dom + react-query.
- Backend: Supabase (Postgres + Auth + Storage + Edge Functions Deno).
- Autenticação por roles (tabela user_roles + has_role). Roles: diretor, desenvolvedor, admin_master, vendedor, agencia, supervisor, gerente, instalador (vistoriador), monitoramento, coordenador_monitoramento, juridico, financeiro, etc.
- Áreas/módulos típicos:
  - vendas/cotador: src/pages/vendas/* + src/components/vendas/* (motor de cotação, planos, regras de elegibilidade)
  - associados: src/pages/associados/* (gestão de associados/veículos)
  - operações/instalações: src/pages/instalador/* (app do técnico) + src/pages/monitoramento/* (Mapa, Encaixes, Rastreadores) + src/components/instalacoes/*
  - vistorias: src/pages/instalador/ExecutarVistoriaCompleta.tsx + src/pages/public/VistoriaPublica.tsx (link público)
  - sinistros: src/pages/eventos/* + src/pages/avaliar/*
  - financeiro/cobrança: src/pages/financeiro/*
  - rastreadores: integrações Softruck/Suntech em src/integrations/* + edge functions
  - documentos/contratos: integração Autentique
  - WhatsApp: integrações Meta + Evolution
- Convenções OBRIGATÓRIAS:
  - Sempre usar tokens semânticos do design system (text-foreground, bg-primary, etc.) — NUNCA cores diretas (text-white, bg-black).
  - Cores em HSL no index.css.
  - RLS sempre ativo em tabelas com dados de usuário; roles só em tabela separada user_roles + função has_role/SECURITY DEFINER.
  - Edge functions usam corsHeaders padrão e Lovable AI Gateway para IA.
  - Storage privado por padrão; gerar signed URLs.
  - Domínio de produção: https://app.praticcar.org.

SEU TRABALHO: ler o relato (texto + imagens) e gerar UM PROMPT CONCRETO E ACIONÁVEL para o Lovable corrigir o bug.

Regras do prompt gerado:
- Comece descrevendo o problema em 1-2 linhas.
- Inclua passos para reproduzir, se for possível inferir.
- Liste explicitamente arquivos/módulos prováveis a investigar (use os caminhos acima como pista).
- Especifique o resultado esperado.
- Peça ao Lovable para verificar a correção (build, console, comportamento).
- NÃO invente código nem assuma stack diferente.
- Linguagem: português, direto, técnico, sem emojis.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) return json(500, { error: 'LOVABLE_API_KEY não configurada' })

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(401, { error: 'Não autenticado' })

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userRes } = await supabaseUser.auth.getUser()
    const userId = userRes?.user?.id
    if (!userId) return json(401, { error: 'Sessão inválida' })

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: isAdminRes, error: adminErr } = await supabase.rpc('is_error_reports_admin', {
      _user_id: userId,
    })
    if (adminErr || !isAdminRes) return json(403, { error: 'Sem permissão' })

    const body = await req.json().catch(() => ({}))
    const reportId: string | undefined = body?.report_id
    if (!reportId) return json(400, { error: 'report_id obrigatório' })

    const { data: report, error: rErr } = await supabase
      .from('error_reports')
      .select('id, area, descricao, reporter_nome, reporter_email, observacao_diretor')
      .eq('id', reportId)
      .maybeSingle()
    if (rErr || !report) return json(404, { error: 'Relato não encontrado' })

    const { data: files = [] } = await supabase
      .from('error_report_files')
      .select('id, storage_path, nome_original, mime_type')
      .eq('report_id', reportId)

    // Gerar signed URLs apenas para imagens
    const imageContents: { type: 'image_url'; image_url: { url: string } }[] = []
    for (const f of files ?? []) {
      if (!f.mime_type?.startsWith('image/')) continue
      const { data: signed } = await supabase.storage
        .from('relatos-erros')
        .createSignedUrl(f.storage_path, 3600)
      if (signed?.signedUrl) {
        imageContents.push({ type: 'image_url', image_url: { url: signed.signedUrl } })
      }
    }

    const userText = `RELATO DE ERRO #${report.id}
Área relatada: ${report.area}
Autor: ${report.reporter_nome ?? '(desconhecido)'} <${report.reporter_email ?? '?'}>

Descrição do usuário:
"""
${(report.descricao ?? '').trim()}
"""

${report.observacao_diretor ? `Observação do diretor: ${report.observacao_diretor}\n` : ''}
${imageContents.length > 0 ? `Anexos (${imageContents.length} imagem(ns) — analise-as cuidadosamente para entender a interface, mensagens de erro visíveis e o estado da tela):` : 'Sem anexos visuais.'}

Tarefa: gere o prompt para colar no chat do Lovable corrigir esse bug.`

    const userContent: any[] = [{ type: 'text', text: userText }, ...imageContents]

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // multimodal forte para analisar imagens + texto
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: SYSTEM_CONTEXT },
          { role: 'user', content: userContent },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'devolver_prompt',
              description: 'Devolve o prompt pronto para colar no chat do Lovable',
              parameters: {
                type: 'object',
                properties: {
                  titulo: { type: 'string', description: 'Resumo de 1 linha do bug' },
                  contexto_resumido: { type: 'string', description: 'Resumo técnico do que está errado' },
                  arquivos_provaveis: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Caminhos de arquivos/áreas prováveis a investigar',
                  },
                  passos_diagnostico: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Passos sugeridos de diagnóstico',
                  },
                  prompt_para_lovable: {
                    type: 'string',
                    description: 'Texto final pronto para colar no chat do Lovable',
                  },
                },
                required: ['titulo', 'contexto_resumido', 'prompt_para_lovable'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'devolver_prompt' } },
      }),
    })

    if (!aiResp.ok) {
      if (aiResp.status === 429) return json(429, { error: 'Limite de requisições atingido. Tente novamente em instantes.' })
      if (aiResp.status === 402) return json(402, { error: 'Créditos da IA esgotados. Adicione créditos em Settings > Workspace > Usage.' })
      const t = await aiResp.text()
      console.error('AI gateway error:', aiResp.status, t)
      return json(500, { error: 'Falha na IA' })
    }

    const aiJson = await aiResp.json()
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0]
    let parsed: any = null
    if (toolCall?.function?.arguments) {
      try {
        parsed = JSON.parse(toolCall.function.arguments)
      } catch (e) {
        console.error('Falha ao parsear tool args:', e)
      }
    }
    if (!parsed?.prompt_para_lovable) {
      // fallback: usar message.content se vier como texto
      const fallback = aiJson?.choices?.[0]?.message?.content?.trim?.()
      if (fallback) {
        parsed = { titulo: 'Prompt gerado', contexto_resumido: '', prompt_para_lovable: fallback, arquivos_provaveis: [], passos_diagnostico: [] }
      } else {
        return json(500, { error: 'Resposta da IA não pôde ser interpretada' })
      }
    }

    return json(200, parsed)
  } catch (e: any) {
    console.error('gerar-prompt-correcao-erro:', e)
    return json(500, { error: e?.message ?? 'Erro inesperado' })
  }
})
