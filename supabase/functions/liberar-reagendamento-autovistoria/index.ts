// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body {
  contrato_ids: string[];
  motivo?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth do chamador
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('id, nome, tipo')
      .eq('user_id', userRes.user.id)
      .maybeSingle();
    if (profErr) console.error('[liberar-autovistoria] profile error', profErr);

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile não encontrado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json() as Body;
    const ids = (body.contrato_ids ?? []).filter(Boolean);
    if (!ids.length) {
      return new Response(JSON.stringify({ error: 'contrato_ids vazio' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const motivo = body.motivo?.trim() || null;
    const liberadoEm = new Date().toISOString();

    const { data: contratos, error: errC } = await supabase
      .from('contratos')
      .select('id, veiculo_id, associado_id, cotacao_id')
      .in('id', ids);
    if (errC) throw errC;

    const veiculoIds = (contratos ?? []).map(c => c.veiculo_id).filter(Boolean) as string[];
    const cotacaoIds = (contratos ?? []).map(c => c.cotacao_id).filter(Boolean) as string[];

    // 1) reativar fluxo no contrato (limpar agenda anterior + marcar liberação)
    await supabase
      .from('contratos')
      .update({
        liberado_reagendamento_em: liberadoEm,
        liberado_reagendamento_por: profile.id,
        liberado_reagendamento_motivo: motivo,
        vistoria_completa_data_agendada: null,
        vistoria_completa_horario_agendado: null,
      })
      .in('id', ids);

    // 1b) limpar agenda também na cotação (a tela pública lê de cotacoes)
    if (cotacaoIds.length) {
      await supabase
        .from('cotacoes')
        .update({
          vistoria_completa_data_agendada: null,
          vistoria_completa_horario_agendado: null,
        })
        .in('id', cotacaoIds);
    }

    // 2) reativar cobertura do veículo (volta à condição de pré-instalação:
    //    cobertura roubo/furto liberada após autovistoria, total apenas após instalar)
    if (veiculoIds.length) {
      await supabase
        .from('veiculos')
        .update({
          cobertura_suspensa: false,
          cobertura_suspensa_motivo: null,
          cobertura_suspensa_em: null,
          cobertura_roubo_furto: true,
          cobertura_total: false,
        })
        .in('id', veiculoIds);
    }

    // Buscar token público da cotação para link do WhatsApp
    const tokenByCotacao = new Map<string, string>();
    if (cotacaoIds.length) {
      const { data: cots } = await supabase
        .from('cotacoes').select('id, token_publico').in('id', cotacaoIds);
      (cots ?? []).forEach(c => { if (c.token_publico) tokenByCotacao.set(c.id, c.token_publico); });
    }

    // 3) notificar associados via WhatsApp
    for (const c of contratos ?? []) {
      try {
        const { data: assoc } = await supabase
          .from('associados')
          .select('nome, telefone')
          .eq('id', c.associado_id)
          .maybeSingle();
        if (!assoc?.telefone) continue;

        const token = c.cotacao_id ? tokenByCotacao.get(c.cotacao_id) : null;
        const link = token
          ? `https://app.praticcar.org/cotacao/${token}`
          : 'https://app.praticcar.org';

        const msg =
          `Olá ${assoc.nome?.split(' ')[0] ?? ''}! ✅\n\n` +
          `Boas notícias: nosso time de monitoramento *liberou seu cadastro* para reagendar a vistoria/instalação do rastreador.\n\n` +
          `Acesse o link para escolher uma nova data:\n${link}\n\n` +
          `Após a instalação, sua *Proteção 360* será reativada automaticamente. 🚗🛡️`;

        await supabase.functions.invoke('enviar-whatsapp', {
          body: { telefone: assoc.telefone, mensagem: msg, associado_id: c.associado_id, tipo: 'liberacao_autovistoria' },
        });
      } catch (e) {
        console.error('[liberar-autovistoria] erro WhatsApp', e);
      }
    }

    // 4) auditoria
    await supabase.from('logs_auditoria').insert({
      usuario_id: profile.id,
      usuario_nome: profile.nome,
      acao: 'liberacao_reagendamento',
      modulo: 'monitoramento',
      descricao: `Liberou ${ids.length} contrato(s) suspenso(s) por auto-vistoria sem instalação`,
      dados_novos: { contrato_ids: ids, motivo },
    });

    return new Response(JSON.stringify({ liberados: ids.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[liberar-autovistoria] erro', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
