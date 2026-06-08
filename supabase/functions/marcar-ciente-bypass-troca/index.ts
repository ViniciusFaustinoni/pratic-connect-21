// Edge: marcar-ciente-bypass-troca
// Marca um registro de aprovacoes_bypass_troca como 'ciente' (não-bloqueante;
// apenas sinaliza que o time Comercial viu o bypass do Cadastro).
// Loga em logs_auditoria com prefixo [BYPASS_TROCA_CIENTE].

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === 'string' ? body.id : null;
    const observacao = typeof body?.observacao === 'string' ? body.observacao.trim() : '';
    if (!id) {
      return new Response(JSON.stringify({ error: 'id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: row, error: selErr } = await admin
      .from('aprovacoes_bypass_troca')
      .select('id, status, tipo, contrato_id, cotacao_id, placa, nome_autorizador')
      .eq('id', id)
      .maybeSingle();
    if (selErr || !row) {
      return new Response(JSON.stringify({ error: 'Registro não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if ((row as any).status === 'ciente') {
      return new Response(JSON.stringify({ success: true, already: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updErr } = await admin
      .from('aprovacoes_bypass_troca')
      .update({
        status: 'ciente',
        ciente_por: user.id,
        ciente_em: new Date().toISOString(),
        observacao_supervisor: observacao || null,
      })
      .eq('id', id);
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const { data: prof } = await admin
        .from('profiles').select('nome').eq('user_id', user.id).maybeSingle();
      const nome = (prof as any)?.nome || user.email || 'comercial';
      await admin.from('logs_auditoria').insert([{
        usuario_id: user.id,
        usuario_nome: nome,
        acao: 'atualizar',
        modulo: 'cotacoes',
        descricao: `[BYPASS_TROCA_CIENTE] Aprovação ${id} (${(row as any).tipo}) marcada como ciente.`,
        tabela: 'aprovacoes_bypass_troca',
        registro_id: id,
        dados_novos: {
          ciente_por: user.id,
          ciente_por_nome: nome,
          observacao: observacao || null,
          tipo: (row as any).tipo,
          contrato_id: (row as any).contrato_id,
          cotacao_id: (row as any).cotacao_id,
          placa: (row as any).placa,
          nome_autorizador: (row as any).nome_autorizador,
        },
      }]);
    } catch (e) {
      console.error('[marcar-ciente-bypass-troca] falha em logs_auditoria:', e);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[marcar-ciente-bypass-troca] erro:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
