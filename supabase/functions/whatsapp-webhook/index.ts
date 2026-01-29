import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// System prompt adaptado para WhatsApp (mais conciso) - ALINHADO COM APP
const WHATSAPP_SYSTEM_PROMPT = `Você é o Assistente Virtual PRATIC via WhatsApp.

## Regras do WhatsApp
- Seja CONCISO (mensagens curtas)
- Use formatação: *negrito*, _itálico_
- NÃO use marcadores especiais como [BOTAO_LOCALIZACAO] ou [UPLOAD_*]
- Para localização, peça o endereço digitado OU use a tool reverse_geocode se receber coordenadas
- Para fotos, oriente enviar depois no app

## Capacidades
1. Consultar boletos pendentes
2. Histórico de pagamentos
3. Status de sinistros
4. Abrir sinistro (coleta dados e registra para aprovação)
5. Solicitar assistência 24h (guincho, chaveiro, etc.)
6. Informações sobre veículos
7. Converter coordenadas GPS em endereço (reverse_geocode)

## REGRAS DE COBERTURA (VERIFICAR SEMPRE!)
Antes de criar QUALQUER solicitação, verifique a cobertura do veículo:

### Se veículo tem APENAS cobertura "Roubo/Furto" (cobertura_total = false):
- ✅ PERMITIDO: Sinistros de roubo/furto
- ❌ BLOQUEADO: Assistência 24h (guincho, chaveiro, pane, etc.)
- ❌ BLOQUEADO: Sinistros de colisão, incêndio, fenômenos naturais

### Se veículo tem cobertura "Total" (cobertura_total = true):
- ✅ TUDO LIBERADO

### Resposta quando bloqueado:
"Sua cobertura atual é apenas para roubo/furto. 
Após a instalação do rastreador, você terá acesso à cobertura total com assistência 24h.
Entre em contato com a associação para mais informações."

## Regras Gerais
- Use a DATA ATUAL fornecida para datas relativas
- Confirme dados antes de criar solicitações
- Informe que solicitações passam por aprovação
- NUNCA invente informações

## Formato
- Respostas curtas e diretas
- Use emojis com moderação
- Máximo 3-4 parágrafos por mensagem`;

// System prompt para confirmação de agendamento
const CONFIRMACAO_SYSTEM_PROMPT = `Você é o Assistente de Confirmação de Agendamentos da PRATIC.

## Sua Tarefa
Interpretar a resposta do cliente sobre confirmação de agendamento.

## Respostas do Cliente
Analise a mensagem e determine a INTENÇÃO:
- CONFIRMADO: Cliente disse sim, ok, confirmado, pode vir, estou aguardando, etc.
- REAGENDAR: Cliente quer remarcar, mudar data/hora, não pode hoje, etc.
- CANCELAR: Cliente quer cancelar completamente o serviço
- DUVIDA: Cliente tem dúvida sobre o serviço ou precisa de mais informações

## Resposta SEMPRE em JSON
{
  "intencao": "CONFIRMADO" | "REAGENDAR" | "CANCELAR" | "DUVIDA",
  "mensagem_resposta": "Mensagem para enviar ao cliente"
}

## Exemplos de Mensagens

Se CONFIRMADO:
"Perfeito, *{{nome}}*! ✅

Sua presença está *confirmada*!

Nosso técnico *{{tecnico}}* está a caminho e chegará em breve.

Aguarde no local combinado. 🚗"

Se REAGENDAR:
"Entendi, *{{nome}}*! 📅

Sem problemas, vamos reagendar.

Em breve nossa equipe entrará em contato para definir uma nova data e horário.

Obrigado pela compreensão! 🙏"

Se CANCELAR:
"Entendi, *{{nome}}*.

Lamentamos que não poderá realizar o serviço neste momento.

Se mudar de ideia, entre em contato conosco. 📞

Obrigado!"

Se DUVIDA:
"Olá, *{{nome}}*! 

{{responda a dúvida de forma breve}}

Por favor, confirme se poderá nos receber hoje no horário agendado. ✅"`;

// System prompt para reagendamento com IA
const REAGENDAMENTO_SYSTEM_PROMPT = `Você é o Assistente de Reagendamento da PRATIC.

## Sua Tarefa
Ajudar o cliente a escolher uma nova data e horário para o serviço.

## Informações Disponíveis
- Próximas 5 datas úteis disponíveis
- Períodos: MANHÃ (08:00-12:00) ou TARDE (14:00-18:00)

## Fluxo
1. Pergunte qual data o cliente prefere (oferecendo as opções)
2. Pergunte o período preferido (manhã ou tarde)
3. Confirme o novo agendamento

## Formato de Resposta (JSON)
{
  "etapa": "PERGUNTA_DATA" | "PERGUNTA_PERIODO" | "CONFIRMAR" | "FINALIZADO",
  "mensagem": "Mensagem para o cliente",
  "dados_coletados": {
    "data": "YYYY-MM-DD ou null",
    "periodo": "manha" | "tarde" | null
  }
}

## Regras
- Seja cordial e objetivo
- Ofereça opções claras
- Confirme os dados antes de finalizar
- Use formatação WhatsApp (*negrito*)`;

// Tools padrão do assistente - ALINHADAS COM APP
const tools = [
  {
    type: "function",
    function: {
      name: "get_boletos_pendentes",
      description: "Lista boletos pendentes do associado com URLs para envio de PDF",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_historico_pagamentos",
      description: "Histórico de pagamentos",
      parameters: {
        type: "object",
        properties: { limite: { type: "number" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sinistros",
      description: "Lista sinistros do associado",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_assistencias",
      description: "Lista chamados de assistência",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_veiculos",
      description: "Lista veículos do associado com informações de cobertura",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_solicitacao_sinistro",
      description: "Cria solicitação de sinistro para aprovação. IMPORTANTE: Verificar cobertura do veículo antes de usar.",
      parameters: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["colisao", "roubo_furto", "incendio", "fenomenos_naturais", "danos_terceiros", "outros"] },
          data_ocorrencia: { type: "string" },
          local: { type: "string" },
          descricao: { type: "string" },
        },
        required: ["tipo", "data_ocorrencia", "local", "descricao"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_solicitacao_assistencia",
      description: "Cria solicitação de assistência 24h. IMPORTANTE: Só pode ser usado se veículo tiver cobertura_total = true.",
      parameters: {
        type: "object",
        properties: {
          tipo_servico: { type: "string", enum: ["guincho", "chaveiro", "troca_pneu", "pane_seca", "pane_eletrica", "outros"] },
          localizacao: { type: "string" },
          descricao: { type: "string" },
        },
        required: ["tipo_servico", "localizacao", "descricao"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reverse_geocode",
      description: "Converte coordenadas GPS (latitude e longitude) em endereço legível. Use quando o cliente enviar coordenadas de localização.",
      parameters: {
        type: "object",
        properties: {
          latitude: { type: "number", description: "Latitude da localização" },
          longitude: { type: "number", description: "Longitude da localização" },
        },
        required: ["latitude", "longitude"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enviar_boleto_pdf",
      description: "Envia boleto em PDF via WhatsApp para o associado. Use quando o cliente pedir para receber o boleto no WhatsApp.",
      parameters: {
        type: "object",
        properties: {
          boleto_id: { type: "string", description: "ID do boleto a ser enviado (obtido de get_boletos_pendentes)" },
        },
      required: ["boleto_id"],
    },
  },
},
{
  type: "function",
  function: {
    name: "enviar_localizacao_veiculo",
    description: "Envia a localização atual do veículo como pin nativo do WhatsApp. Use quando o associado pedir para ver onde está o carro ou a última posição do rastreador.",
    parameters: {
      type: "object",
      properties: {
        veiculo_id: { type: "string", description: "ID do veículo (opcional, usa o primeiro ativo se não informado)" },
      },
      required: [],
    },
  },
},
{
  type: "function",
  function: {
    name: "enviar_contato_central",
    description: "Envia o cartão de contato da Central de Atendimento PRATICCAR. Use quando o associado perguntar o telefone da central ou como entrar em contato com a associação.",
    parameters: { type: "object", properties: {}, required: [] },
  },
},
{
  type: "function",
  function: {
    name: "enviar_contato_prestador",
    description: "Envia o cartão de contato do prestador de serviço (guincho, chaveiro, etc.) do chamado de assistência ativo. Use quando o associado quiser o contato do guincho ou prestador.",
    parameters: { type: "object", properties: {}, required: [] },
  },
},
];

// Executa tools
async function executeTool(supabase: any, associadoId: string, toolName: string, args: any, telefone?: string, instancia?: any): Promise<string> {
  console.log(`[whatsapp-webhook] Tool: ${toolName}`, args);

  switch (toolName) {
    case "get_boletos_pendentes": {
      // ATUALIZADO: Incluir boleto_url, pix_copia_cola e linha_digitavel
      const { data } = await supabase
        .from("cobrancas")
        .select("id, valor, data_vencimento, status, boleto_url, pix_copia_cola, linha_digitavel")
        .eq("associado_id", associadoId)
        .in("status", ["pendente", "vencido", "em_aberto"])
        .order("data_vencimento");

      if (!data?.length) return JSON.stringify({ message: "Sem boletos pendentes ✅" });

      const total = data.reduce((s: number, b: any) => s + (b.valor || 0), 0);
      return JSON.stringify({
        boletos: data.map((b: any) => ({
          id: b.id,
          valor: `R$ ${b.valor?.toFixed(2)}`,
          vencimento: new Date(b.data_vencimento).toLocaleDateString("pt-BR"),
          status: b.status,
          boleto_url: b.boleto_url || null,
          pix: b.pix_copia_cola || null,
          linha_digitavel: b.linha_digitavel || null,
        })),
        total: `R$ ${total.toFixed(2)}`,
        instrucao: "Para receber o boleto em PDF no WhatsApp, use a tool enviar_boleto_pdf com o id do boleto.",
      });
    }

    case "get_historico_pagamentos": {
      const { data } = await supabase
        .from("cobrancas")
        .select("valor, data_pagamento, competencia")
        .eq("associado_id", associadoId)
        .eq("status", "pago")
        .order("data_pagamento", { ascending: false })
        .limit(args.limite || 5);

      if (!data?.length) return JSON.stringify({ message: "Nenhum pagamento encontrado" });

      return JSON.stringify({
        pagamentos: data.map((p: any) => ({
          valor: `R$ ${p.valor?.toFixed(2)}`,
          pago_em: new Date(p.data_pagamento).toLocaleDateString("pt-BR"),
        })),
      });
    }

    case "get_sinistros": {
      const { data } = await supabase
        .from("sinistros")
        .select("protocolo, tipo, status, data_ocorrencia")
        .eq("associado_id", associadoId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!data?.length) return JSON.stringify({ message: "Nenhum sinistro registrado" });

      return JSON.stringify({
        sinistros: data.map((s: any) => ({
          protocolo: s.protocolo,
          tipo: s.tipo,
          status: s.status,
        })),
      });
    }

    case "get_assistencias": {
      const { data } = await supabase
        .from("chamados_assistencia")
        .select("protocolo, tipo_servico, status")
        .eq("associado_id", associadoId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!data?.length) return JSON.stringify({ message: "Nenhuma assistência registrada" });

      return JSON.stringify({
        chamados: data.map((c: any) => ({
          protocolo: c.protocolo,
          tipo: c.tipo_servico,
          status: c.status,
        })),
      });
    }

    case "get_veiculos": {
      // ATUALIZADO: Incluir dados de cobertura para verificação
      const { data } = await supabase
        .from("veiculos")
        .select("id, placa, marca, modelo, ano, status, cobertura_roubo_furto, cobertura_total")
        .eq("associado_id", associadoId);

      if (!data?.length) return JSON.stringify({ message: "Nenhum veículo encontrado" });

      return JSON.stringify({
        veiculos: data.map((v: any) => ({
          id: v.id,
          placa: v.placa,
          descricao: `${v.marca} ${v.modelo} ${v.ano}`,
          status: v.status,
          cobertura_roubo_furto: v.cobertura_roubo_furto ?? true,
          cobertura_total: v.cobertura_total ?? false,
          tipo_cobertura: v.cobertura_total ? "Total (todos os serviços)" : "Apenas Roubo/Furto",
        })),
      });
    }

    case "criar_solicitacao_sinistro": {
      const { data: veiculos } = await supabase
        .from("veiculos")
        .select("id, cobertura_total, cobertura_roubo_furto")
        .eq("associado_id", associadoId)
        .eq("status", "ativo")
        .limit(1);

      const veiculo = veiculos?.[0];
      
      // Verificar cobertura antes de criar sinistro
      if (veiculo && !veiculo.cobertura_total) {
        // Só permite roubo/furto se não tem cobertura total
        if (args.tipo !== "roubo_furto") {
          return JSON.stringify({
            sucesso: false,
            bloqueado: true,
            message: "Sua cobertura atual é apenas para roubo/furto. Para sinistros de colisão, incêndio ou outros, é necessário ter cobertura total. Entre em contato com a associação para mais informações.",
          });
        }
      }

      const { data, error } = await supabase.from("chat_solicitacoes_ia").insert({
        associado_id: associadoId,
        tipo: "sinistro",
        dados: {
          veiculo_id: veiculo?.id,
          tipo: args.tipo,
          data_ocorrencia: args.data_ocorrencia,
          local: args.local,
          descricao: args.descricao,
          origem: "whatsapp",
        },
        status: "pendente",
      }).select("id").single();

      if (error) throw error;

      return JSON.stringify({
        sucesso: true,
        message: "Solicitação de sinistro registrada! Um diretor irá analisar.",
      });
    }

    case "criar_solicitacao_assistencia": {
      const { data: veiculos } = await supabase
        .from("veiculos")
        .select("id, cobertura_total, cobertura_roubo_furto")
        .eq("associado_id", associadoId)
        .eq("status", "ativo")
        .limit(1);

      const veiculo = veiculos?.[0];
      
      // VERIFICAR COBERTURA - Assistência 24h requer cobertura total
      if (!veiculo?.cobertura_total) {
        return JSON.stringify({
          sucesso: false,
          bloqueado: true,
          message: "Sua cobertura atual é apenas para roubo/furto. A assistência 24h (guincho, chaveiro, etc.) está disponível apenas para veículos com cobertura total. Após a instalação do rastreador, você terá acesso à cobertura total. Entre em contato com a associação para mais informações.",
        });
      }

      const { data, error } = await supabase.from("chat_solicitacoes_ia").insert({
        associado_id: associadoId,
        tipo: "assistencia",
        dados: {
          veiculo_id: veiculo?.id,
          tipo_servico: args.tipo_servico,
          localizacao: args.localizacao,
          descricao: args.descricao,
          origem: "whatsapp",
        },
        status: "pendente",
      }).select("id").single();

      if (error) throw error;

      return JSON.stringify({
        sucesso: true,
        message: "Solicitação de assistência registrada! Um diretor irá aprovar em breve.",
      });
    }

    case "reverse_geocode": {
      // Nova tool: Converter coordenadas em endereço
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/reverse-geocode`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            latitude: args.latitude,
            longitude: args.longitude,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[whatsapp-webhook] Erro reverse_geocode: ${errText}`);
          return JSON.stringify({
            sucesso: false,
            message: "Não foi possível converter a localização em endereço. Por favor, digite o endereço manualmente.",
          });
        }

        const data = await response.json();
        
        if (data.success && data.endereco_completo) {
          return JSON.stringify({
            sucesso: true,
            endereco: data.endereco_completo,
            bairro: data.bairro,
            cidade: data.cidade,
            uf: data.uf,
            message: `Endereço encontrado: ${data.endereco_completo}`,
          });
        } else {
          return JSON.stringify({
            sucesso: false,
            message: "Localização não encontrada. Por favor, digite o endereço manualmente.",
          });
        }
      } catch (err) {
        console.error(`[whatsapp-webhook] Erro ao chamar reverse-geocode:`, err);
        return JSON.stringify({
          sucesso: false,
          message: "Erro ao processar localização. Por favor, digite o endereço manualmente.",
        });
      }
    }

    case "enviar_boleto_pdf": {
      // NOVA TOOL: Enviar boleto PDF via whatsapp-send-media
      const { boleto_id } = args;
      
      if (!boleto_id) {
        return JSON.stringify({ success: false, message: "ID do boleto não informado" });
      }

      // Buscar boleto do associado
      const { data: boleto, error: boletoError } = await supabase
        .from("cobrancas")
        .select("id, valor, data_vencimento, boleto_url, associado_id")
        .eq("id", boleto_id)
        .eq("associado_id", associadoId)
        .single();

      if (boletoError || !boleto) {
        console.log(`[whatsapp-webhook] Boleto não encontrado: ${boleto_id}`);
        return JSON.stringify({ success: false, message: "Boleto não encontrado ou não pertence a você" });
      }

      if (!boleto.boleto_url) {
        return JSON.stringify({ success: false, message: "Este boleto não possui PDF disponível. Tente gerar uma segunda via no portal." });
      }

      if (!telefone || !instancia) {
        return JSON.stringify({ success: false, message: "Erro de contexto: telefone ou instância não disponíveis" });
      }

      // Formatar dados para caption
      const valor = `R$ ${boleto.valor?.toFixed(2)}`;
      const vencimento = boleto.data_vencimento 
        ? new Date(boleto.data_vencimento).toLocaleDateString("pt-BR") 
        : "";

      try {
        const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
        
        // Enviar via Evolution API diretamente
        const mediaBody = {
          number: telefone,
          mediatype: "document",
          mimetype: "application/pdf",
          caption: `📄 *Boleto PRATICCAR*\n💰 Valor: ${valor}\n📅 Vencimento: ${vencimento}`,
          media: boleto.boleto_url,
          fileName: `boleto_praticcar_${vencimento.replace(/\//g, "-")}.pdf`,
        };

        console.log(`[whatsapp-webhook] Enviando boleto PDF para ${telefone}`);

        const response = await fetch(
          `${instancia.api_url}/message/sendMedia/${instancia.instance_name}`,
          {
            method: "POST",
            headers: {
              "apikey": EVOLUTION_API_KEY || "",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(mediaBody),
          }
        );

        const result = await response.json();

        if (result.key?.id) {
          // Registrar mensagem no banco
          await supabase.from("whatsapp_mensagens").insert({
            instancia_id: instancia.id,
            telefone: telefone,
            tipo: "document",
            mensagem: mediaBody.caption,
            media_url: boleto.boleto_url,
            media_mimetype: "application/pdf",
            media_filename: mediaBody.fileName,
            status: "enviada",
            message_id: result.key.id,
            referencia_tipo: "cobranca",
            referencia_id: boleto.id,
            direcao: "saida",
            sent_at: new Date().toISOString(),
          });

          console.log(`[whatsapp-webhook] Boleto PDF enviado com sucesso: ${result.key.id}`);
          return JSON.stringify({ 
            success: true, 
            message: "Pronto! O boleto em PDF foi enviado. Verifique nossa conversa! 📄" 
          });
        } else {
          console.error(`[whatsapp-webhook] Erro ao enviar boleto PDF:`, result);
          return JSON.stringify({ 
            success: false, 
            message: "Não foi possível enviar o boleto. Tente novamente mais tarde." 
          });
        }
      } catch (err) {
        console.error(`[whatsapp-webhook] Erro ao enviar boleto PDF:`, err);
        return JSON.stringify({ 
          success: false, 
          message: "Erro ao enviar boleto. Tente novamente mais tarde." 
        });
      }
    }

    case "enviar_localizacao_veiculo": {
      // Nova tool: Enviar localização do veículo via pin nativo do WhatsApp
      const { veiculo_id } = args;

      // Buscar veículo do associado
      let veiculoQuery = supabase
        .from("veiculos")
        .select("id, placa, marca, modelo")
        .eq("associado_id", associadoId)
        .eq("status", "ativo");
      
      if (veiculo_id) {
        veiculoQuery = veiculoQuery.eq("id", veiculo_id);
      }

      const { data: veiculos } = await veiculoQuery.limit(1);
      const veiculo = veiculos?.[0];

      if (!veiculo) {
        return JSON.stringify({ success: false, message: "Nenhum veículo ativo encontrado" });
      }

      // Buscar posição do rastreador
      const { data: rastreador } = await supabase
        .from("rastreadores")
        .select("id, ultima_posicao_lat, ultima_posicao_lng, ultima_comunicacao")
        .eq("veiculo_id", veiculo.id)
        .eq("status", "instalado")
        .maybeSingle();

      if (!rastreador) {
        return JSON.stringify({ success: false, message: "Este veículo não possui rastreador instalado" });
      }

      if (!rastreador.ultima_posicao_lat || !rastreador.ultima_posicao_lng) {
        return JSON.stringify({ success: false, message: "Posição do veículo não disponível. O rastreador ainda não enviou dados de localização." });
      }

      if (!telefone || !instancia) {
        return JSON.stringify({ success: false, message: "Erro de contexto: telefone ou instância não disponíveis" });
      }

      // Calcular há quanto tempo a posição foi atualizada
      let tempoAtras = "";
      if (rastreador.ultima_comunicacao) {
        const diff = Date.now() - new Date(rastreador.ultima_comunicacao).getTime();
        const minutos = Math.floor(diff / 60000);
        if (minutos < 60) {
          tempoAtras = `há ${minutos} minuto${minutos !== 1 ? 's' : ''}`;
        } else {
          const horas = Math.floor(minutos / 60);
          tempoAtras = `há ${horas} hora${horas !== 1 ? 's' : ''}`;
        }
      }

      try {
        const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

        // Buscar endereço via reverse geocoding
        let endereco = "Última posição conhecida";
        try {
          const geoResponse = await fetch(`${SUPABASE_URL}/functions/v1/reverse-geocode`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              latitude: rastreador.ultima_posicao_lat,
              longitude: rastreador.ultima_posicao_lng,
            }),
          });
          if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            if (geoData.success && geoData.endereco_completo) {
              endereco = geoData.endereco_completo;
            }
          }
        } catch (geoErr) {
          console.warn("[whatsapp-webhook] Erro no geocoding:", geoErr);
        }

        // Enviar pin de localização
        const locationBody = {
          number: telefone,
          name: `Veículo ${veiculo.placa}`,
          address: endereco + (tempoAtras ? ` (${tempoAtras})` : ""),
          latitude: rastreador.ultima_posicao_lat,
          longitude: rastreador.ultima_posicao_lng,
        };

        console.log(`[whatsapp-webhook] Enviando localização do veículo ${veiculo.placa}`);

        const response = await fetch(
          `${instancia.api_url}/message/sendLocation/${instancia.instance_name}`,
          {
            method: "POST",
            headers: {
              "apikey": EVOLUTION_API_KEY || "",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(locationBody),
          }
        );

        const result = await response.json();

        if (result.key?.id) {
          // Registrar mensagem no banco
          await supabase.from("whatsapp_mensagens").insert({
            instancia_id: instancia.id,
            telefone: telefone,
            tipo: "location",
            mensagem: `📍 ${locationBody.name}: ${locationBody.address}`,
            status: "enviada",
            message_id: result.key.id,
            referencia_tipo: "veiculo",
            referencia_id: veiculo.id,
            direcao: "saida",
            sent_at: new Date().toISOString(),
          });

          console.log(`[whatsapp-webhook] Localização enviada com sucesso: ${result.key.id}`);
          return JSON.stringify({ 
            success: true, 
            message: `Pronto! A localização do seu veículo ${veiculo.placa} foi enviada. Verifique o mapa na conversa! 📍${tempoAtras ? ` (Atualizado ${tempoAtras})` : ''}` 
          });
        } else {
          console.error(`[whatsapp-webhook] Erro ao enviar localização:`, result);
          return JSON.stringify({ 
            success: false, 
            message: "Não foi possível enviar a localização. Tente novamente mais tarde." 
          });
        }
      } catch (err) {
        console.error(`[whatsapp-webhook] Erro ao enviar localização:`, err);
        return JSON.stringify({ 
          success: false, 
          message: "Erro ao enviar localização. Tente novamente mais tarde." 
        });
      }
    }

    case "enviar_contato_central": {
      // Enviar cartão de contato da Central PRATICCAR
      if (!telefone || !instancia) {
        return JSON.stringify({ success: false, message: "Erro de contexto: telefone ou instância não disponíveis" });
      }

      // Buscar telefone da central nas configurações
      const { data: config } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", "assistencia_telefone_central")
        .maybeSingle();

      const telefoneCentral = config?.valor || "08001234567";
      const wuid = telefoneCentral.replace(/\D/g, '');

      try {
        const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

        const contactBody = {
          number: telefone,
          contact: [{
            fullName: "Central PRATICCAR 24h",
            wuid: wuid.startsWith('55') ? wuid : `55${wuid}`,
            phoneNumber: telefoneCentral,
            organization: "PRATICCAR Proteção Veicular",
            email: "",
            url: "",
          }],
        };

        console.log(`[whatsapp-webhook] Enviando contato da central para ${telefone}`);

        const response = await fetch(
          `${instancia.api_url}/message/sendContact/${instancia.instance_name}`,
          {
            method: "POST",
            headers: {
              "apikey": EVOLUTION_API_KEY || "",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(contactBody),
          }
        );

        const result = await response.json();

        if (result.key?.id || result.message?.contactMessage) {
          // Registrar mensagem no banco
          await supabase.from("whatsapp_mensagens").insert({
            instancia_id: instancia.id,
            telefone: telefone,
            tipo: "contact",
            mensagem: `📇 Contato: Central PRATICCAR 24h`,
            status: "enviada",
            message_id: result.key?.id || `contact_${Date.now()}`,
            referencia_tipo: "central",
            direcao: "saida",
            sent_at: new Date().toISOString(),
          });

          console.log(`[whatsapp-webhook] Contato da central enviado com sucesso`);
          return JSON.stringify({
            success: true,
            message: "Pronto! O cartão de contato da Central PRATICCAR foi enviado. Você pode salvá-lo diretamente no seu celular! 📇"
          });
        } else {
          console.error(`[whatsapp-webhook] Erro ao enviar contato da central:`, result);
          return JSON.stringify({
            success: false,
            message: "Não foi possível enviar o contato. Tente novamente mais tarde."
          });
        }
      } catch (err) {
        console.error(`[whatsapp-webhook] Erro ao enviar contato da central:`, err);
        return JSON.stringify({
          success: false,
          message: "Erro ao enviar contato. Tente novamente mais tarde."
        });
      }
    }

    case "enviar_contato_prestador": {
      // Enviar cartão de contato do prestador do chamado ativo
      if (!telefone || !instancia) {
        return JSON.stringify({ success: false, message: "Erro de contexto: telefone ou instância não disponíveis" });
      }

      // Buscar chamado ativo com prestador
      const { data: chamados } = await supabase
        .from("chamados_assistencia")
        .select("id, protocolo, prestador_nome, prestador_telefone, tipo_servico")
        .eq("associado_id", associadoId)
        .in("status", ["aguardando_prestador", "prestador_despachado", "prestador_a_caminho", "em_atendimento"])
        .order("created_at", { ascending: false })
        .limit(1);

      const chamado = chamados?.[0];

      if (!chamado) {
        return JSON.stringify({
          success: false,
          message: "Você não tem chamados de assistência ativos no momento."
        });
      }

      if (!chamado.prestador_nome || !chamado.prestador_telefone) {
        return JSON.stringify({
          success: false,
          message: "O prestador ainda não foi atribuído ao seu chamado. Aguarde alguns minutos."
        });
      }

      const wuid = chamado.prestador_telefone.replace(/\D/g, '');

      try {
        const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

        const contactBody = {
          number: telefone,
          contact: [{
            fullName: chamado.prestador_nome,
            wuid: wuid.startsWith('55') ? wuid : `55${wuid}`,
            phoneNumber: chamado.prestador_telefone,
            organization: "Prestador PRATICCAR",
            email: "",
            url: "",
          }],
        };

        console.log(`[whatsapp-webhook] Enviando contato do prestador para ${telefone}`);

        const response = await fetch(
          `${instancia.api_url}/message/sendContact/${instancia.instance_name}`,
          {
            method: "POST",
            headers: {
              "apikey": EVOLUTION_API_KEY || "",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(contactBody),
          }
        );

        const result = await response.json();

        if (result.key?.id || result.message?.contactMessage) {
          // Registrar mensagem no banco
          await supabase.from("whatsapp_mensagens").insert({
            instancia_id: instancia.id,
            telefone: telefone,
            tipo: "contact",
            mensagem: `📇 Contato: ${chamado.prestador_nome}`,
            status: "enviada",
            message_id: result.key?.id || `contact_${Date.now()}`,
            referencia_tipo: "chamado_assistencia",
            referencia_id: chamado.id,
            direcao: "saida",
            sent_at: new Date().toISOString(),
          });

          console.log(`[whatsapp-webhook] Contato do prestador enviado com sucesso`);
          return JSON.stringify({
            success: true,
            message: `Pronto! O cartão de contato do ${chamado.prestador_nome} foi enviado. Você pode salvá-lo e ligar diretamente! 📇`
          });
        } else {
          console.error(`[whatsapp-webhook] Erro ao enviar contato do prestador:`, result);
          return JSON.stringify({
            success: false,
            message: "Não foi possível enviar o contato. Tente novamente mais tarde."
          });
        }
      } catch (err) {
        console.error(`[whatsapp-webhook] Erro ao enviar contato do prestador:`, err);
        return JSON.stringify({
          success: false,
          message: "Erro ao enviar contato. Tente novamente mais tarde."
        });
      }
    }

    default:
      return JSON.stringify({ error: "Tool não reconhecida" });
  }
}

// Buscar contexto do associado - ATUALIZADO com dados de cobertura
async function getAssociadoContext(supabase: any, associadoId: string) {
  const { data: associado } = await supabase
    .from("associados")
    .select("nome, email, telefone, status")
    .eq("id", associadoId)
    .single();

  // ATUALIZADO: Incluir dados de cobertura dos veículos
  const { data: veiculos } = await supabase
    .from("veiculos")
    .select("placa, marca, modelo, ano, status, cobertura_roubo_furto, cobertura_total")
    .eq("associado_id", associadoId)
    .limit(3);

  // Formatar veículos com informação de cobertura
  const veiculosFormatados = veiculos?.map((v: any) => {
    const cobertura = v.cobertura_total ? "TOTAL" : "APENAS ROUBO/FURTO";
    return `${v.placa} (${v.marca} ${v.modelo}) - Cobertura: ${cobertura}`;
  }).join("\n  - ") || "Nenhum";

  return `
## CONTEXTO DO ASSOCIADO
- Nome: ${associado?.nome || "N/A"}
- Status: ${associado?.status || "N/A"}
- Veículos:
  - ${veiculosFormatados}
- Data atual: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}

## IMPORTANTE - REGRAS DE COBERTURA
Verifique SEMPRE a cobertura antes de criar solicitações:
- Se cobertura = "APENAS ROUBO/FURTO": NÃO criar assistência 24h nem sinistros de colisão/incêndio
- Se cobertura = "TOTAL": Pode criar qualquer solicitação
`;
}

// Buscar histórico de conversa
async function getConversationHistory(supabase: any, associadoId: string, telefone: string) {
  const { data } = await supabase
    .from("chat_mensagens_ia")
    .select("role, content")
    .eq("associado_id", associadoId)
    .order("created_at", { ascending: false })
    .limit(10);

  return (data || []).reverse();
}

// Chamar a IA - ATUALIZADO para usar Gemini 3 Flash via ai.gateway.lovable.dev
async function callAI(messages: any[], systemPrompt: string, useTools: boolean = true) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

  const body: any = {
    model: "google/gemini-3-flash-preview", // ATUALIZADO: Mesmo modelo do App
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    max_tokens: 1000,
  };

  if (useTools) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  // ATUALIZADO: Usar ai.gateway.lovable.dev (mesmo endpoint do App)
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`[whatsapp-webhook] AI Error: ${err}`);
    throw new Error(`AI Error: ${err}`);
  }

  return response.json();
}

// Enviar mensagem via Evolution API - ATUALIZADO para retornar messageId
async function sendWhatsAppMessage(apiUrl: string, instanceName: string, telefone: string, texto: string): Promise<{ ok: boolean; messageId?: string }> {
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
  if (!EVOLUTION_API_KEY) throw new Error("EVOLUTION_API_KEY não configurada");

  const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: EVOLUTION_API_KEY,
    },
    body: JSON.stringify({
      number: telefone,
      text: texto,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`[whatsapp-webhook] Erro ao enviar: ${err}`);
    return { ok: false };
  }

  // Extrair message_id da resposta da Evolution API
  try {
    const result = await response.json();
    const messageId = result?.key?.id;
    console.log(`[whatsapp-webhook] Mensagem enviada, messageId: ${messageId}`);
    return { ok: true, messageId };
  } catch (e) {
    console.warn(`[whatsapp-webhook] Resposta não é JSON, sem messageId`);
    return { ok: true };
  }
}

// Salvar mensagem no histórico
async function saveMessage(supabase: any, associadoId: string, role: string, content: string) {
  await supabase.from("chat_mensagens_ia").insert({
    associado_id: associadoId,
    role,
    content,
  });
}

// Salvar log de mensagem WhatsApp - ATUALIZADO para aceitar messageId
async function saveWhatsAppLog(
  supabase: any, 
  instanciaId: string, 
  telefone: string, 
  mensagem: string, 
  direcao: string, 
  messageId?: string
) {
  await supabase.from("whatsapp_mensagens").insert({
    instancia_id: instanciaId,
    telefone,
    tipo: "text",
    mensagem,
    direcao,
    status: direcao === "saida" ? "enviada" : "entregue",
    message_id: messageId || null,
    sent_at: direcao === "saida" ? new Date().toISOString() : null,
  });
}

// ============================================
// PROCESSAR RESPOSTA DE CONFIRMAÇÃO DE AGENDAMENTO
// ============================================
async function processarRespostaConfirmacao(
  supabase: any,
  confirmacao: any,
  mensagemCliente: string,
  instancia: any
): Promise<Response> {
  console.log(`[whatsapp-webhook] Processando confirmação para serviço ${confirmacao.servico_id}`);

  const contexto = confirmacao.contexto_ia || {};
  const nomeCliente = contexto.nome_cliente || "Cliente";
  const nomeTecnico = contexto.nome_tecnico || "Técnico";

  // Se já está em reagendamento, processar com IA de reagendamento
  if (confirmacao.status === 'reagendando') {
    return await processarReagendamento(supabase, confirmacao, mensagemCliente, instancia);
  }

  // Usar IA para interpretar a resposta
  const promptCompleto = CONFIRMACAO_SYSTEM_PROMPT
    .replace(/\{\{nome\}\}/g, nomeCliente.split(' ')[0])
    .replace(/\{\{tecnico\}\}/g, nomeTecnico);

  const aiResponse = await callAI([
    { role: "user", content: `Mensagem do cliente: "${mensagemCliente}"` }
  ], promptCompleto, false);

  const content = aiResponse.choices?.[0]?.message?.content || "";
  
  let resultado: { intencao: string; mensagem_resposta: string };
  try {
    // Tentar extrair JSON da resposta
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      resultado = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("JSON não encontrado");
    }
  } catch (e) {
    // Fallback: inferir intenção de palavras-chave
    const msgLower = mensagemCliente.toLowerCase().trim();
    if (/^(sim|ok|confirmado|confirmo|pode|estou|aguardando|certo|beleza|blz|s|yes)/.test(msgLower)) {
      resultado = {
        intencao: "CONFIRMADO",
        mensagem_resposta: `Perfeito, *${nomeCliente.split(' ')[0]}*! ✅\n\nSua presença está *confirmada*!\n\nNosso técnico *${nomeTecnico}* está a caminho.\n\nAguarde no local combinado. 🚗`
      };
    } else if (/reagend|remar|mud|outro|n[aã]o|nao posso|impossível|trocar/.test(msgLower)) {
      resultado = {
        intencao: "REAGENDAR",
        mensagem_resposta: `Entendi, *${nomeCliente.split(' ')[0]}*! 📅\n\nSem problemas, vamos reagendar.\n\nEm breve nossa equipe entrará em contato para definir uma nova data e horário.\n\nObrigado pela compreensão! 🙏`
      };
    } else {
      resultado = {
        intencao: "DUVIDA",
        mensagem_resposta: `Olá, *${nomeCliente.split(' ')[0]}*!\n\nPor favor, confirme se poderá nos receber hoje no horário agendado.\n\nResponda *SIM* para confirmar ou informe se precisa *reagendar*. ✅`
      };
    }
  }

  // Atualizar confirmação
  await supabase.from('confirmacoes_agendamento')
    .update({
      resposta_cliente: mensagemCliente,
      resposta_recebida_em: new Date().toISOString(),
      status: resultado.intencao === 'CONFIRMADO' ? 'confirmada' :
              resultado.intencao === 'REAGENDAR' ? 'reagendando' :
              resultado.intencao === 'CANCELAR' ? 'cancelada' : 'enviada'
    })
    .eq('id', confirmacao.id);

  // Se confirmou, atualizar serviço e notificar vistoriador
  if (resultado.intencao === 'CONFIRMADO') {
    await supabase.from('servicos')
      .update({
        confirmacao_whatsapp: 'confirmada',
        confirmado_via_whatsapp_em: new Date().toISOString()
      })
      .eq('id', confirmacao.servico_id);

    // Buscar dados do serviço para notificar vistoriador
    const { data: servico } = await supabase
      .from('servicos')
      .select('profissional_id, hora_agendada')
      .eq('id', confirmacao.servico_id)
      .single();

    if (servico?.profissional_id) {
      // Enviar push notification para o vistoriador
      try {
        await supabase.functions.invoke('send-push-profissional', {
          body: {
            profissional_id: servico.profissional_id,
            notification: {
              title: '✅ Cliente Confirmou!',
              body: `${nomeCliente} confirmou presença para ${servico.hora_agendada?.slice(0, 5) || 'hoje'}`,
              tag: `confirmacao-${confirmacao.servico_id}`,
              data: {
                servico_id: confirmacao.servico_id,
                action: 'confirmacao_whatsapp'
              }
            }
          }
        });
        console.log(`[whatsapp-webhook] Push enviado para profissional ${servico.profissional_id}`);
      } catch (pushErr) {
        console.error('[whatsapp-webhook] Erro ao enviar push:', pushErr);
      }
    }
  }

  // Se quer reagendar, criar encaixe urgente para outros vistoriadores
  if (resultado.intencao === 'REAGENDAR') {
    // 1. Buscar dados completos do serviço
    const { data: servico } = await supabase
      .from('servicos')
      .select(`
        id, tipo, data_agendada, hora_agendada, periodo,
        logradouro, numero, bairro, cidade, uf,
        associado:associados!servicos_associado_id_fkey(nome, telefone, whatsapp),
        veiculo:veiculos!servicos_veiculo_id_fkey(placa, marca, modelo)
      `)
      .eq('id', confirmacao.servico_id)
      .single();

    if (servico) {
      const telefoneCliente = servico.associado?.whatsapp || servico.associado?.telefone || confirmacao.telefone;
      const nomeCliente = servico.associado?.nome || 'Cliente';
      const veiculoInfo = servico.veiculo 
        ? `${servico.veiculo.marca} ${servico.veiculo.modelo} - ${servico.veiculo.placa}`
        : 'Veículo não informado';
      const enderecoInfo = [servico.logradouro, servico.numero, servico.bairro, servico.cidade]
        .filter(Boolean)
        .join(', ') || 'Endereço não informado';

      // 2. Criar encaixe urgente para outros vistoriadores
      const { error: encaixeError } = await supabase.from('encaixes_urgentes').insert({
        servico_id: confirmacao.servico_id,
        status: 'disponivel',
        motivo: 'cliente_reagendou',
        telefone_cliente: telefoneCliente,
        nome_cliente: nomeCliente,
        dados_servico: {
          tipo: servico.tipo,
          data: servico.data_agendada,
          hora: servico.hora_agendada,
          periodo: servico.periodo,
          endereco: enderecoInfo,
          veiculo: veiculoInfo,
        },
      });

      if (encaixeError) {
        console.error('[whatsapp-webhook] Erro ao criar encaixe urgente:', encaixeError);
      } else {
        console.log('[whatsapp-webhook] Encaixe urgente criado para serviço', confirmacao.servico_id);
      }
    }

    // 3. Atualizar serviço: remover profissional e marcar como reagendado
    await supabase.from('servicos')
      .update({ 
        confirmacao_whatsapp: 'reagendado',
        profissional_id: null,  // Liberar para outro vistoriador
      })
      .eq('id', confirmacao.servico_id);
  }

  // Enviar resposta ao cliente
  await sendWhatsAppMessage(instancia.api_url, instancia.instance_name, confirmacao.telefone, resultado.mensagem_resposta);
  await saveWhatsAppLog(supabase, instancia.id, confirmacao.telefone, resultado.mensagem_resposta, "saida");

  console.log(`[whatsapp-webhook] Confirmação processada: ${resultado.intencao}`);

  return new Response(JSON.stringify({ ok: true, intencao: resultado.intencao }), { headers: corsHeaders });
}

// Processar fluxo de reagendamento
async function processarReagendamento(
  supabase: any,
  confirmacao: any,
  mensagemCliente: string,
  instancia: any
): Promise<Response> {
  console.log(`[whatsapp-webhook] Processando reagendamento para ${confirmacao.servico_id}`);

  // Por enquanto, apenas informar que a equipe entrará em contato
  // Em uma versão futura, podemos implementar a IA de reagendamento completa
  const mensagem = `Entendi! 📅

Nossa equipe de agendamento entrará em contato em breve para definir uma nova data e horário para seu serviço.

Obrigado pela compreensão! 🙏`;

  await sendWhatsAppMessage(instancia.api_url, instancia.instance_name, confirmacao.telefone, mensagem);
  await saveWhatsAppLog(supabase, instancia.id, confirmacao.telefone, mensagem, "saida");

  // Marcar como reagendando (equipe vai contatar)
  await supabase.from('confirmacoes_agendamento')
    .update({ status: 'reagendada' })
    .eq('id', confirmacao.id);

  return new Response(JSON.stringify({ ok: true, action: 'reagendamento_solicitado' }), { headers: corsHeaders });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("[whatsapp-webhook] Payload:", JSON.stringify(payload).substring(0, 500));

    // Criar cliente Supabase (necessário para eventos de conexão também)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ========================================
    // PROCESSAR EVENTOS DE CONEXÃO (CONNECTION_UPDATE)
    // ========================================
    if (payload.event === "connection.update") {
      const state = payload.data?.state || payload.instance?.state;
      console.log(`[whatsapp-webhook] CONNECTION_UPDATE recebido: ${state}`);
      
      // Mapear estado para nosso status
      const novoStatus = state === 'open' ? 'open' : 'disconnected';
      
      // Buscar instância principal
      const { data: instancia } = await supabase
        .from("whatsapp_instancias")
        .select("id, status")
        .eq("principal", true)
        .single();
      
      if (instancia) {
        const statusAnterior = instancia.status;
        
        // Atualizar status no banco
        await supabase
          .from('whatsapp_instancias')
          .update({
            status: novoStatus,
            updated_at: new Date().toISOString(),
            ultima_conexao: novoStatus === 'open' ? new Date().toISOString() : undefined,
          })
          .eq('id', instancia.id);
        
        console.log(`[whatsapp-webhook] Status atualizado: ${statusAnterior} -> ${novoStatus}`);
        
        // Se desconectou, criar notificação para diretores
        if (novoStatus === 'disconnected' && statusAnterior === 'open') {
          console.log('[whatsapp-webhook] Criando notificação de desconexão');
          
          // Registrar log da desconexão
          await supabase
            .from('whatsapp_logs')
            .insert({
              instancia_id: instancia.id,
              tipo: 'connection',
              evento: 'disconnected',
              payload: payload.data,
              resposta: { state, timestamp: new Date().toISOString() },
            });
          
          // Criar notificação geral (buscar diretores)
          const { data: diretores } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'diretor');
          
          if (diretores?.length) {
            const notificacoes = diretores.map(d => ({
              usuario_id: d.user_id,
              titulo: '⚠️ WhatsApp Desconectado',
              mensagem: 'A conexão do WhatsApp foi perdida. Acesse Configurações > Integrações para reconectar.',
              tipo: 'alerta',
              lida: false,
            }));
            
            await supabase.from('notificacoes').insert(notificacoes);
          }
        }
        
        // Se reconectou, registrar log
        if (novoStatus === 'open' && statusAnterior !== 'open') {
          await supabase
            .from('whatsapp_logs')
            .insert({
              instancia_id: instancia.id,
              tipo: 'connection',
              evento: 'connected',
              payload: payload.data,
              resposta: { state, timestamp: new Date().toISOString() },
            });
        }
      }
      
      return new Response(JSON.stringify({ ok: true, event: 'connection.update', status: novoStatus }), { headers: corsHeaders });
    }

    // ============================================
    // PROCESSAR EVENTOS DE STATUS DE MENSAGEM (MESSAGES_UPDATE)
    // ============================================
    if (payload.event === "messages.update") {
      console.log('[whatsapp-webhook] MESSAGES_UPDATE recebido');
      
      // A Evolution API pode enviar em formatos diferentes
      const updates = payload.data?.messages || payload.data || [];
      const updatesList = Array.isArray(updates) ? updates : [updates];
      
      for (const update of updatesList) {
        // Extrair messageId - pode vir em diferentes formatos
        const messageId = update.key?.id || update.id;
        // Status pode vir em update.status ou update.update.status
        const status = update.status ?? update.update?.status;
        
        if (!messageId) {
          console.log('[whatsapp-webhook] MESSAGES_UPDATE sem messageId, ignorando');
          continue;
        }
        
        console.log(`[whatsapp-webhook] Status update: ${messageId} -> ${status}`);
        
        // Mapear status da Evolution para nosso sistema
        // 0=ERROR, 1=PENDING, 2=SERVER_ACK(enviada), 3=DELIVERY_ACK(entregue), 4=READ(lida), 5=PLAYED(reproduzida)
        const statusMap: Record<number, { status: string; field: string }> = {
          0: { status: 'erro', field: '' },
          1: { status: 'pendente', field: '' },
          2: { status: 'enviada', field: 'sent_at' },
          3: { status: 'entregue', field: 'delivered_at' },
          4: { status: 'lida', field: 'read_at' },
          5: { status: 'reproduzida', field: 'read_at' }, // Para áudio/vídeo
        };
        
        const statusInfo = statusMap[status];
        
        if (statusInfo) {
          const updateData: Record<string, any> = {
            status: statusInfo.status,
            updated_at: new Date().toISOString(),
          };
          
          // Preencher campo de timestamp correspondente
          if (statusInfo.field) {
            updateData[statusInfo.field] = new Date().toISOString();
          }
          
          // Atualizar mensagem no banco pelo message_id
          const { error, count } = await supabase
            .from('whatsapp_mensagens')
            .update(updateData)
            .eq('message_id', messageId);
          
          if (error) {
            console.error(`[whatsapp-webhook] Erro ao atualizar status: ${error.message}`);
          } else {
            console.log(`[whatsapp-webhook] Status atualizado: ${messageId} -> ${statusInfo.status}`);
          }
        } else {
          console.log(`[whatsapp-webhook] Status desconhecido: ${status}`);
        }
      }
      
      // Log do evento (sem dependência de instancia que é declarada depois)
      console.log(`[whatsapp-webhook] MESSAGES_UPDATE processado: ${updatesList.length} atualizações`);
      
      return new Response(JSON.stringify({ ok: true, event: 'messages.update' }), { headers: corsHeaders });
    }

    // Ignorar outros eventos que não são mensagens
    if (payload.event !== "messages.upsert") {
      console.log(`[whatsapp-webhook] Evento ignorado: ${payload.event}`);
      return new Response(JSON.stringify({ ok: true, ignored: true, event: payload.event }), { headers: corsHeaders });
    }

    const data = payload.data;
    if (!data?.key || data.key.fromMe) {
      return new Response(JSON.stringify({ ok: true, ignored: "própria mensagem" }), { headers: corsHeaders });
    }

    // Extrair telefone e texto
    const remoteJid = data.key.remoteJid || "";
    
    // Log detalhado para debug
    console.log("[whatsapp-webhook] Dados recebidos:", {
      remoteJid: data.key.remoteJid,
      sender: payload.sender,
      fromMe: data.key.fromMe
    });
    
    if (remoteJid.includes("@g.us")) {
      // Ignorar grupos
      return new Response(JSON.stringify({ ok: true, ignored: "grupo" }), { headers: corsHeaders });
    }

    // Extrair telefone - suporte para formato LID vs tradicional
    let telefone: string;
    if (remoteJid.includes("@lid")) {
      // LID: Usar campo "sender" que contém o telefone real
      const sender = payload.sender || "";
      telefone = sender.replace("@s.whatsapp.net", "").replace(/\D/g, "");
      
      if (!telefone) {
        console.error("[whatsapp-webhook] LID sem sender válido:", { remoteJid, sender });
        return new Response(JSON.stringify({ ok: true, ignored: "lid_sem_sender" }), { headers: corsHeaders });
      }
      
      console.log(`[whatsapp-webhook] LID detectado, telefone extraído de sender: ${telefone}`);
    } else {
      telefone = remoteJid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
    }
    
    const mensagemTexto = data.message?.conversation || data.message?.extendedTextMessage?.text || "";

    if (!mensagemTexto.trim()) {
      return new Response(JSON.stringify({ ok: true, ignored: "sem texto" }), { headers: corsHeaders });
    }

    console.log(`[whatsapp-webhook] Mensagem de ${telefone}: ${mensagemTexto.substring(0, 100)}`);

    // Reusar cliente Supabase já criado acima (na linha 831)
    // (supabase já foi criado no início do try block)

    // Buscar instância e verificar se IA está habilitada
    const { data: instancia } = await supabase
      .from("whatsapp_instancias")
      .select("id, api_url, instance_name, ia_habilitada")
      .eq("principal", true)
      .single();

    if (!instancia) {
      console.error("[whatsapp-webhook] Instância não encontrada");
      return new Response(JSON.stringify({ error: "Instância não configurada" }), { headers: corsHeaders });
    }

    // Formatar telefone para busca (múltiplas variantes)
    const telefoneLimpo = telefone.replace(/\D/g, "");
    const telefonesBusca = [telefoneLimpo];
    if (telefoneLimpo.startsWith("55") && telefoneLimpo.length >= 12) {
      telefonesBusca.push(telefoneLimpo.substring(2)); // sem DDI
    }
    if (!telefoneLimpo.startsWith("55")) {
      telefonesBusca.push("55" + telefoneLimpo); // com DDI
    }

    // ========================================
    // VERIFICAR SE É RESPOSTA DE CONFIRMAÇÃO
    // ========================================
    const { data: confirmacaoPendente } = await supabase
      .from('confirmacoes_agendamento')
      .select('*, servico:servicos(id, profissional_id, hora_agendada)')
      .in('telefone', telefonesBusca)
      .in('status', ['enviada', 'reagendando'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (confirmacaoPendente) {
      console.log(`[whatsapp-webhook] Resposta de confirmação detectada para ${confirmacaoPendente.servico_id}`);
      return await processarRespostaConfirmacao(supabase, confirmacaoPendente, mensagemTexto, instancia);
    }

    // ========================================
    // FLUXO PADRÃO: ASSOCIADO
    // ========================================
    if (!instancia.ia_habilitada) {
      console.log("[whatsapp-webhook] IA desabilitada, ignorando");
      return new Response(JSON.stringify({ ok: true, ignored: "IA desabilitada" }), { headers: corsHeaders });
    }

    // Buscar associado pelo telefone
    const { data: associado } = await supabase
      .from("associados")
      .select("id, nome, status")
      .or(`whatsapp.in.(${telefonesBusca.join(",")}),telefone.in.(${telefonesBusca.join(",")})`)
      .eq("status", "ativo")
      .maybeSingle();

    if (!associado) {
      console.log(`[whatsapp-webhook] Associado não encontrado para ${telefone}`);
      await sendWhatsAppMessage(
        instancia.api_url,
        instancia.instance_name,
        telefone,
        "Olá! Este número não está cadastrado como associado PRATIC. Entre em contato com nossa central para mais informações. 📞"
      );
      return new Response(JSON.stringify({ ok: true, notFound: true }), { headers: corsHeaders });
    }

    console.log(`[whatsapp-webhook] Associado encontrado: ${associado.nome} (${associado.id})`);

    // Salvar mensagem recebida
    await saveWhatsAppLog(supabase, instancia.id, telefone, mensagemTexto, "entrada");
    await saveMessage(supabase, associado.id, "user", mensagemTexto);

    // Buscar contexto e histórico
    const context = await getAssociadoContext(supabase, associado.id);
    const history = await getConversationHistory(supabase, associado.id, telefone);

    // Preparar mensagens para IA
    const messages = [
      ...history.map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: mensagemTexto },
    ];

    // Loop de tool calls
    let aiResponse = await callAI(messages, WHATSAPP_SYSTEM_PROMPT + "\n\n" + context);
    let assistantMessage = aiResponse.choices?.[0]?.message;
    let iterations = 0;
    const maxIterations = 5;

    while (assistantMessage?.tool_calls && iterations < maxIterations) {
      iterations++;
      const toolResults = [];

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || "{}");
        const result = await executeTool(supabase, associado.id, toolName, toolArgs);
        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          content: result,
        });
      }

      // Continuar conversa com resultados das tools
      aiResponse = await callAI(
        [
          ...messages,
          assistantMessage,
          ...toolResults,
        ],
        WHATSAPP_SYSTEM_PROMPT + "\n\n" + context
      );
      assistantMessage = aiResponse.choices?.[0]?.message;
    }

    // Extrair resposta final
    const respostaFinal = assistantMessage?.content || "Desculpe, não consegui processar sua mensagem. Tente novamente.";

    // Salvar e enviar resposta - capturar messageId para tracking de status
    await saveMessage(supabase, associado.id, "assistant", respostaFinal);
    const sendResult = await sendWhatsAppMessage(instancia.api_url, instancia.instance_name, telefone, respostaFinal);
    await saveWhatsAppLog(supabase, instancia.id, telefone, respostaFinal, "saida", sendResult.messageId);

    console.log(`[whatsapp-webhook] Resposta enviada para ${telefone}`);

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (error: any) {
    console.error("[whatsapp-webhook] Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
