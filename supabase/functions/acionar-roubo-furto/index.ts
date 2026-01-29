import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcionamentoRequest {
  veiculo_id: string;
  sinistro_id?: string;
  chamado_assistencia_id?: string;
  tipo_origem: 'sinistro' | 'assistencia' | 'diretoria' | 'manual';
  observacoes?: string;
  modo_rastreamento?: 'intensivo' | 'emergencia';
}

interface AcionamentoResponse {
  success: boolean;
  acionamento_id?: string;
  protocolo_externo?: string;
  status?: string;
  error?: string;
  mensagem?: string;
}

// Labels para tipos de origem
const TIPO_ORIGEM_LABELS: Record<string, string> = {
  sinistro: 'Sinistro Comunicado',
  assistencia: 'Chamado de Assistência 24h',
  diretoria: 'Autorização da Diretoria',
  manual: 'Acionamento Manual',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Validar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);

    if (authError || !user) {
      console.error("[acionar-roubo-furto] Erro auth:", authError);
      return new Response(
        JSON.stringify({ success: false, error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Buscar profile do usuário
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, tipo")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ success: false, error: "Perfil não encontrado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Parse payload
    const payload: AcionamentoRequest = await req.json();
    console.log("[acionar-roubo-furto] Payload:", JSON.stringify(payload));

    if (!payload.veiculo_id) {
      return new Response(
        JSON.stringify({ success: false, error: "veiculo_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payload.tipo_origem) {
      return new Response(
        JSON.stringify({ success: false, error: "tipo_origem é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Buscar veículo
    const { data: veiculo, error: veicError } = await supabaseAdmin
      .from("veiculos")
      .select("id, placa, marca, modelo, associado_id")
      .eq("id", payload.veiculo_id)
      .single();

    if (veicError || !veiculo) {
      console.error("[acionar-roubo-furto] Veículo não encontrado:", veicError);
      return new Response(
        JSON.stringify({ success: false, error: "Veículo não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Buscar associado
    const { data: associado } = await supabaseAdmin
      .from("associados")
      .select("id, nome, telefone, whatsapp")
      .eq("id", veiculo.associado_id)
      .single();

    // 6. Buscar rastreador do veículo
    const { data: rastreador, error: rastError } = await supabaseAdmin
      .from("rastreadores")
      .select(`
        *,
        plataforma:rastreadores_config_plataformas(*)
      `)
      .eq("veiculo_id", payload.veiculo_id)
      .single();

    if (rastError || !rastreador) {
      console.error("[acionar-roubo-furto] Rastreador não encontrado:", rastError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Veículo não possui rastreador instalado" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const plataforma = rastreador.plataforma;
    const plataformaCodigo = plataforma?.codigo || rastreador.plataforma || 'rede_veiculos';

    // 7. Verificar se já existe acionamento ativo
    const { data: acionamentoExistente } = await supabaseAdmin
      .from("acionamentos_roubo_furto")
      .select("id, protocolo_externo, status")
      .eq("veiculo_id", payload.veiculo_id)
      .in("status", ["solicitado", "autorizado", "enviado", "confirmado"])
      .limit(1)
      .maybeSingle();

    if (acionamentoExistente) {
      console.log("[acionar-roubo-furto] Acionamento já existe:", acionamentoExistente.id);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Já existe um acionamento ativo para este veículo",
          acionamento_id: acionamentoExistente.id,
          protocolo_externo: acionamentoExistente.protocolo_externo,
          status: acionamentoExistente.status,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Buscar última posição conhecida
    let ultimaPosicao = null;
    if (rastreador.ultima_posicao_lat && rastreador.ultima_posicao_lng) {
      ultimaPosicao = {
        lat: rastreador.ultima_posicao_lat,
        lng: rastreador.ultima_posicao_lng,
        data: rastreador.ultima_comunicacao,
      };
    }

    // 9. Criar registro de acionamento
    const { data: acionamento, error: insertError } = await supabaseAdmin
      .from("acionamentos_roubo_furto")
      .insert({
        sinistro_id: payload.sinistro_id || null,
        chamado_assistencia_id: payload.chamado_assistencia_id || null,
        veiculo_id: payload.veiculo_id,
        rastreador_id: rastreador.id,
        associado_id: veiculo.associado_id,
        tipo_origem: payload.tipo_origem,
        plataforma: plataformaCodigo,
        solicitado_por: profile.id,
        solicitado_por_nome: profile.nome,
        status: "enviado",
        ultima_posicao_lat: ultimaPosicao?.lat,
        ultima_posicao_lng: ultimaPosicao?.lng,
        ultima_posicao_data: ultimaPosicao?.data,
        observacoes: payload.observacoes,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[acionar-roubo-furto] Erro ao inserir:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao criar acionamento" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[acionar-roubo-furto] Acionamento criado:", acionamento.id);

    // 10. Chamar API da plataforma de rastreamento
    let apiSuccess = false;
    let protocoloExterno: string | null = null;
    let apiResponse: any = null;
    let apiStatusCode = 0;
    let erroMensagem: string | null = null;

    if (plataformaCodigo === 'rede_veiculos') {
      const redeToken = Deno.env.get("REDE_VEICULOS_TOKEN");
      
      if (!redeToken) {
        erroMensagem = "Token Rede Veículos não configurado";
        console.error("[acionar-roubo-furto]", erroMensagem);
      } else {
        try {
          // Determinar URL base
          const baseUrl = plataforma?.ambiente_atual === 'producao'
            ? (plataforma?.api_url_producao || 'https://integracao.redeveiculos.com/api/v2/prod')
            : (plataforma?.api_url_sandbox || 'https://integracao.redeveiculos.com/api/v2/sandbox');

          // Montar payload para API Rede Veículos
          const apiPayload = {
            codigo_rastreador: rastreador.codigo,
            placa: veiculo.placa,
            tipo_evento: "roubo_furto",
            prioridade: "alta",
            origem: payload.tipo_origem,
            associado_nome: associado?.nome || "Não informado",
            associado_telefone: associado?.whatsapp || associado?.telefone || "Não informado",
            ultima_posicao: ultimaPosicao ? {
              latitude: ultimaPosicao.lat,
              longitude: ultimaPosicao.lng,
              data_hora: ultimaPosicao.data,
            } : null,
            observacoes: payload.observacoes || `Acionamento via SGA - ${TIPO_ORIGEM_LABELS[payload.tipo_origem]}`,
          };

          console.log("[acionar-roubo-furto] Chamando API Rede Veículos:", baseUrl);

          // Chamar endpoint de acionamento
          const response = await fetch(`${baseUrl}/acionamentoRouboFurto`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${redeToken}`,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify(apiPayload),
          });

          apiStatusCode = response.status;
          const responseText = await response.text();
          
          try {
            apiResponse = JSON.parse(responseText);
          } catch {
            apiResponse = { raw: responseText };
          }

          console.log("[acionar-roubo-furto] Resposta API:", apiStatusCode, apiResponse);

          if (response.ok) {
            apiSuccess = true;
            protocoloExterno = apiResponse.protocolo || apiResponse.id || apiResponse.ticket || `RV-${Date.now()}`;
            
            // Tentar ativar rastreamento intensivo
            try {
              const intensivoPayload = {
                codigo_rastreador: rastreador.codigo,
                modo: payload.modo_rastreamento || 'intensivo',
                duracao_horas: 72, // 72 horas de rastreamento intensivo
              };

              await fetch(`${baseUrl}/rastreamentoIntensivo`, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${redeToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(intensivoPayload),
              });
              
              console.log("[acionar-roubo-furto] Rastreamento intensivo ativado");
            } catch (intensivoError) {
              console.warn("[acionar-roubo-furto] Erro ao ativar modo intensivo:", intensivoError);
              // Não bloqueia o fluxo
            }
          } else {
            erroMensagem = `API retornou status ${response.status}: ${responseText}`;
            console.error("[acionar-roubo-furto] Erro API:", erroMensagem);
          }

        } catch (apiError) {
          erroMensagem = `Erro de conexão: ${apiError instanceof Error ? apiError.message : String(apiError)}`;
          console.error("[acionar-roubo-furto] Erro ao chamar API:", apiError);
        }
      }
    } else if (plataformaCodigo === 'softruck') {
      // Para Softruck, chamar rastreador-auth primeiro
      try {
        const authResponse = await supabaseAdmin.functions.invoke('rastreador-auth', {
          body: { plataforma: 'softruck' }
        });

        if (authResponse.data?.success && authResponse.data?.token) {
          const softruckToken = authResponse.data.token;
          const baseUrl = plataforma?.ambiente_atual === 'producao'
            ? (plataforma?.api_url_producao || 'https://api.softruck.com.br')
            : (plataforma?.api_url_sandbox || 'https://sandbox.softruck.com.br');

          const publicKey = Deno.env.get('SOFTRUCK_PUBLIC_KEY') || '';

          // Softruck endpoint de alerta
          const response = await fetch(`${baseUrl}/alerts/theft`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${softruckToken}`,
              "public-key": publicKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              vehicle_id: rastreador.plataforma_veiculo_id,
              device_id: rastreador.plataforma_device_id,
              alert_type: "theft",
              priority: "critical",
            }),
          });

          apiStatusCode = response.status;
          apiResponse = await response.json();

          if (response.ok) {
            apiSuccess = true;
            protocoloExterno = apiResponse.alert_id || `ST-${Date.now()}`;
          } else {
            erroMensagem = `Softruck API erro: ${response.status}`;
          }
        } else {
          erroMensagem = "Falha na autenticação Softruck";
        }
      } catch (softruckError) {
        erroMensagem = `Erro Softruck: ${softruckError instanceof Error ? softruckError.message : String(softruckError)}`;
        console.error("[acionar-roubo-furto] Erro Softruck:", softruckError);
      }
    }

    // 11. Atualizar registro de acionamento com resposta da API
    const novoStatus = apiSuccess ? "confirmado" : "erro";
    
    await supabaseAdmin
      .from("acionamentos_roubo_furto")
      .update({
        status: novoStatus,
        protocolo_externo: protocoloExterno,
        api_request: { plataforma: plataformaCodigo, timestamp: new Date().toISOString() },
        api_response: apiResponse,
        api_status_code: apiStatusCode,
        erro_mensagem: erroMensagem,
        updated_at: new Date().toISOString(),
      })
      .eq("id", acionamento.id);

    // 12. Atualizar rastreador para modo intensivo/emergência
    const modoRastreamento = payload.modo_rastreamento || 'intensivo';
    
    await supabaseAdmin
      .from("rastreadores")
      .update({
        modo_rastreamento: modoRastreamento,
        modo_ativado_em: new Date().toISOString(),
        modo_ativado_por: profile.id,
        acionamento_ativo_id: acionamento.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rastreador.id);

    console.log("[acionar-roubo-furto] Rastreador atualizado para modo:", modoRastreamento);

    // 13. Criar alerta crítico
    await supabaseAdmin.from("rastreador_alertas").insert({
      rastreador_id: rastreador.id,
      veiculo_id: payload.veiculo_id,
      tipo: "acionamento_roubo",
      severidade: "critica",
      titulo: `🚨 ROUBO/FURTO - ${veiculo.placa}`,
      descricao: `Acionamento de recuperação ativado. Origem: ${TIPO_ORIGEM_LABELS[payload.tipo_origem]}`,
      status: "aberto",
      dados_extras: {
        acionamento_id: acionamento.id,
        protocolo_externo: protocoloExterno,
        solicitado_por: profile.nome,
        api_success: apiSuccess,
      },
    });

    console.log("[acionar-roubo-furto] Alerta crítico criado");

    // 14. Notificar equipe de monitoramento e diretoria
    try {
      // Buscar diretores e analistas
      const { data: destinatarios } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .in("role", ["diretor", "analista_sinistros", "operador_monitoramento"]);

      for (const dest of destinatarios || []) {
        await supabaseAdmin.from("notificacoes").insert({
          user_id: dest.user_id,
          titulo: "🚨 ACIONAMENTO DE ROUBO/FURTO",
          mensagem: `Veículo ${veiculo.placa} (${veiculo.marca} ${veiculo.modelo}) - ${TIPO_ORIGEM_LABELS[payload.tipo_origem]}. ${apiSuccess ? 'Alerta enviado para central.' : 'ERRO: verificar manualmente.'}`,
          tipo: "alerta",
          categoria: "monitoramento",
          referencia_tipo: "acionamento_roubo_furto",
          referencia_id: acionamento.id,
          link: `/monitoramento/rastreadores/${rastreador.id}`,
          lida: false,
          canal_sistema: true,
        });
      }

      console.log("[acionar-roubo-furto] Notificações enviadas");
    } catch (notifError) {
      console.error("[acionar-roubo-furto] Erro ao notificar:", notifError);
    }

    // 15. Enviar WhatsApp para central (se configurado)
    try {
      const { data: configCentral } = await supabaseAdmin
        .from("configuracoes")
        .select("valor")
        .eq("chave", "monitoramento_telefone_central")
        .maybeSingle();

      const telefoneCentral = configCentral?.valor || Deno.env.get("WHATSAPP_CENTRAL_MONITORAMENTO");

      if (telefoneCentral) {
        const linkMapa = ultimaPosicao
          ? `https://www.google.com/maps?q=${ultimaPosicao.lat},${ultimaPosicao.lng}`
          : 'Posição não disponível';

        const mensagem = `🚨 *ALERTA DE ROUBO/FURTO*

📋 *Protocolo:* ${protocoloExterno || 'Pendente'}
🚗 *Veículo:* ${veiculo.placa} - ${veiculo.marca} ${veiculo.modelo}

👤 *Associado:* ${associado?.nome || 'Não informado'}
📱 *Telefone:* ${associado?.whatsapp || associado?.telefone || 'Não informado'}

📍 *Última Posição:* ${linkMapa}
🕐 *Data/Hora Acionamento:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}

🔧 *Origem:* ${TIPO_ORIGEM_LABELS[payload.tipo_origem]}
${payload.observacoes ? `📝 *Obs:* ${payload.observacoes}` : ''}

⚠️ *Status API:* ${apiSuccess ? '✅ Confirmado' : '❌ Erro - verificar manualmente'}`;

        await supabaseAdmin.functions.invoke('whatsapp-send-media', {
          body: {
            telefone: telefoneCentral.replace(/\D/g, ''),
            tipo: 'text',
            mensagem: mensagem,
            referencia_tipo: 'acionamento_roubo_furto',
            referencia_id: acionamento.id,
          },
        });

        console.log("[acionar-roubo-furto] WhatsApp enviado para central");
      }
    } catch (whatsappError) {
      console.error("[acionar-roubo-furto] Erro WhatsApp:", whatsappError);
    }

    // 16. Registrar log
    const tempoMs = Date.now() - startTime;
    await supabaseAdmin.from("rastreadores_logs").insert({
      rastreador_id: rastreador.id,
      plataforma: plataformaCodigo,
      operacao: "acionamento_roubo_furto",
      status: apiSuccess ? "sucesso" : "erro",
      tempo_resposta_ms: tempoMs,
      erro_mensagem: erroMensagem,
      request: { tipo_origem: payload.tipo_origem },
      response: apiResponse,
    });

    // 17. Retornar resposta
    const response: AcionamentoResponse = {
      success: true,
      acionamento_id: acionamento.id,
      protocolo_externo: protocoloExterno || undefined,
      status: novoStatus,
      mensagem: apiSuccess
        ? "Acionamento de roubo/furto enviado com sucesso. Rastreamento intensivo ativado."
        : "Acionamento registrado, mas houve erro na comunicação com a central. Equipe notificada para acompanhamento manual.",
    };

    if (!apiSuccess) {
      response.error = erroMensagem || "Erro na comunicação com a plataforma de rastreamento";
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[acionar-roubo-furto] Erro geral:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro interno",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
