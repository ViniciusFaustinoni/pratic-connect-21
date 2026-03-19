import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch pending solicitações that exceeded deadline
    const { data: pendentes, error: fetchError } = await supabase
      .from('solicitacoes_migracao')
      .select('id, created_at, prazo_resposta_horas, associado_nome, associado_cpf')
      .eq('status', 'pendente');

    if (fetchError) throw fetchError;

    const now = new Date();
    const vencidas = (pendentes || []).filter(s => {
      const deadline = new Date(new Date(s.created_at).getTime() + s.prazo_resposta_horas * 60 * 60 * 1000);
      return now > deadline;
    });

    if (vencidas.length === 0) {
      console.log('[cron-migracao-prazo] Nenhuma solicitação vencida.');
      return new Response(JSON.stringify({ message: 'Nenhuma vencida', count: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // For each overdue, check if alert already exists
    const vencidasIds = vencidas.map(v => v.id);
    const { data: alertasExistentes } = await supabase
      .from('notificacoes')
      .select('referencia_id')
      .eq('referencia_tipo', 'migracao_prazo_vencido')
      .in('referencia_id', vencidasIds);

    const idsJaAlertados = new Set((alertasExistentes || []).map(a => a.referencia_id));
    const novasVencidas = vencidas.filter(v => !idsJaAlertados.has(v.id));

    if (novasVencidas.length === 0) {
      console.log('[cron-migracao-prazo] Todas já alertadas.');
      return new Response(JSON.stringify({ message: 'Já alertadas', count: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Calculate time info
    const maisAntiga = novasVencidas.reduce((oldest, curr) => {
      return new Date(curr.created_at) < new Date(oldest.created_at) ? curr : oldest;
    });
    const horasAtraso = Math.round((now.getTime() - new Date(maisAntiga.created_at).getTime() - maisAntiga.prazo_resposta_horas * 60 * 60 * 1000) / (1000 * 60 * 60));

    // Fetch directors and managers
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['diretor', 'gerente_comercial']);

    const targetUserIds = [...new Set((rolesData || []).map(r => r.user_id))];

    if (targetUserIds.length === 0) {
      console.log('[cron-migracao-prazo] Nenhum destinatário encontrado.');
      return new Response(JSON.stringify({ message: 'Sem destinatários', count: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create notifications — one per overdue solicitação per user
    const notificacoes = novasVencidas.flatMap(v =>
      targetUserIds.map(userId => ({
        user_id: userId,
        titulo: 'Migrações em Atraso',
        mensagem: `Há ${novasVencidas.length} solicitação(ões) de migração pendente(s) além do prazo. A mais antiga está ${horasAtraso}h em atraso (${v.associado_nome || v.associado_cpf}).`,
        tipo: 'migracao',
        modulo: 'cadastro',
        referencia_tipo: 'migracao_prazo_vencido',
        referencia_id: v.id,
        link: '/cadastro/migracoes',
      }))
    );

    const { error: insertError } = await supabase
      .from('notificacoes')
      .insert(notificacoes);

    if (insertError) throw insertError;

    console.log(`[cron-migracao-prazo] ${notificacoes.length} alertas criados para ${novasVencidas.length} solicitações vencidas.`);

    return new Response(
      JSON.stringify({ message: 'Alertas criados', count: notificacoes.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[cron-migracao-prazo] Erro:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
