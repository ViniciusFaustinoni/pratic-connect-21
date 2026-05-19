// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body {
  contrato_ids: string[];
  motivo: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('profiles').select('id, nome').eq('user_id', userRes.user.id).maybeSingle();
    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile não encontrado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json() as Body;
    const ids = (body.contrato_ids ?? []).filter(Boolean);
    const motivo = (body.motivo ?? '').trim();
    if (!ids.length) {
      return new Response(JSON.stringify({ error: 'contrato_ids vazio' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (motivo.length < 10) {
      return new Response(JSON.stringify({ error: 'Motivo obrigatório (mínimo 10 caracteres)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const agora = new Date().toISOString();

    const { data: contratos, error: errC } = await supabase
      .from('contratos')
      .select('id, veiculo_id, associado_id, cotacao_id, status')
      .in('id', ids);
    if (errC) throw errC;

    const veiculoIds = (contratos ?? []).map((c: any) => c.veiculo_id).filter(Boolean) as string[];
    const cotacaoIds = (contratos ?? []).map((c: any) => c.cotacao_id).filter(Boolean) as string[];
    const associadoIds = [...new Set((contratos ?? []).map((c: any) => c.associado_id).filter(Boolean))] as string[];

    // 1) Cancelar contratos
    await supabase
      .from('contratos')
      .update({ status: 'cancelado', data_cancelamento: agora })
      .in('id', ids);

    // 2) Cancelar cotações vinculadas (não terminais)
    if (cotacaoIds.length) {
      await supabase
        .from('cotacoes')
        .update({ status: 'cancelada' } as any)
        .in('id', cotacaoIds)
        .not('status', 'in', '(cancelada,convertida,perdida)');
    }

    // 3) Manter cobertura suspensa, atualizando o motivo
    if (veiculoIds.length) {
      await supabase
        .from('veiculos')
        .update({
          cobertura_suspensa: true,
          cobertura_suspensa_motivo: 'Adesão cancelada — não instalou no prazo',
          cobertura_suspensa_em: agora,
          cobertura_roubo_furto: false,
          cobertura_total: false,
        } as any)
        .in('id', veiculoIds);
    }

    // 4) Cancelar instalações/serviços/agendamentos abertos vinculados aos veículos
    if (veiculoIds.length) {
      const { data: instalacoes } = await supabase
        .from('instalacoes').select('id').in('veiculo_id', veiculoIds);
      const instalacaoIds = (instalacoes ?? []).map((i: any) => i.id);

      if (instalacaoIds.length) {
        await supabase
          .from('servicos')
          .update({ status: 'cancelada' } as any)
          .in('instalacao_origem_id', instalacaoIds)
          .not('status', 'in', '(concluida,aprovada,reprovada,cancelada,aprovada_ressalvas)');

        await supabase
          .from('agendamentos_base')
          .update({ status: 'cancelada' } as any)
          .in('instalacao_origem_id', instalacaoIds)
          .not('status', 'in', '(concluida,cancelada)');

        await supabase
          .from('instalacoes')
          .update({ status: 'cancelada' } as any)
          .in('id', instalacaoIds)
          .not('status', 'in', '(concluida,cancelada)');
      }
    }

    // 5) Cancelar associado se não houver outros contratos vivos
    for (const associadoId of associadoIds) {
      const { count } = await supabase
        .from('contratos')
        .select('id', { count: 'exact', head: true })
        .eq('associado_id', associadoId)
        .in('status', ['ativo', 'assinado', 'pendente_assinatura', 'visualizado']);
      if ((count ?? 0) === 0) {
        await supabase.from('associados').update({ status: 'cancelado' } as any).eq('id', associadoId);
      }
    }

    // 6) WhatsApp ao associado
    for (const c of contratos ?? []) {
      try {
        const { data: assoc } = await supabase
          .from('associados').select('nome, telefone').eq('id', c.associado_id).maybeSingle();
        if (!assoc?.telefone) continue;

        const msg =
          `Olá ${assoc.nome?.split(' ')[0] ?? ''}.\n\n` +
          `Informamos que sua adesão foi *cancelada* pelo nosso time de monitoramento, ` +
          `pois a instalação do rastreador não foi realizada dentro do prazo.\n\n` +
          `Motivo: ${motivo}\n\n` +
          `Caso queira retomar a proteção, entre em contato conosco para iniciar uma nova adesão.`;

        await supabase.functions.invoke('enviar-whatsapp', {
          body: { telefone: assoc.telefone, mensagem: msg, associado_id: c.associado_id, tipo: 'cancelamento_nao_instalacao' },
        });
      } catch (e) {
        console.error('[cancelar-adesao] erro WhatsApp', e);
      }
    }

    // 7) Auditoria
    await supabase.from('logs_auditoria').insert({
      usuario_id: profile.id,
      usuario_nome: profile.nome,
      acao: 'cancelamento_nao_instalacao',
      modulo: 'monitoramento',
      descricao: `Cancelou ${ids.length} adesão(ões) por não instalação no prazo`,
      dados_novos: { contrato_ids: ids, motivo },
    });

    return new Response(JSON.stringify({ cancelados: ids.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[cancelar-adesao] erro', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
