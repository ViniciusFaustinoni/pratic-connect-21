import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Labels para tipos de assistência
const TIPO_LABELS: Record<string, string> = {
  guincho: 'Guincho/Reboque',
  pane_seca: 'Pane Seca (Combustível)',
  chaveiro: 'Chaveiro',
  troca_pneu: 'Troca de Pneu',
  bateria: 'Auxílio Bateria',
  outros: 'Outros',
};

// Status considerados como "chamado em aberto"
const STATUS_ATIVOS = [
  'aberto',
  'aguardando_prestador',
  'prestador_despachado',
  'prestador_a_caminho',
  'em_atendimento',
];

interface CriarChamadoRequest {
  veiculo_id: string;
  tipo_assistencia: 'guincho' | 'pane_seca' | 'chaveiro' | 'troca_pneu' | 'bateria' | 'outros';
  descricao?: string;
  latitude: number;
  longitude: number;
  endereco?: string;
}

// Gera protocolo único no formato ASS-YYYYMMDD-XXXX
function gerarProtocolo(): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `ASS-${dateStr}-${random}`;
}

// Faz reverse geocoding usando Nominatim (OpenStreetMap)
async function obterEndereco(lat: number, lng: number): Promise<{
  endereco: string;
  cidade: string;
  uf: string;
}> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`;
    
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'PraticConnect/1.0',
        'Accept-Language': 'pt-BR,pt;q=0.9'
      }
    });
    
    if (!response.ok) throw new Error('Geocoding failed');
    
    const data = await response.json();
    const addr = data.address || {};
    
    const partes = [
      addr.road || addr.street,
      addr.house_number,
      addr.suburb || addr.neighbourhood,
    ].filter(Boolean);
    
    return {
      endereco: partes.join(', ') || data.display_name || `${lat}, ${lng}`,
      cidade: addr.city || addr.town || addr.municipality || 'Não identificada',
      uf: addr.state || 'N/A',
    };
  } catch (error) {
    console.error('[Geocode] Erro:', error);
    return {
      endereco: `${lat}, ${lng}`,
      cidade: 'Não identificada',
      uf: 'N/A',
    };
  }
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Inicializar clientes Supabase
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
      console.error("[criar-chamado] Erro de autenticação:", authError);
      return new Response(
        JSON.stringify({ success: false, error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Buscar associado vinculado ao usuário
    const { data: associado, error: assocError } = await supabaseAdmin
      .from("associados")
      .select("id, nome, telefone, whatsapp, email, user_id, status")
      .eq("user_id", user.id)
      .single();

    if (assocError || !associado) {
      console.error("[criar-chamado] Associado não encontrado:", assocError);
      return new Response(
        JSON.stringify({ success: false, error: "Associado não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se associado está ativo
    if (associado.status !== 'ativo') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Seu cadastro não está ativo. Entre em contato com a central." 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Parsear payload
    const payload: CriarChamadoRequest = await req.json();
    console.log("[criar-chamado] Payload recebido:", payload);

    // Validações básicas
    if (!payload.veiculo_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Veículo não informado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payload.tipo_assistencia || !TIPO_LABELS[payload.tipo_assistencia]) {
      return new Response(
        JSON.stringify({ success: false, error: "Tipo de assistência inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payload.latitude || !payload.longitude) {
      return new Response(
        JSON.stringify({ success: false, error: "Localização não informada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Verificar se veículo pertence ao associado
    const { data: veiculo, error: veicError } = await supabaseAdmin
      .from("veiculos")
      .select("id, placa, marca, modelo, ano_modelo, cor, status")
      .eq("id", payload.veiculo_id)
      .eq("associado_id", associado.id)
      .single();

    if (veicError || !veiculo) {
      console.error("[criar-chamado] Veículo não encontrado:", veicError);
      return new Response(
        JSON.stringify({ success: false, error: "Veículo não encontrado ou não pertence ao associado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se veículo está ativo
    if (veiculo.status !== 'ativo') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Este veículo não está ativo para assistência. Entre em contato com a central." 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4.1 Buscar rastreador do veículo e capturar posição
    let rastreadorLat: number | null = null;
    let rastreadorLng: number | null = null;
    let rastreadorPosicaoCapturadaEm: string | null = null;
    let rastreadorEndereco: string | null = null;

    const { data: rastreador } = await supabaseAdmin
      .from("rastreadores")
      .select("id, plataforma, plataforma_veiculo_id, ultima_posicao_lat, ultima_posicao_lng, ultima_comunicacao")
      .eq("veiculo_id", veiculo.id)
      .eq("status", "instalado")
      .maybeSingle();

    if (rastreador) {
      console.log("[criar-chamado] Rastreador encontrado:", rastreador.id);
      
      // Tentar buscar posição em tempo real via API
      if (rastreador.plataforma === 'softruck' && rastreador.plataforma_veiculo_id) {
        try {
          const posicaoResult = await fetch(
            `${supabaseUrl}/functions/v1/posicao-veiculo`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ veiculo_id: veiculo.id }),
            }
          );
          
          const posicaoData = await posicaoResult.json();
          
          if (posicaoData.success && posicaoData.posicao) {
            rastreadorLat = posicaoData.posicao.latitude;
            rastreadorLng = posicaoData.posicao.longitude;
            rastreadorPosicaoCapturadaEm = posicaoData.posicao.data_posicao || new Date().toISOString();
            rastreadorEndereco = posicaoData.posicao.endereco || null;
            console.log("[criar-chamado] Posição do rastreador obtida via API:", rastreadorLat, rastreadorLng);
          }
        } catch (err) {
          console.error("[criar-chamado] Erro ao buscar posição via API:", err);
        }
      }
      
      // Fallback: usar última posição do banco
      if (!rastreadorLat && rastreador.ultima_posicao_lat && rastreador.ultima_posicao_lng) {
        rastreadorLat = rastreador.ultima_posicao_lat;
        rastreadorLng = rastreador.ultima_posicao_lng;
        rastreadorPosicaoCapturadaEm = rastreador.ultima_comunicacao;
        console.log("[criar-chamado] Usando última posição do banco:", rastreadorLat, rastreadorLng);
      }
    }

    // 4.2 Se associado não informou localização, usar rastreador como fallback
    if ((!payload.latitude || !payload.longitude) && rastreadorLat && rastreadorLng) {
      console.log("[criar-chamado] Usando posição do rastreador como fallback");
      payload.latitude = rastreadorLat;
      payload.longitude = rastreadorLng;
    }

    // 5. Verificar se já existe chamado em aberto
    const { data: chamadoExistente } = await supabaseAdmin
      .from("chamados_assistencia")
      .select("id, protocolo, status")
      .eq("associado_id", associado.id)
      .in("status", STATUS_ATIVOS)
      .limit(1)
      .maybeSingle();

    if (chamadoExistente) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Você já possui um chamado em aberto",
          chamado_existente: {
            id: chamadoExistente.id,
            protocolo: chamadoExistente.protocolo,
            status: chamadoExistente.status,
          },
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Gerar protocolo e obter endereço
    const protocolo = gerarProtocolo();
    const enderecoData = await obterEndereco(payload.latitude, payload.longitude);
    const dataAbertura = new Date().toISOString();

    console.log("[criar-chamado] Protocolo gerado:", protocolo);
    console.log("[criar-chamado] Endereço obtido:", enderecoData);

    // 7. Inserir chamado na tabela
    const { data: chamado, error: insertError } = await supabaseAdmin
      .from("chamados_assistencia")
      .insert({
        protocolo,
        associado_id: associado.id,
        veiculo_id: veiculo.id,
        tipo_servico: payload.tipo_assistencia,
        descricao: payload.descricao || null,
        origem_endereco: payload.endereco || enderecoData.endereco,
        origem_lat: payload.latitude,
        origem_lng: payload.longitude,
        origem_cidade: enderecoData.cidade,
        origem_uf: enderecoData.uf,
        canal: 'app',
        status: 'aberto',
        data_abertura: dataAbertura,
        // Campos do rastreador
        rastreador_lat: rastreadorLat,
        rastreador_lng: rastreadorLng,
        rastreador_posicao_capturada_em: rastreadorPosicaoCapturadaEm,
        rastreador_endereco: rastreadorEndereco,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[criar-chamado] Erro ao inserir:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao criar chamado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[criar-chamado] Chamado criado:", chamado.id);

    // 8. Registrar no histórico
    await supabaseAdmin.from("chamados_assistencia_historico").insert({
      chamado_id: chamado.id,
      status_novo: 'aberto',
      usuario_id: user.id,
      observacao: `Chamado aberto via app - ${TIPO_LABELS[payload.tipo_assistencia]}`,
    });

    // 9. Buscar número da central para WhatsApp
    const { data: configCentral } = await supabaseAdmin
      .from("configuracoes")
      .select("valor")
      .eq("chave", "assistencia_telefone_central")
      .maybeSingle();

    const telefoneCentral = configCentral?.valor || Deno.env.get("WHATSAPP_CENTRAL");

    // 10. Enviar WhatsApp para central
    if (telefoneCentral) {
      const linkMapa = `https://www.google.com/maps?q=${payload.latitude},${payload.longitude}`;
      
      const mensagemCentral = `🚨 *NOVO CHAMADO DE ASSISTÊNCIA*

📋 *Protocolo:* ${protocolo}
🔧 *Tipo:* ${TIPO_LABELS[payload.tipo_assistencia]}

👤 *Associado:* ${associado.nome}
📱 *Telefone:* ${associado.whatsapp || associado.telefone || 'Não informado'}

🚗 *Veículo:* ${veiculo.placa} - ${veiculo.marca} ${veiculo.modelo}

📍 *Local:* ${payload.endereco || enderecoData.endereco}
🗺️ *Ver no Mapa:* ${linkMapa}

📝 *Descrição:* ${payload.descricao || 'Não informada'}

⏰ *Aberto em:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;

      try {
        await supabaseAdmin.functions.invoke('whatsapp-send-media', {
          body: {
            telefone: telefoneCentral.replace(/\D/g, ''),
            tipo: 'text',
            mensagem: mensagemCentral,
            referencia_tipo: 'chamado_assistencia',
            referencia_id: chamado.id,
          },
        });
        console.log("[criar-chamado] WhatsApp enviado para central");
      } catch (whatsappError) {
        console.error("[criar-chamado] Erro ao enviar WhatsApp:", whatsappError);
        // Não bloqueia o fluxo - chamado foi criado com sucesso
      }
    } else {
      console.warn("[criar-chamado] Telefone da central não configurado");
    }

    // 11. Criar notificação para o associado
    if (associado.user_id) {
      await supabaseAdmin.from("notificacoes").insert({
        user_id: associado.user_id,
        titulo: '✅ Chamado Aberto!',
        mensagem: `Seu chamado de ${TIPO_LABELS[payload.tipo_assistencia]} foi registrado. Protocolo: ${protocolo}. Em breve entraremos em contato.`,
        tipo: 'info',
        categoria: 'assistencia',
        referencia_tipo: 'chamado_assistencia',
        referencia_id: chamado.id,
        link: `/app/assistencia/${chamado.id}`,
        lida: false,
        canal_sistema: true,
      });
    }

    // 12. Retornar sucesso
    return new Response(
      JSON.stringify({
        success: true,
        chamado_id: chamado.id,
        numero_chamado: protocolo,
        status: 'aberto',
        mensagem_confirmacao: 'Seu chamado foi registrado com sucesso! Em breve um atendente entrará em contato.',
        previsao_atendimento: '30-45 minutos',
        veiculo: {
          placa: veiculo.placa,
          modelo: `${veiculo.marca} ${veiculo.modelo}`,
        },
        endereco_formatado: payload.endereco || enderecoData.endereco,
        data_abertura: dataAbertura,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[criar-chamado] Erro geral:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
