import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Test Hinova API connection
    let conexaoOk = false;
    let tempoMs = 0;
    let erroMensagem: string | null = null;

    const hinovaUser = Deno.env.get('HINOVA_USUARIO');
    const hinovaSenha = Deno.env.get('HINOVA_SENHA');

    if (!hinovaUser || !hinovaSenha) {
      erroMensagem = 'Credenciais Hinova não configuradas';
    } else {
      const start = Date.now();
      try {
        const authResp = await fetch('https://api.hinova.com.br/api/sga/v2/usuario/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuario: hinovaUser, senha: hinovaSenha }),
        });
        tempoMs = Date.now() - start;
        if (authResp.ok) {
          const authData = await authResp.json();
          conexaoOk = !!authData?.token_usuario;
          if (!conexaoOk) erroMensagem = 'Token não retornado pela API';
        } else {
          erroMensagem = `API retornou status ${authResp.status}`;
        }
      } catch (e) {
        tempoMs = Date.now() - start;
        erroMensagem = `Erro de rede: ${e.message}`;
      }
    }

    // 2. Count queue items
    const { count: pendentes } = await supabase
      .from('sga_sync_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pendente');

    const { count: falhas } = await supabase
      .from('sga_sync_queue')
      .select('id', { count: 'exact', head: true })
      .in('status', ['falha', 'falha_permanente']);

    // 3. Count unsynced active vehicles
    const { count: naoSincronizados } = await supabase
      .from('veiculos')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ativo')
      .eq('sincronizado_hinova', false);

    // 4. Store result
    await supabase.from('sga_health_checks').insert({
      conexao_ok: conexaoOk,
      tempo_resposta_ms: tempoMs,
      fila_pendentes: pendentes || 0,
      fila_falhas: falhas || 0,
      veiculos_nao_sincronizados: naoSincronizados || 0,
      erro_mensagem: erroMensagem,
    });

    // 5. Notify admins if issues detected
    const hasIssues = !conexaoOk || (falhas || 0) > 5;
    if (hasIssues) {
      const mensagem = !conexaoOk
        ? `⚠️ SGA Hinova: Conexão com API falhou. ${erroMensagem}`
        : `⚠️ SGA Hinova: ${falhas} itens com falha na fila de sincronização`;

      // Get admin user IDs
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'diretor');

      if (admins && admins.length > 0) {
        const notifs = admins.map((a: any) => ({
          user_id: a.user_id,
          titulo: 'Alerta SGA Hinova',
          mensagem,
          tipo: 'alerta',
          link: '/configuracoes/integracoes/sga-hinova',
        }));
        await supabase.from('notificacoes').insert(notifs);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      conexao_ok: conexaoOk,
      fila_pendentes: pendentes,
      fila_falhas: falhas,
      veiculos_nao_sincronizados: naoSincronizados,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[cron-sga-health-check] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
