// Reprovação (cadastro ou monitoramento) — registra motivo
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { sendMetaTemplate } from '../_shared/send-meta-template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { solicitacao_id, motivo, etapa } = await req.json();
    // etapa: 'cadastro' | 'monitoramento'
    if (!solicitacao_id || !motivo || !['cadastro', 'monitoramento'].includes(etapa)) {
      return new Response(JSON.stringify({ error: 'parâmetros inválidos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader }}});
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const novoStatus = etapa === 'cadastro' ? 'reprovada_cadastro' : 'reprovada_monitoramento';

    const { error } = await admin
      .from('solicitacoes_troca_titularidade')
      .update({
        status: novoStatus,
        motivo_reprovacao: motivo,
        reprovado_por: user.id,
        reprovado_em: new Date().toISOString(),
      })
      .eq('id', solicitacao_id);
    if (error) throw error;

    // ── WhatsApp: avisar associado antigo da reprovação ──
    try {
      const { data: sol } = await admin
        .from('solicitacoes_troca_titularidade')
        .select('associado_antigo_id, veiculo_id')
        .eq('id', solicitacao_id)
        .maybeSingle();
      if (sol?.associado_antigo_id) {
        const [{ data: assoc }, { data: veic }] = await Promise.all([
          admin.from('associados').select('nome, telefone').eq('id', sol.associado_antigo_id).maybeSingle(),
          sol.veiculo_id
            ? admin.from('veiculos').select('marca, modelo, placa').eq('id', sol.veiculo_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        if (assoc?.telefone) {
          const veicLabel = veic ? `${veic.marca || ''} ${veic.modelo || ''} (${veic.placa || ''})`.trim() : 'veículo';
          await sendMetaTemplate({
            supabase: admin,
            telefone: assoc.telefone,
            templateName: 'troca_titularidade_reprovada',
            templateParams: [
              String(assoc.nome || 'Associado').split(' ')[0],
              veicLabel,
              String(motivo).substring(0, 200),
            ],
            referenciaTipo: 'troca_titularidade',
            referenciaId: solicitacao_id,
            tag: '[reprovar-troca]',
          });
        }
      }
    } catch (waErr) {
      console.warn('[reprovar-troca] envio whatsapp falhou (não bloqueante):', waErr);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
