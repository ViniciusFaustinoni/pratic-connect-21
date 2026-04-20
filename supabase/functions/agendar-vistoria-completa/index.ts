import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface AgendarVistoriaRequest {
  cotacaoId: string;
  dataAgendada: string;
  /** Pode vir como 'manha'/'tarde' (preferido) ou HH:MM (legado). */
  horarioAgendado?: string;
  periodo?: 'manha' | 'tarde';
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Usar service_role para bypassar RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const body: AgendarVistoriaRequest = await req.json();
    const { cotacaoId, dataAgendada, horarioAgendado, endereco, responsavel, latitude, longitude, permiteEncaixe } = body;

    // Normalizar período (canônico) — sempre passa a operar por período
    const periodoNorm: 'manha' | 'tarde' = (() => {
      const v = String(body.periodo || horarioAgendado || '').toLowerCase();
      if (v === 'tarde') return 'tarde';
      if (v === 'manha' || v === 'manhã') return 'manha';
      const m = /^(\d{1,2}):/.exec(v);
      if (m) return parseInt(m[1], 10) < 12 ? 'manha' : 'tarde';
      return 'manha';
    })();

    console.log('[AgendarVistoriaCompleta] Iniciando para cotação:', cotacaoId, 'permiteEncaixe:', permiteEncaixe);

    // 0. VERIFICAR SE JÁ EXISTE INSTALAÇÃO PARA EVITAR DUPLICATAS
    const { data: instalacaoExistente } = await supabase
      .from('instalacoes')
      .select('id, status')
      .eq('cotacao_id', cotacaoId)
      .in('status', ['agendada', 'concluida', 'em_andamento', 'em_rota'])
      .maybeSingle();

    if (instalacaoExistente) {
      console.log('[AgendarVistoriaCompleta] Instalação já existe:', instalacaoExistente.id);
      
      // Retornar sucesso com o ID existente (idempotência)
      return new Response(JSON.stringify({
        success: true,
        instalacaoId: instalacaoExistente.id,
        message: 'Agendamento já existente'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 1. Buscar cotação e contrato
    const { data: cotacao, error: cotacaoError } = await supabase
      .from('cotacoes')
      .select('id, nome_solicitante, telefone1_solicitante, veiculo_placa, veiculo_marca, veiculo_modelo')
      .eq('id', cotacaoId)
      .single();

    if (cotacaoError || !cotacao) {
      console.error('[AgendarVistoriaCompleta] Cotação não encontrada:', cotacaoError);
      return new Response(JSON.stringify({ success: false, error: 'Cotação não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Buscar contrato vinculado (validação de segurança: deve ter link_token)
    const { data: contrato, error: contratoError } = await supabase
      .from('contratos')
      .select('id, associado_id, veiculo_id, link_token')
      .eq('cotacao_id', cotacaoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (contratoError || !contrato) {
      console.error('[AgendarVistoriaCompleta] Contrato não encontrado:', contratoError);
      return new Response(JSON.stringify({ success: false, error: 'Contrato não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validação de segurança: só permite se o contrato tem link_token
    if (!contrato.link_token) {
      console.error('[AgendarVistoriaCompleta] Contrato sem link_token');
      return new Response(JSON.stringify({ success: false, error: 'Acesso não autorizado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Atualizar cotação com dados da vistoria completa (SEM criar instalação ainda)
    
    // IMPORTANTE: Garantir que coordenadas são salvas para atribuição automática
    let finalLatitude = latitude;
    let finalLongitude = longitude;
    
    if (!finalLatitude || !finalLongitude) {
      console.warn('[AgendarVistoriaCompleta] Coordenadas não fornecidas - atribuição por proximidade pode falhar');
    }
    
    const updateData: Record<string, unknown> = {
      vistoria_completa_data_agendada: dataAgendada,
      vistoria_completa_horario_agendado: null,
      vistoria_completa_periodo: periodoNorm,
      vistoria_completa_endereco_cep: endereco.cep,
      vistoria_completa_endereco_logradouro: endereco.logradouro,
      vistoria_completa_endereco_numero: endereco.numero,
      vistoria_completa_endereco_bairro: endereco.bairro,
      vistoria_completa_endereco_cidade: endereco.cidade,
      vistoria_completa_endereco_estado: endereco.estado,
      vistoria_completa_responsavel_eu_mesmo: responsavel.euMesmo,
      vistoria_completa_responsavel_nome: responsavel.nome || null,
      vistoria_completa_responsavel_telefone: responsavel.telefone || null,
      vistoria_permite_encaixe: permiteEncaixe ?? false,
      // SEMPRE salvar coordenadas para vistoria completa também
      vistoria_endereco_latitude: finalLatitude || null,
      vistoria_endereco_longitude: finalLongitude || null,
    };

    const { error: updateCotacaoError } = await supabase
      .from('cotacoes')
      .update(updateData)
      .eq('id', cotacaoId);

    if (updateCotacaoError) {
      console.error('[AgendarVistoriaCompleta] Erro ao atualizar cotação:', updateCotacaoError);
      throw updateCotacaoError;
    }

    console.log('[AgendarVistoriaCompleta] Agendamento salvo na cotação:', {
      data: dataAgendada,
      periodo: periodoNorm,
      permiteEncaixe: permiteEncaixe ?? false,
      temCoordenadas: !!(finalLatitude && finalLongitude),
      latitude: finalLatitude,
      longitude: finalLongitude
    });

    // NÃO criar vistoria nem instalação aqui
    // A instalação será criada em criar-instalacao-pos-pagamento após o pagamento ser confirmado

    // Enviar confirmação WhatsApp imediata se permiteEncaixe = true
    if (permiteEncaixe) {
      try {
        const telefoneCliente = (cotacao.telefone1_solicitante || '').replace(/\D/g, '');
        const nomeCliente = cotacao.nome_solicitante || 'Cliente';
        const nomeAbrev = nomeCliente.split(' ')[0];

        if (telefoneCliente) {
          const periodoTexto = periodoNorm === 'manha' ? 'pela manhã' : 'pela tarde';

          const dataObj = new Date(dataAgendada + 'T12:00:00');
          const dataFormatada = dataObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });

          const enderecoTexto = [endereco.logradouro, endereco.numero, endereco.bairro, endereco.cidade]
            .filter(Boolean).join(', ') || 'endereço agendado';

          const mensagem = `Olá, *${nomeAbrev}*! 👋

Seu serviço de *vistoria* foi agendado como *encaixe* para:
📅 ${dataFormatada} ${periodoTexto}
📍 ${enderecoTexto}

O técnico mais próximo será designado em breve.

✅ Responda *SIM* para confirmar
📅 Ou informe se precisa *reagendar*

*PRATIC Proteção Veicular*`;

          const { error: sendError } = await supabase.functions.invoke('whatsapp-send-text', {
            body: {
              telefone: telefoneCliente,
              mensagem,
              template_name: 'confirmacao_agendamento_v1',
              template_params: [nomeAbrev, 'vistoria', `${dataFormatada} ${periodoTexto}`],
            }
          });

          if (sendError) {
            console.error('[AgendarVistoriaCompleta] Erro ao enviar confirmação encaixe WhatsApp:', sendError);
          } else {
            console.log(`[AgendarVistoriaCompleta] ✅ Confirmação encaixe enviada para ${telefoneCliente}`);
          }
        } else {
          console.warn('[AgendarVistoriaCompleta] Telefone do solicitante não disponível para envio WhatsApp');
        }
      } catch (whatsappError) {
        console.error('[AgendarVistoriaCompleta] Erro não-bloqueante ao enviar WhatsApp:', whatsappError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      instalacaoId: null, // Será criada após pagamento
      message: 'Agendamento salvo com sucesso. A instalação será criada após o pagamento.'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[AgendarVistoriaCompleta] Erro geral:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
