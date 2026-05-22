// Abre (ou reusa) um serviço de instalação para um veículo com cobertura
// suspensa por falta de instalação, permitindo que o Coordenador de
// Monitoramento execute a vistoria internamente. A conclusão segue o caminho
// canônico (concluir-instalacao-prestador → fn_reativar_cobertura_pos_instalacao).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ROLES_PERMITIDAS = new Set([
  'coordenador_monitoramento',
  'diretor',
  'admin_master',
  'desenvolvedor',
]);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const supaUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userRes, error: userErr } = await supaUser.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userRes.user.id;

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Checa role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    const okRole = (roles ?? []).some((r: any) => ROLES_PERMITIDAS.has(r.role));
    if (!okRole) {
      return new Response(JSON.stringify({ error: 'forbidden_role' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const veiculoId = String(body?.veiculoId ?? '');
    if (!veiculoId) {
      return new Response(JSON.stringify({ error: 'veiculoId obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Veículo + estado de suspensão
    const { data: veiculo, error: vErr } = await supabase
      .from('veiculos')
      .select('id, placa, associado_id, status, cobertura_suspensa, cobertura_suspensa_motivo')
      .eq('id', veiculoId)
      .maybeSingle();
    if (vErr || !veiculo) {
      return new Response(JSON.stringify({ error: 'veiculo_nao_encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!veiculo.cobertura_suspensa) {
      return new Response(JSON.stringify({ error: 'veiculo_nao_suspenso' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Reusa serviço aberto se houver
    const { data: svcAberto } = await supabase
      .from('servicos')
      .select('id, tipo, status')
      .eq('veiculo_id', veiculoId)
      .in('tipo', ['instalacao', 'vistoria_entrada'])
      .not('status', 'in', '(concluida,aprovada,reprovada,aprovada_ressalvas,cancelada)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (svcAberto) {
      return new Response(JSON.stringify({
        success: true, servicoId: svcAberto.id, reused: true,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Contrato ativo
    const { data: contrato } = await supabase
      .from('contratos')
      .select('id, associado_id, cotacao_id, cep, logradouro, numero, bairro, cidade, uf, latitude, longitude')
      .eq('veiculo_id', veiculoId)
      .not('status', 'in', '(cancelado,reprovado)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!contrato) {
      return new Response(JSON.stringify({ error: 'contrato_nao_encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Reusa instalação aberta ou cria nova
    const { data: instExist } = await supabase
      .from('instalacoes')
      .select('id, status')
      .eq('veiculo_id', veiculoId)
      .not('status', 'in', '(concluida,cancelada)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let instalacaoId = instExist?.id ?? null;

    if (!instalacaoId) {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data: instNova, error: instErr } = await supabase
        .from('instalacoes')
        .insert({
          associado_id: contrato.associado_id,
          veiculo_id: veiculoId,
          contrato_id: contrato.id,
          cotacao_id: contrato.cotacao_id,
          data_agendada: hoje,
          periodo: 'manha',
          status: 'agendada',
          cep: contrato.cep, logradouro: contrato.logradouro, numero: contrato.numero,
          bairro: contrato.bairro, cidade: contrato.cidade, uf: contrato.uf,
          endereco_latitude: contrato.latitude, endereco_longitude: contrato.longitude,
          local_vistoria: 'cliente',
        })
        .select('id')
        .single();
      if (instErr || !instNova) {
        console.error('[abrir-servico-instalacao-suspenso] erro instalacao', instErr);
        return new Response(JSON.stringify({ error: 'falha_criar_instalacao', detalhe: instErr?.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      instalacaoId = instNova.id;
    }

    // Cria serviço vinculado, atribuído ao próprio Coordenador
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: svc, error: svcErr } = await supabase
      .from('servicos')
      .insert({
        tipo: 'instalacao',
        status: 'agendada',
        data_agendada: hoje,
        periodo: 'manha',
        associado_id: contrato.associado_id,
        veiculo_id: veiculoId,
        contrato_id: contrato.id,
        cotacao_id: contrato.cotacao_id,
        profissional_id: userId,
        instalacao_origem_id: instalacaoId,
        cep: contrato.cep, logradouro: contrato.logradouro, numero: contrato.numero,
        bairro: contrato.bairro, cidade: contrato.cidade, uf: contrato.uf,
        latitude: contrato.latitude, longitude: contrato.longitude,
        local_vistoria: 'cliente',
        origem: 'vistoria_interna_coordenador_suspenso',
      })
      .select('id')
      .single();

    if (svcErr || !svc) {
      console.error('[abrir-servico-instalacao-suspenso] erro servico', svcErr);
      return new Response(JSON.stringify({ error: 'falha_criar_servico', detalhe: svcErr?.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('logs_auditoria').insert({
      usuario_id: userId,
      acao: 'abrir_servico_vistoria_interna_suspenso',
      tabela: 'servicos',
      entidade_id: svc.id,
      modulo: 'monitoramento',
      descricao: `Coordenador abriu vistoria interna para veículo suspenso ${veiculo.placa}`,
      dados_novos: {
        veiculo_id: veiculoId,
        placa: veiculo.placa,
        instalacao_id: instalacaoId,
        motivo_suspensao: veiculo.cobertura_suspensa_motivo,
      },
    });

    return new Response(JSON.stringify({
      success: true, servicoId: svc.id, instalacaoId, reused: false,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[abrir-servico-instalacao-suspenso] erro fatal', e);
    return new Response(JSON.stringify({ error: 'erro_interno', detalhe: e?.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
