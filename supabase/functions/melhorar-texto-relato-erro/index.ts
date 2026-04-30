import { aiGatewayFetch } from "../_shared/ai-client.ts";
// Edge Function: melhorar-texto-relato-erro
// Reescreve a descrição de um relato de erro de forma mais clara/técnica,
// sem alterar fatos. Usado pelo diretor no modal de detalhes.

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
    const textoOpcional: string | undefined = body?.texto
    if (!reportId) return json(400, { error: 'report_id obrigatório' })

    const { data: report, error: rErr } = await supabase
      .from('error_reports')
      .select('id, area, descricao, reporter_nome, observacao_diretor')
      .eq('id', reportId)
      .maybeSingle()
    if (rErr || !report) return json(404, { error: 'Relato não encontrado' })

    const textoBase = (textoOpcional ?? report.descricao ?? '').trim()
    if (!textoBase) return json(400, { error: 'Texto vazio' })

    const systemPrompt = `Você é um assistente que reescreve relatos de bugs de um sistema interno (CRM/operações de uma associação de proteção veicular).
Stack do sistema: React 18 + Vite + Tailwind + Supabase.
Reescreva o texto a seguir mantendo TODOS os fatos, datas, nomes, valores e passos exatamente como descritos.
Apenas:
- corrija ortografia/gramática,
- estruture em "Passos para reproduzir", "Comportamento esperado", "Comportamento atual" quando possível,
- use termos técnicos quando o original for vago,
- preserve o tom (não invente nada que não esteja no original).
Responda APENAS com o texto melhorado, sem cabeçalho, sem aspas, sem markdown extra.`

    const userPrompt = `Área: ${report.area}\nAutor: ${report.reporter_nome ?? 'desconhecido'}\n\nTexto original:\n"""\n${textoBase}\n"""`

    const aiResp = await aiGatewayFetch({
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
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
    const texto = aiJson?.choices?.[0]?.message?.content?.trim?.() ?? ''
    if (!texto) return json(500, { error: 'Resposta vazia da IA' })

    return json(200, { texto_melhorado: texto })
  } catch (e: any) {
    console.error('melhorar-texto-relato-erro:', e)
    return json(500, { error: e?.message ?? 'Erro inesperado' })
  }
})
