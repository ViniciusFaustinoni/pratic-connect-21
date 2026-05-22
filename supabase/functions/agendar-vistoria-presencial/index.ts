import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AgendarVistoriaPresencialRequest {
  cotacaoId: string;
  dataAgendada: string;
  horarioAgendado: string; // Agora recebe 'manha' ou 'tarde' (período)
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    estado: string;
  };
  responsavel: {
    euMesmo: boolean;
    nome?: string;
    telefone?: string;
  };
  latitude?: number | null;
  longitude?: number | null;
  permiteEncaixe?: boolean;
}

// Limite de vagas por período
const LIMITE_VAGAS_POR_PERIODO = 10;

// Mapeia período canônico para hora interna (consistência com agendamentos_base)
function periodoParaHora(periodo: string): string {
  if (periodo === 'manha') return '08:00:00';
  if (periodo === 'tarde') return '13:00:00';
  return periodo;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const body: AgendarVistoriaPresencialRequest = await req.json();
    const { cotacaoId, dataAgendada, horarioAgendado, endereco, responsavel, latitude, longitude, permiteEncaixe } = body;
    const periodoAgendado = horarioAgendado;

    console.log('[AgendarVistoriaPresencial] Iniciando para cotação:', cotacaoId, 'período:', periodoAgendado);

    // ── VALIDAR VAGAS ──────────────────────────────────────────
    const { data: servicosExistentes, error: servicosError } = await supabase
      .from('servicos')
      .select('id')
      .eq('data_agendada', dataAgendada)
      .eq('periodo', periodoAgendado)
      .eq('local_vistoria', 'cliente')
      .not('status', 'in', '("cancelada")');

    if (servicosError) {
      console.error('[AgendarVistoriaPresencial] Erro ao verificar vagas:', servicosError);
    }

    const vagasOcupadas = servicosExistentes?.length || 0;
    if (vagasOcupadas >= LIMITE_VAGAS_POR_PERIODO) {
      return new Response(JSON.stringify({
        success: false,
        error: `Período ${periodoAgendado === 'manha' ? 'da manhã' : 'da tarde'} esgotado para esta data. Por favor, escolha outro período ou data.`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── 0. IDEMPOTÊNCIA: instalação já existente ───────────────
    const { data: instalacaoExistente } = await supabase
      .from('instalacoes')
      .select('id, status')
      .eq('cotacao_id', cotacaoId)
      .in('status', ['agendada', 'concluida', 'em_andamento', 'em_rota'])
      .maybeSingle();

    if (instalacaoExistente) {
      console.log('[AgendarVistoriaPresencial] Instalação já existe:', instalacaoExistente.id);

      // Confirmar que vistoria também existe; se não, criar agora
      const { data: vistoriaExistente } = await supabase
        .from('vistorias')
        .select('id')
        .eq('cotacao_id', cotacaoId)
        .in('status', ['agendada', 'em_analise', 'em_rota', 'em_andamento', 'concluida', 'aprovada'])
        .maybeSingle();

      return new Response(JSON.stringify({
        success: true,
        instalacaoId: instalacaoExistente.id,
        vistoriaId: vistoriaExistente?.id || null,
        message: 'Agendamento já existente'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── 1. Buscar cotação + snapshot pra rollback ───────────────
    const { data: cotacaoSnapshot, error: snapErr } = await supabase
      .from('cotacoes')
      .select('id, tipo_vistoria, status_contratacao, vistoria_data_agendada, vistoria_horario_agendado, vistoria_periodo, vistoria_endereco_cep, vistoria_endereco_logradouro, vistoria_endereco_numero, vistoria_endereco_bairro, vistoria_endereco_cidade, vistoria_endereco_estado, vistoria_endereco_latitude, vistoria_endereco_longitude, vistoria_responsavel_eu_mesmo, vistoria_responsavel_nome, vistoria_responsavel_telefone, vistoria_permite_encaixe')
      .eq('id', cotacaoId)
      .single();

    if (snapErr || !cotacaoSnapshot) {
      return new Response(JSON.stringify({ success: false, error: 'Cotação não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── 2. Buscar contrato ──────────────────────────────────────
    const { data: contrato, error: contratoError } = await supabase
      .from('contratos')
      .select('id, associado_id, veiculo_id, link_token')
      .eq('cotacao_id', cotacaoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (contratoError || !contrato) {
      return new Response(JSON.stringify({ success: false, error: 'Contrato não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (!contrato.link_token) {
      return new Response(JSON.stringify({ success: false, error: 'Acesso não autorizado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let finalLatitude = latitude ?? null;
    let finalLongitude = longitude ?? null;

    // ── 3. UPDATE cotações (colunas espelho) ───────────────────
    const updateData: Record<string, unknown> = {
      tipo_vistoria: 'agendada',
      status_contratacao: 'vistoria_ok',
      vistoria_data_agendada: dataAgendada,
      vistoria_horario_agendado: null,
      vistoria_periodo: periodoAgendado,
      vistoria_endereco_cep: endereco.cep,
      vistoria_endereco_logradouro: endereco.logradouro,
      vistoria_endereco_numero: endereco.numero,
      vistoria_endereco_bairro: endereco.bairro,
      vistoria_endereco_cidade: endereco.cidade,
      vistoria_endereco_estado: endereco.estado,
      vistoria_responsavel_eu_mesmo: responsavel.euMesmo,
      vistoria_responsavel_nome: responsavel.nome || null,
      vistoria_responsavel_telefone: responsavel.telefone || null,
      vistoria_permite_encaixe: permiteEncaixe ?? false,
      vistoria_endereco_latitude: finalLatitude,
      vistoria_endereco_longitude: finalLongitude,
    };

    const { error: updateCotacaoError } = await supabase
      .from('cotacoes')
      .update(updateData)
      .eq('id', cotacaoId);

    if (updateCotacaoError) {
      console.error('[AgendarVistoriaPresencial] Erro UPDATE cotação:', updateCotacaoError);
      throw updateCotacaoError;
    }

    // Helper para rollback do snapshot da cotação
    const rollbackCotacao = async (motivo: string) => {
      console.warn('[AgendarVistoriaPresencial] ROLLBACK cotação:', motivo);
      await supabase
        .from('cotacoes')
        .update({
          tipo_vistoria: cotacaoSnapshot.tipo_vistoria,
          status_contratacao: cotacaoSnapshot.status_contratacao,
          vistoria_data_agendada: cotacaoSnapshot.vistoria_data_agendada,
          vistoria_horario_agendado: cotacaoSnapshot.vistoria_horario_agendado,
          vistoria_periodo: cotacaoSnapshot.vistoria_periodo,
          vistoria_endereco_cep: cotacaoSnapshot.vistoria_endereco_cep,
          vistoria_endereco_logradouro: cotacaoSnapshot.vistoria_endereco_logradouro,
          vistoria_endereco_numero: cotacaoSnapshot.vistoria_endereco_numero,
          vistoria_endereco_bairro: cotacaoSnapshot.vistoria_endereco_bairro,
          vistoria_endereco_cidade: cotacaoSnapshot.vistoria_endereco_cidade,
          vistoria_endereco_estado: cotacaoSnapshot.vistoria_endereco_estado,
          vistoria_endereco_latitude: cotacaoSnapshot.vistoria_endereco_latitude,
          vistoria_endereco_longitude: cotacaoSnapshot.vistoria_endereco_longitude,
          vistoria_responsavel_eu_mesmo: cotacaoSnapshot.vistoria_responsavel_eu_mesmo,
          vistoria_responsavel_nome: cotacaoSnapshot.vistoria_responsavel_nome,
          vistoria_responsavel_telefone: cotacaoSnapshot.vistoria_responsavel_telefone,
          vistoria_permite_encaixe: cotacaoSnapshot.vistoria_permite_encaixe,
        })
        .eq('id', cotacaoId);
    };

    // ── 4. INSERT vistorias (registro operacional canônico) ────
    const vistoriaPayload = {
      cotacao_id: cotacaoId,
      contrato_id: contrato.id,
      associado_id: contrato.associado_id ?? null,
      veiculo_id: contrato.veiculo_id ?? null,
      tipo: 'entrada',
      modalidade: 'presencial',
      status: 'agendada',
      origem: 'link_publico',
      local_vistoria: 'cliente',
      data_agendada: `${dataAgendada}T${periodoParaHora(periodoAgendado)}+00:00`,
      horario_agendado: periodoParaHora(periodoAgendado),
      endereco_cep: endereco.cep,
      endereco_logradouro: endereco.logradouro,
      endereco_numero: endereco.numero,
      endereco_bairro: endereco.bairro,
      endereco_cidade: endereco.cidade,
      endereco_estado: endereco.estado,
      endereco_latitude: finalLatitude,
      endereco_longitude: finalLongitude,
      permite_encaixe: permiteEncaixe ?? false,
    };

    const { data: vistoriaCriada, error: vistoriaErr } = await supabase
      .from('vistorias')
      .insert(vistoriaPayload)
      .select('id')
      .single();

    if (vistoriaErr || !vistoriaCriada) {
      await rollbackCotacao('falha INSERT vistorias');
      console.error('[AgendarVistoriaPresencial] Erro INSERT vistoria:', vistoriaErr);
      return new Response(JSON.stringify({
        success: false,
        error: vistoriaErr?.message || 'Não foi possível registrar a vistoria. Tente novamente.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[AgendarVistoriaPresencial] Vistoria criada:', vistoriaCriada.id);

    // ── 5. Materializar instalação (idempotente, não-bloqueante p/ sub-FIPE) ──
    // criar-instalacao-pos-pagamento aborta sozinha quando o veículo dispensa rastreador.
    let instalacaoId: string | null = null;
    try {
      const { data: invokeData, error: invokeErr } = await supabase.functions.invoke(
        'criar-instalacao-pos-pagamento',
        { body: { cotacaoId, skipPaymentCheck: true } }
      );
      if (invokeErr) {
        console.warn('[AgendarVistoriaPresencial] criar-instalacao-pos-pagamento falhou (segue):', invokeErr);
      } else {
        instalacaoId = (invokeData as any)?.instalacaoId ?? null;
      }
    } catch (e) {
      console.warn('[AgendarVistoriaPresencial] Erro ao invocar criar-instalacao-pos-pagamento:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      vistoriaId: vistoriaCriada.id,
      instalacaoId,
      message: 'Agendamento registrado com sucesso.'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AgendarVistoriaPresencial] Erro geral:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
