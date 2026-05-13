// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ROLES_PERMITIDOS = new Set([
  'diretoria',
  'analista_monitoramento',
  'coordenador_monitoramento',
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Autenticação: validar JWT do chamador
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerAuthId = userData.user.id;

    // Recuperar profile + role do chamador
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nome, role')
      .eq('user_id', callerAuthId)
      .maybeSingle();
    if (!profile) {
      return new Response(JSON.stringify({ error: 'Perfil não encontrado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!ROLES_PERMITIDOS.has((profile.role || '').toLowerCase())) {
      return new Response(JSON.stringify({ error: 'Permissão negada. Apenas Analista/Coordenador de Monitoramento ou Diretoria.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Body
    const body = await req.json().catch(() => ({}));
    const contrato_id: string | undefined = body?.contrato_id;
    const motivoOperador: string = (body?.motivo || '').toString().slice(0, 500);
    if (!contrato_id) {
      return new Response(JSON.stringify({ error: 'contrato_id é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Carregar prazos para registrar a UF correta
    const { data: cfgs } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', [
        'prazo_instalacao_autovistoria_horas',
        'prazo_instalacao_horas_rj',
        'prazo_instalacao_horas_sp',
      ]);
    const cfgMap = Object.fromEntries((cfgs ?? []).map(c => [c.chave, c.valor]));
    const prazoDefault = Math.max(1, parseInt(cfgMap['prazo_instalacao_autovistoria_horas'] ?? '72', 10) || 72);
    const prazoRJ = Math.max(1, parseInt(cfgMap['prazo_instalacao_horas_rj'] ?? '48', 10) || 48);
    const prazoSP = Math.max(1, parseInt(cfgMap['prazo_instalacao_horas_sp'] ?? '72', 10) || 72);

    // Validar contrato
    const { data: contrato } = await supabase
      .from('contratos')
      .select('id, veiculo_id, associado_id, status, data_assinatura, liberado_reagendamento_em')
      .eq('id', contrato_id)
      .maybeSingle();
    if (!contrato) {
      return new Response(JSON.stringify({ error: 'Contrato não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!['assinado', 'ativo'].includes(contrato.status)) {
      return new Response(JSON.stringify({ error: `Contrato em status ${contrato.status} não pode ser suspenso por não-instalação` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!contrato.veiculo_id) {
      return new Response(JSON.stringify({ error: 'Contrato sem veículo vinculado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Bloquear se já há instalação concluída/dispensada
    const { data: instalacaoConcluida } = await supabase
      .from('instalacoes')
      .select('id')
      .eq('contrato_id', contrato.id)
      .or('status.eq.concluida,concluida_em.not.is.null,dispensa_rastreador.eq.true')
      .limit(1);
    if ((instalacaoConcluida?.length ?? 0) > 0) {
      return new Response(JSON.stringify({ error: 'Já existe instalação concluída ou dispensada para este contrato' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: servicoConcluido } = await supabase
      .from('servicos')
      .select('id')
      .eq('veiculo_id', contrato.veiculo_id)
      .eq('tipo', 'instalacao')
      .eq('status', 'concluida')
      .limit(1);
    if ((servicoConcluido?.length ?? 0) > 0) {
      return new Response(JSON.stringify({ error: 'Já existe serviço de instalação concluído para este veículo' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: assoc } = await supabase
      .from('associados')
      .select('id, nome, telefone, uf')
      .eq('id', contrato.associado_id)
      .maybeSingle();
    const uf = (assoc?.uf || '').toUpperCase() || null;
    const prazoHoras = uf === 'RJ' ? prazoRJ : uf === 'SP' ? prazoSP : prazoDefault;

    const { data: veiculo } = await supabase
      .from('veiculos')
      .select('id, placa, modelo, cobertura_suspensa')
      .eq('id', contrato.veiculo_id)
      .maybeSingle();
    if (!veiculo) {
      return new Response(JSON.stringify({ error: 'Veículo não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (veiculo.cobertura_suspensa) {
      return new Response(JSON.stringify({ error: 'Cobertura já está suspensa' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Suspender — mesmo formato canônico do cron
    const motivoBase = `Instalação não realizada no prazo de ${prazoHoras}h após assinatura`;
    const motivoCompleto = `${motivoBase} (marcado manualmente por ${profile.nome})`;

    await supabase
      .from('veiculos')
      .update({
        cobertura_suspensa: true,
        cobertura_suspensa_motivo: motivoCompleto,
        cobertura_suspensa_em: new Date().toISOString(),
        cobertura_total: false,
        cobertura_roubo_furto: false,
      })
      .eq('id', contrato.veiculo_id);

    // WhatsApp (mesma mensagem do cron)
    try {
      if (assoc?.telefone) {
        const nomePrimeiro = assoc.nome?.split(' ')[0] ?? 'Associado';
        const placaRef = veiculo.placa ?? veiculo.modelo ?? '---';
        await supabase.functions.invoke('whatsapp-send-text', {
          body: {
            telefone: assoc.telefone,
            mensagem: `Olá ${nomePrimeiro}! ⚠️ Cobertura (Roubo e Furto) suspensa - instalação não realizada em ${prazoHoras}h.`,
            template_name: 'suspensao_cobertura_nao_instalacao_v1',
            template_params: [nomePrimeiro, String(placaRef), String(prazoHoras)],
            referencia_tipo: 'contrato',
            referencia_id: contrato.id,
          },
        });
      }
    } catch (e) {
      console.error('[suspender-manual] Falha ao notificar WhatsApp', e);
    }

    // Auditoria
    await supabase.from('logs_auditoria').insert({
      usuario_id: profile.id,
      usuario_nome: profile.nome,
      acao: 'suspensao_manual',
      modulo: 'monitoramento',
      descricao: `Cobertura suspensa manualmente por não-instalação (${prazoHoras}h, UF=${uf ?? 'N/D'})`,
      dados_novos: {
        contrato_id: contrato.id,
        veiculo_id: contrato.veiculo_id,
        placa: veiculo.placa,
        prazo_horas: prazoHoras,
        uf,
        motivo_operador: motivoOperador || null,
      },
    });

    try {
      await supabase.from('associados_historico').insert({
        associado_id: contrato.associado_id,
        tipo: 'suspensao_cobertura_instalacao',
        descricao: `Cobertura suspensa manualmente por ${profile.nome}: instalação não realizada no prazo de ${prazoHoras}h (UF=${uf ?? 'N/D'})${motivoOperador ? ` — ${motivoOperador}` : ''}`,
        dados_novos: {
          contrato_id: contrato.id,
          veiculo_id: contrato.veiculo_id,
          placa: veiculo.placa,
          prazo_horas: prazoHoras,
          uf,
          origem: 'manual',
          operador_id: profile.id,
          operador_nome: profile.nome,
          motivo_operador: motivoOperador || null,
        },
      });
    } catch (e) {
      console.error('[suspender-manual] Falha ao registrar historico', e);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        contrato_id: contrato.id,
        veiculo_id: contrato.veiculo_id,
        prazo_horas: prazoHoras,
        uf,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[suspender-manual] Erro', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
