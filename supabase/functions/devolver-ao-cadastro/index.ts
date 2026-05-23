// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { insertAuditLog } from '../_shared/auditLog.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    // ---- Auth (identifica quem está devolvendo) ----
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: claimsRes, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsRes?.claims) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const userId: string = claimsRes.claims.sub;

    // ---- Body ----
    const body = await req.json().catch(() => ({}));
    const contrato_id: string | undefined = body?.contrato_id;
    const motivo: string = (body?.motivo || '').toString().slice(0, 1000);
    if (!contrato_id) return json({ error: 'contrato_id é obrigatório' }, 400);

    const supabase = createClient(supabaseUrl, supabaseService);

    // ---- Carrega contrato ----
    const { data: contrato, error: errContrato } = await supabase
      .from('contratos')
      .select('id, status, cadastro_aprovado, aprovado_por, aprovado_em, cotacao_id, associado_id, veiculo_id')
      .eq('id', contrato_id)
      .maybeSingle();
    if (errContrato) return json({ error: errContrato.message }, 500);
    if (!contrato) return json({ error: 'Contrato não encontrado' }, 404);

    // ---- Idempotência ----
    if (contrato.cadastro_aprovado === false) {
      return json({ ok: true, contrato_id, noop: true, novo_status_contratacao: 'aguardando_aprovacao_cadastro' });
    }

    // ---- Perfil do ator (para logs) ----
    let usuarioNome: string | null = null;
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('nome')
        .eq('user_id', userId)
        .maybeSingle();
      usuarioNome = (prof as any)?.nome ?? null;
    } catch (_) { /* não-bloqueante */ }

    const snapshotAntes = {
      cadastro_aprovado: contrato.cadastro_aprovado,
      aprovado_por: contrato.aprovado_por,
      aprovado_em: contrato.aprovado_em,
      status: contrato.status,
    };

    // ---- Reverte contrato (trigger trg_protege_cadastro_aprovado exige aprovado_por e aprovado_em nulos) ----
    const { error: errUpdate } = await supabase
      .from('contratos')
      .update({
        cadastro_aprovado: false,
        aprovado_por: null,
        aprovado_em: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contrato_id);
    if (errUpdate) {
      const msg = errUpdate.message || '';
      if (msg.includes('cadastro_aprovado_protegido')) {
        return json({ error: 'cadastro_aprovado_protegido', detail: msg }, 409);
      }
      return json({ error: msg }, 500);
    }

    // ---- Reabre cotação para a fila do Cadastro ----
    if (contrato.cotacao_id) {
      const { error: errCot } = await supabase
        .from('cotacoes')
        .update({
          status_contratacao: 'aguardando_aprovacao_cadastro',
          updated_at: new Date().toISOString(),
        })
        .eq('id', contrato.cotacao_id);
      if (errCot) {
        console.warn('[devolver-ao-cadastro] Falha ao atualizar cotação (não-bloqueante):', errCot.message);
      }
    }

    // ---- Auditoria ----
    try {
      await insertAuditLog(supabase as any, {
        usuario_id: userId,
        usuario_nome: usuarioNome,
        acao: 'devolver_ao_cadastro',
        modulo: 'monitoramento',
        tabela: 'contratos',
        registro_id: contrato_id,
        dados_anteriores: snapshotAntes,
        dados_novos: {
          cadastro_aprovado: false,
          aprovado_por: null,
          aprovado_em: null,
        },
        descricao: motivo
          ? `Caso devolvido ao Cadastro: ${motivo}`
          : 'Caso devolvido ao Cadastro pelo Monitoramento (autovistoria opcional acima FIPE / sem instalação técnica concluída).',
      });
    } catch (e) {
      console.warn('[devolver-ao-cadastro] Falha não-bloqueante ao gravar auditoria:', (e as Error).message);
    }

    return json({
      ok: true,
      contrato_id,
      novo_status_contratacao: 'aguardando_aprovacao_cadastro',
    });
  } catch (e) {
    console.error('[devolver-ao-cadastro] Erro:', e);
    return json({ error: (e as Error).message || 'Erro interno' }, 500);
  }
});
