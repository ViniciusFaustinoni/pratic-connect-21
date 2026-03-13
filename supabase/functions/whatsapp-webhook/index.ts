import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Vincular mídia recebida a documento de SINISTRO pendente
async function vincularMidiaASinistroPendente(
  supabase: any,
  telefonesBusca: string[],
  mediaArmazenada: string,
  instancia: { api_url: string; instance_name: string; id: string }
): Promise<{ vinculado: boolean; mensagem?: string }> {
  try {
    // Buscar associado pelo telefone
    const { data: associado } = await supabase
      .from("associados")
      .select("id, nome")
      .or(`whatsapp.in.(${telefonesBusca.join(",")}),telefone.in.(${telefonesBusca.join(",")})`)
      .maybeSingle();

    if (!associado) {
      console.log("[whatsapp-webhook] Nenhum associado encontrado para vincular sinistro");
      return { vinculado: false };
    }

    // Buscar sinistro com status documentacao_pendente
    const { data: sinistros } = await supabase
      .from("sinistros")
      .select("id, protocolo, status")
      .eq("associado_id", associado.id)
      .eq("status", "documentacao_pendente")
      .order("created_at", { ascending: false })
      .limit(1);

    if (!sinistros?.length) {
      console.log("[whatsapp-webhook] Nenhum sinistro com documentos pendentes");
      return { vinculado: false };
    }

    const sinistro = sinistros[0];
    console.log(`[whatsapp-webhook] Sinistro encontrado: ${sinistro.protocolo}`);

    // Buscar documento pendente mais antigo
    const { data: docsPendentes } = await supabase
      .from("sinistro_documentos")
      .select("id, tipo, nome_arquivo")
      .eq("sinistro_id", sinistro.id)
      .eq("status", "pendente")
      .order("created_at", { ascending: true })
      .limit(1);

    if (!docsPendentes?.length) {
      console.log("[whatsapp-webhook] Nenhum documento pendente no sinistro");
      return { vinculado: false };
    }

    const doc = docsPendentes[0];

    // Atualizar documento com arquivo recebido
    const { error: updateError } = await supabase
      .from("sinistro_documentos")
      .update({
        arquivo_url: mediaArmazenada,
        status: "enviado",
        enviado_em: new Date().toISOString(),
      })
      .eq("id", doc.id);

    if (updateError) {
      console.error("[whatsapp-webhook] Erro ao atualizar documento sinistro:", updateError);
      return { vinculado: false };
    }

    // Contar documentos ainda pendentes
    const { count: pendentesCount } = await supabase
      .from("sinistro_documentos")
      .select("id", { count: "exact", head: true })
      .eq("sinistro_id", sinistro.id)
      .eq("status", "pendente");

    const documentosRestantes = pendentesCount || 0;

    // Se todos enviados, atualizar status do sinistro para em_analise
    if (documentosRestantes === 0) {
      await supabase
        .from("sinistros")
        .update({ 
          status: "em_analise", 
          updated_at: new Date().toISOString() 
        })
        .eq("id", sinistro.id);

      await supabase.from("sinistro_historico").insert({
        sinistro_id: sinistro.id,
        status_anterior: "documentacao_pendente",
        status_novo: "em_analise",
        observacao: "Todos os documentos foram enviados via WhatsApp",
      });
    }

    const tipoFormatado = doc.nome_arquivo || doc.tipo.replace(/_/g, " ");
    console.log(`[whatsapp-webhook] Documento de sinistro vinculado: ${tipoFormatado}`);

    const mensagem = documentosRestantes > 0
      ? `✅ Recebemos sua foto para o sinistro *${sinistro.protocolo}*!\n\n📄 Documento: ${tipoFormatado}\n\n📋 Ainda faltam *${documentosRestantes} documento(s)*.\n\nEnvie os demais para dar continuidade.`
      : `✅ *Todos os Documentos Recebidos*\n\nRecebemos todos os documentos do sinistro *${sinistro.protocolo}*!\n\n🔍 Seu sinistro entrou em análise.\n\n⏰ Prazo estimado: até 5 dias úteis.`;

    return { vinculado: true, mensagem };
  } catch (err) {
    console.error("[whatsapp-webhook] Erro ao vincular mídia a sinistro:", err);
    return { vinculado: false };
  }
}

// Formatar tipo de documento para exibição
function formatarTipoDocumento(tipo: string): string {
  const tipos: Record<string, string> = {
    cnh: 'CNH',
    cpf: 'CPF',
    rg: 'RG',
    crlv: 'CRLV',
    comprovante_residencia: 'Comprovante de Residência',
    contrato_assinado: 'Contrato Assinado',
    foto_veiculo: 'Foto do Veículo',
    foto_hodometro: 'Foto do Hodômetro',
    nota_fiscal: 'Nota Fiscal',
    outro: 'Outro',
  };
  return tipos[tipo] || tipo;
}

// Vincular mídia recebida a documento pendente de CADASTRO
async function vincularMidiaADocumentoPendente(
  supabase: any,
  telefonesBusca: string[],
  mediaArmazenada: string,
  tipoMidia: 'imagem' | 'documento',
  mediaFilename: string | null,
  instancia: { api_url: string; instance_name: string }
): Promise<{ vinculado: boolean; mensagem?: string }> {
  try {
    // Buscar associado pelo telefone que tenha documentos pendentes
    const { data: associado } = await supabase
      .from("associados")
      .select("id, nome, status, whatsapp, telefone")
      .or(`whatsapp.in.(${telefonesBusca.join(",")}),telefone.in.(${telefonesBusca.join(",")})`)
      .in("status", ["documentacao_pendente", "pendente_documentos", "pre_cadastro", "aguardando_vistoria"])
      .maybeSingle();

    if (!associado) {
      console.log("[whatsapp-webhook] Nenhum associado com documentos pendentes encontrado");
      return { vinculado: false };
    }

    console.log(`[whatsapp-webhook] Associado encontrado: ${associado.nome} (status: ${associado.status})`);

    // Buscar documento_solicitado pendente mais antigo
    const { data: docsPendentes } = await supabase
      .from("documentos_solicitados")
      .select("id, tipo_documento, contrato_id, associado_id")
      .eq("associado_id", associado.id)
      .eq("status", "pendente")
      .order("created_at", { ascending: true })
      .limit(1);

    if (!docsPendentes || docsPendentes.length === 0) {
      // Tentar buscar em contratos_documentos
      const { data: contratosDocsPendentes } = await supabase
        .from("contratos_documentos")
        .select(`
          id, 
          tipo,
          contrato:contratos!inner(id, associado_id)
        `)
        .eq("status", "pendente")
        .eq("contratos.associado_id", associado.id)
        .order("created_at", { ascending: true })
        .limit(1);

      if (!contratosDocsPendentes || contratosDocsPendentes.length === 0) {
        console.log("[whatsapp-webhook] Nenhum documento pendente encontrado para o associado");
        return { vinculado: false };
      }

      const docPendente = contratosDocsPendentes[0];
      
      // Atualizar contratos_documentos com o arquivo
      const { error: updateError } = await supabase
        .from("contratos_documentos")
        .update({
          arquivo_url: mediaArmazenada,
          status: "enviado",
          enviado_em: new Date().toISOString(),
        })
        .eq("id", docPendente.id);

      if (updateError) {
        console.error("[whatsapp-webhook] Erro ao atualizar documento:", updateError);
        return { vinculado: false };
      }

      const tipoFormatado = formatarTipoDocumento(docPendente.tipo);
      console.log(`[whatsapp-webhook] Documento vinculado ao contrato: ${tipoFormatado}`);
      
      return {
        vinculado: true,
        mensagem: `✅ Documento "${tipoFormatado}" recebido com sucesso! Aguarde a análise do nosso time.`,
      };
    }

    const docSolicitado = docsPendentes[0];

    // Criar registro em documentos
    const { data: novoDoc, error: insertError } = await supabase
      .from("documentos")
      .insert({
        associado_id: associado.id,
        tipo: docSolicitado.tipo_documento || "outro",
        arquivo_url: mediaArmazenada,
        nome_arquivo: mediaFilename || `documento_whatsapp_${Date.now()}`,
        status: "pendente",
      })
      .select()
      .single();

    if (insertError) {
      console.error("[whatsapp-webhook] Erro ao criar documento:", insertError);
      return { vinculado: false };
    }

    // Atualizar documento_solicitado
    await supabase
      .from("documentos_solicitados")
      .update({
        status: "enviado",
        enviado_em: new Date().toISOString(),
        documento_id: novoDoc.id,
      })
      .eq("id", docSolicitado.id);

    const tipoFormatado = formatarTipoDocumento(docSolicitado.tipo_documento);
    console.log(`[whatsapp-webhook] Documento vinculado: ${tipoFormatado} -> ${novoDoc.id}`);

    return {
      vinculado: true,
      mensagem: `✅ Documento "${tipoFormatado}" recebido com sucesso! Aguarde a análise do nosso time.`,
    };
  } catch (err) {
    console.error("[whatsapp-webhook] Erro ao vincular mídia:", err);
    return { vinculado: false };
  }
}

// System prompt adaptado para WhatsApp (mais conciso) - ALINHADO COM APP
const WHATSAPP_SYSTEM_PROMPT = `Você é o Assistente Virtual PRATIC via WhatsApp.

## ACOLHIMENTO (MUITO IMPORTANTE!)
- SEMPRE cumprimente pelo PRIMEIRO NOME do associado (fornecido no contexto)
- Seja ACOLHEDOR e EMPÁTICO, especialmente em situações de sinistro ou emergência
- Exemplo: "Oi, Marcus! Sinto muito pelo que aconteceu. Vou te ajudar..."
- Pergunte "está tudo bem?" quando o associado relatar acidente ou problema
- Demonstre compreensão antes de coletar dados

## Regras do WhatsApp
- Seja CONCISO (mensagens curtas)
- Use formatação do WhatsApp: *negrito* (um asterisco), _itálico_ (underline), ~tachado~ (til)
- NUNCA use formatação Markdown: **duplo asterisco**, ## títulos, [links](url), \`\`\`código\`\`\`
- NÃO use marcadores especiais como [BOTAO_LOCALIZACAO] ou [UPLOAD_*]
- Para localização, peça o endereço digitado OU use a tool reverse_geocode se receber coordenadas

## Capacidades
1. Consultar faturas pendentes e enviar link — quando o associado perguntar sobre boleto, fatura, pagamento em aberto, dívida ou mensalidade, use get_boletos_pendentes. Se não houver faturas em aberto, informe que está em dia. Se houver, mostre resumo com os dados de pagamento (PIX, linha digitável). Se o associado quiser o link da fatura, use enviar_link_fatura com o id e o campo fonte retornados.
2. Histórico de pagamentos
3. Status de sinistros
4. Abrir sinistro (coleta dados para aprovação)
5. Solicitar assistência 24h (guincho, chaveiro, etc.)
6. Informações sobre veículos
7. Converter coordenadas GPS em endereço (reverse_geocode)
8. Enviar localização do veículo via GPS

## REGRAS DE COBERTURA (VERIFICAR SEMPRE ANTES DE CRIAR SOLICITAÇÕES!)

### Veículo com status "Aguardando Instalação":
- ✅ PERMITIDO: Sinistros de roubo/furto (se tiver cobertura_roubo_furto)
- ❌ BLOQUEADO: Assistência 24h, colisão, incêndio, etc.
- RESPONDA: "Seu veículo está aguardando instalação do rastreador. No momento, só posso ajudar com sinistros de roubo ou furto."

### Veículo ativo com cobertura "APENAS ROUBO/FURTO":
- ✅ PERMITIDO: Sinistros de roubo/furto
- ❌ BLOQUEADO: Assistência 24h (guincho, chaveiro, pane, etc.)
- ❌ BLOQUEADO: Sinistros de colisão, incêndio, fenômenos naturais

### Veículo ativo com cobertura "TOTAL" (Proteção 360º):
- ✅ TUDO LIBERADO

## Coleta de Dados para SINISTRO
1. Tipo do sinistro (colisão, roubo, furto, etc.)
2. Data e hora do ocorrido
3. Local (peça endereço ou coordenadas)
4. Descrição detalhada do que aconteceu
5. B.O. foi registrado? (se sim, pedir para enviar foto/PDF)
6. Pedir fotos do veículo/danos (pode enviar direto aqui!)

## BIFURCAÇÃO DE COLISÃO: PERGUNTAR SE O VEÍCULO ANDA (OBRIGATÓRIO!)
Quando o sinistro for de COLISÃO e o veículo tiver Proteção 360º, ANTES de criar o sinistro você DEVE perguntar:

1. *O veículo ainda consegue andar ou precisa de reboque?*
   - Se o associado disser que *CONSEGUE ANDAR* (sim, anda, tá rodando, consigo dirigir):
     - Marque necessita_reboque = false na tool criar_solicitacao_sinistro
     - NÃO ofereça guincho
   - Se o associado disser que *PRECISA DE REBOQUE* (não anda, não liga, não consigo, precisa de guincho):
     - Marque necessita_reboque = true na tool criar_solicitacao_sinistro
     - Pergunte: "Você tem um local seguro para guardar o veículo? Posso enviar o guincho para o seu endereço: *[ENDEREÇO CADASTRADO]*. Ou prefere que leve para uma oficina credenciada?"
     - Se o associado escolher *seu endereço* ou outro endereço próprio:
       - Use destino_reboque_tipo = "associado"
       - Use destino_reboque_endereco = endereço informado (ou cadastrado se confirmou)
     - Se o associado escolher *oficina*:
       - Use destino_reboque_tipo = "oficina"
       - Use destino_reboque_endereco = "Oficina credenciada (a definir pela equipe)"
     - Após definir o destino, crie o chamado de assistência com criar_solicitacao_assistencia usando o local do sinistro como ORIGEM e o destino escolhido como DESTINO

2. *IMPORTANTE*: Essa pergunta deve ser feita ANTES de chamar criar_solicitacao_sinistro, pois os campos necessita_reboque e destino_reboque_* são enviados junto com o sinistro.

## PÓS-SINISTRO: PERGUNTAR SOBRE LINK DO EVENTO (OBRIGATÓRIO!)
Após registrar o sinistro com sucesso e o resultado conter "link_evento":
1. Confirme o registro e o protocolo ao associado
2. Pergunte ao associado:
   "Quer dar entrada no processo do sinistro agora? Vou te enviar um link para você completar as etapas (auto vistoria, B.O., agendamento). Ou prefere que a gente retorne amanhã?"
3. Se o associado disser AGORA / SIM / QUERO:
   - Envie o link: "Aqui está o link: [link_evento]. Válido por 72h."
   - Explique brevemente as etapas: Auto Vistoria, B.O., Agendamento da vistoria presencial, Pagamento da coparticipação
4. Se disser DEPOIS / AMANHÃ / NÃO AGORA:
   - Responda: "Sem problemas! Amanhã de manhã enviaremos o link para você dar continuidade."
   - O cron D+1 cuidará do envio automático
5. Se o resultado NÃO conter "link_evento", pule esta etapa

## PÓS-SINISTRO: ASSISTÊNCIA 24H (para tipos que NÃO são colisão)
Para sinistros que NÃO são colisão (incêndio, fenômenos, etc.) e o veículo tiver cobertura_total:
- Pergunte genericamente se precisa de assistência (guincho, chaveiro, troca de pneu)
- Se sim, colete os dados e crie o chamado
IMPORTANTE: Para COLISÃO, a assistência já foi tratada na bifurcação acima (antes de criar o sinistro).

## Coleta de Dados para ASSISTÊNCIA 24H (OBRIGATÓRIO COLETAR TODOS!)
1. Tipo do serviço (guincho, chaveiro, troca de pneu, pane seca, pane elétrica)
2. Endereço de RETIRADA — endereço completo COM número ou ponto de referência próximo. Pergunte: "Próximo a qual número ou ponto de referência você está?"
3. Endereço de DESTINO — para onde o veículo será levado. Pergunte: "Para onde o veículo deve ser levado? (oficina, residência, outro endereço)"
4. Descrição do problema
5. Tipo de veículo (carro ou moto)
IMPORTANTE: Se for guincho vinculado a sinistro que acabou de ser reportado, o local do sinistro já serve como endereço de origem — mas SEMPRE pergunte o destino.

## EVENTOS NOVOS vs EXISTENTES (MUITO IMPORTANTE!)
- Se o contexto mostra "Nenhum sinistro em aberto" e o associado relata um novo acidente, TRATE COMO NOVO SINISTRO
- NAO assuma que é continuação de um evento anterior já finalizado
- Se houver sinistro em andamento E o associado relatar novo evento, pergunte: "Vi que você já tem um sinistro em andamento (protocolo X). Esse é um novo evento ou é sobre o mesmo?"
- Eventos com status finalizado/encerrado/aprovado/indenizado JÁ FORAM RESOLVIDOS — ignore-os para novas solicitações
- Se o histórico de conversa menciona sinistros anteriores mas o contexto mostra que estão finalizados, IGNORE o histórico antigo

## Regras Gerais (CRÍTICO - LEIA COM ATENÇÃO!)
- Use a DATA ATUAL fornecida para datas relativas
- Confirme TODOS os dados antes de criar solicitações
- NUNCA NUNCA NUNCA invente protocolos, números ou dados. Você NÃO SABE qual protocolo será gerado.
- Protocolos (SIN-XXXX, ASS-XXXX, AST-XXXX) SÓ existem APÓS a tool call retornar com sucesso. NUNCA mencione um protocolo antes de receber o resultado da tool.
- Se precisar criar um sinistro, CHAME a tool criar_solicitacao_sinistro e ESPERE o resultado. O protocolo virá no campo "protocolo" do resultado.
- Se precisar criar assistência, CHAME a tool criar_solicitacao_assistencia e ESPERE o resultado. O protocolo virá no campo "protocolo" do resultado.
- Se uma tool retornar erro, informe o erro ao associado. NÃO invente que deu certo.
- NUNCA invente informações - use APENAS os dados do contexto e os resultados das tools
- Se o associado enviar foto/documento, será vinculado automaticamente

## Formato de Resposta
- Respostas curtas e diretas (máximo 3-4 parágrafos)
- Use emojis com moderação 🚗
- Quebre mensagens longas em partes

## CANCELAMENTO E TROCA DE TITULARIDADE

Quando o associado manifestar interesse em:
- "Quero cancelar", "Quero sair", "Não quero mais"
- "Vendi meu carro", "Quero trocar o titular"

### Cancelamento:
1. Confirme: "Você tem certeza que deseja cancelar sua filiação?"
2. Colete o motivo
3. Informe: "Será necessário agendar a retirada do rastreador do veículo"
4. Crie a solicitação com criar_solicitacao_cancelamento

### Troca de Titularidade:
1. Confirme: "Você vendeu o veículo e deseja transferir para o novo proprietário?"
2. Colete: nome, CPF, email e telefone do novo titular
3. Informe: "Será agendada uma vistoria do veículo e o novo titular receberá um link para envio de documentos"
4. Crie a solicitação com criar_solicitacao_troca_titularidade`;
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

## DATAS DISPONÍVEIS
Use EXATAMENTE as datas fornecidas no contexto (3 opções).

## PERÍODOS
- *MANHÃ*: 08:00 às 12:00
- *TARDE*: 14:00 às 18:00
- Sábados: apenas MANHÃ (08:00-13:00)

## Fluxo
1. Apresente as 3 opções de data
2. Peça para o cliente escolher (1, 2 ou 3)
3. Pergunte o período (manhã ou tarde)
4. Confirme o novo agendamento

## Resposta SEMPRE em JSON
{
  "etapa": "PERGUNTA_DATA" | "PERGUNTA_PERIODO" | "CONFIRMAR" | "FINALIZADO",
  "mensagem": "Mensagem para o cliente",
  "dados_coletados": {
    "data": "YYYY-MM-DD ou null",
    "periodo": "manha" | "tarde" | null,
    "hora": "HH:MM ou null"
  }
}`;

// Função para calcular os próximos 3 dias úteis disponíveis (pula domingo)
function getProximasDatasDisponiveis(quantidade: number = 3): { data: string; diaSemana: string; formatada: string }[] {
  const resultado = [];
  const hoje = new Date();
  let diasAdicionados = 0;
  let offset = 1; // Começa de amanhã

  while (diasAdicionados < quantidade) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() + offset);
    
    const diaSemana = data.getDay();
    
    // Pular domingo (0)
    if (diaSemana !== 0) {
      const dataStr = data.toISOString().split('T')[0];
      const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const diaFormatado = data.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit',
        timeZone: 'America/Sao_Paulo'
      });
      
      resultado.push({
        data: dataStr,
        diaSemana: diasSemana[diaSemana],
        formatada: `${diasSemana[diaSemana]}, ${diaFormatado}`
      });
      diasAdicionados++;
    }
    offset++;
  }
  
  return resultado;
}

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
      description: "Registra sinistro diretamente no sistema com protocolo SIN-XXXX. O sinistro será criado e a equipe será notificada automaticamente. IMPORTANTE: Verificar cobertura do veículo antes de usar. Para COLISÃO, inclua necessita_reboque e destino_reboque_*.",
      parameters: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["colisao", "roubo_furto", "incendio", "fenomenos_naturais", "danos_terceiros", "outros"] },
          data_ocorrencia: { type: "string" },
          local: { type: "string" },
          descricao: { type: "string" },
          necessita_reboque: { type: "boolean", description: "Se o veículo precisa de reboque (obrigatório para colisão). true = precisa de guincho, false = consegue andar" },
          destino_reboque_tipo: { type: "string", enum: ["associado", "oficina"], description: "Tipo do destino do reboque: 'associado' ou 'oficina'" },
          destino_reboque_endereco: { type: "string", description: "Endereço de destino do reboque" },
        },
        required: ["tipo", "data_ocorrencia", "local", "descricao"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_solicitacao_assistencia",
      description: "Cria chamado de assistência 24h diretamente na fila. IMPORTANTE: Só pode ser usado se veículo tiver cobertura_total = true. Coletar TODOS os dados antes: tipo_servico, localizacao (com número/referência), destino e descricao.",
      parameters: {
        type: "object",
        properties: {
          tipo_servico: { type: "string", enum: ["guincho", "chaveiro", "troca_pneu", "pane_seca", "pane_eletrica", "outros"] },
          localizacao: { type: "string", description: "Endereço completo de retirada com número ou ponto de referência" },
          destino: { type: "string", description: "Endereço de destino (oficina, residência, outro endereço)" },
          descricao: { type: "string", description: "Descrição do problema" },
        },
        required: ["tipo_servico", "localizacao", "destino", "descricao"],
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
      name: "enviar_link_fatura",
      description: "Retorna o link da fatura no Asaas para o associado acessar e pagar. Use quando o cliente pedir o link do boleto ou da fatura. Inclua o campo 'fonte' retornado por get_boletos_pendentes.",
      parameters: {
        type: "object",
        properties: {
          boleto_id: { type: "string", description: "ID do boleto a ser enviado (obtido de get_boletos_pendentes)" },
          fonte: { type: "string", enum: ["asaas_cobrancas", "cobrancas"], description: "Tabela de origem do boleto (retornada por get_boletos_pendentes)" },
        },
      required: ["boleto_id"],
    },
  },
},
{
  type: "function",
  function: {
    name: "consultar_localizacao_veiculo",
    description: "Consulta a localização atual do veículo e retorna o endereço em texto (rua, número, bairro, cidade). NÃO envia pin de localização. Use quando o associado perguntar onde está o carro.",
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
{
  type: "function",
  function: {
    name: "criar_solicitacao_cancelamento",
    description: "Cria uma solicitação de cancelamento de filiação. Use APENAS após confirmar que o associado realmente deseja cancelar e coletar o motivo.",
    parameters: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "Motivo do cancelamento" },
        confirmacao: { type: "boolean", description: "Se o associado confirmou o cancelamento" },
      },
      required: ["motivo", "confirmacao"],
    },
  },
},
{
  type: "function",
  function: {
    name: "criar_solicitacao_troca_titularidade",
    description: "Cria uma solicitação de troca de titularidade. Use APENAS após coletar todos os dados do novo titular.",
    parameters: {
      type: "object",
      properties: {
        novo_nome: { type: "string", description: "Nome completo do novo titular" },
        novo_cpf: { type: "string", description: "CPF do novo titular" },
        novo_email: { type: "string", description: "Email do novo titular" },
        novo_telefone: { type: "string", description: "Telefone/WhatsApp do novo titular" },
        motivo: { type: "string", description: "Motivo da troca" },
      },
      required: ["novo_nome", "novo_cpf", "novo_email", "novo_telefone"],
    },
  },
},
];

// Executa tools
async function executeTool(supabase: any, associadoId: string, toolName: string, args: any, telefone?: string, instancia?: any): Promise<string> {
  console.log(`[whatsapp-webhook] Tool: ${toolName}`, args);

  switch (toolName) {
    case "get_boletos_pendentes": {
      // Buscar em asaas_cobrancas (tabela principal do Asaas) E cobrancas (legado)
      const [asaasResult, cobrancasResult] = await Promise.all([
        supabase
          .from("asaas_cobrancas")
          .select("id, valor, data_vencimento, status, boleto_url, pix_copia_cola, linha_digitavel")
          .eq("associado_id", associadoId)
          .in("status", ["PENDING", "OVERDUE", "CONFIRMED"])
          .order("data_vencimento"),
        supabase
          .from("cobrancas")
          .select("id, valor, data_vencimento, status, boleto_url, pix_copia_cola, linha_digitavel")
          .eq("associado_id", associadoId)
          .in("status", ["pendente", "vencido", "em_aberto"])
          .order("data_vencimento"),
      ]);

      const asaasData = asaasResult.data || [];
      const cobrancasData = cobrancasResult.data || [];
      
      // Unificar resultados: asaas_cobrancas tem prioridade
      const todosboletos = [
        ...asaasData.map((b: any) => ({
          id: b.id,
          fonte: "asaas_cobrancas",
          valor: `R$ ${b.valor?.toFixed(2)}`,
          vencimento: new Date(b.data_vencimento).toLocaleDateString("pt-BR"),
          status: b.status === "PENDING" ? "pendente" : b.status === "OVERDUE" ? "vencido" : b.status.toLowerCase(),
          boleto_url: b.boleto_url || null,
          pix: b.pix_copia_cola || null,
          linha_digitavel: b.linha_digitavel || null,
        })),
        ...cobrancasData.map((b: any) => ({
          id: b.id,
          fonte: "cobrancas",
          valor: `R$ ${b.valor?.toFixed(2)}`,
          vencimento: new Date(b.data_vencimento).toLocaleDateString("pt-BR"),
          status: b.status,
          boleto_url: b.boleto_url || null,
          pix: b.pix_copia_cola || null,
          linha_digitavel: b.linha_digitavel || null,
        })),
      ];

      if (!todosboletos.length) {
        return JSON.stringify({ 
          message: "Você está em dia! ✅ Não há faturas em aberto no momento. Parabéns por manter tudo em ordem! 💙" 
        });
      }

      const total = [...asaasData, ...cobrancasData].reduce((s: number, b: any) => s + (b.valor || 0), 0);
      return JSON.stringify({
        boletos: todosboletos,
        total: `R$ ${total.toFixed(2)}`,
        instrucao: "Para receber o boleto em PDF no WhatsApp, use a tool enviar_boleto_pdf com o id do boleto e o campo fonte (asaas_cobrancas ou cobrancas).",
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
          tipo_cobertura: v.cobertura_total ? "Proteção 360º (todos os serviços)" : "Apenas Roubo/Furto",
        })),
      });
    }

    case "criar_solicitacao_sinistro": {
      // Mapeamento de tipos IA -> tipos do sistema
      const tipoMap: Record<string, string> = {
        roubo_furto: "roubo",
        fenomenos_naturais: "fenomeno_natural",
        danos_terceiros: "terceiros",
        colisao: "colisao",
        incendio: "incendio",
        outros: "outro",
      };
      const tipoSistema = tipoMap[args.tipo] || args.tipo;

      // Labels para tipo
      const tipoLabels: Record<string, string> = {
        colisao: "Colisão", roubo: "Roubo", furto: "Furto", incendio: "Incêndio",
        fenomeno_natural: "Fenômeno Natural", terceiros: "Terceiros", vidros: "Vidros",
        vandalismo: "Vandalismo", outro: "Outro",
      };

      // Documentos obrigatórios por tipo
      const docsObrigatorios: Record<string, Array<{tipo: string; nome: string; obrigatorio: boolean}>> = {
        colisao: [
          { tipo: "cnh", nome: "CNH do Condutor", obrigatorio: true },
          { tipo: "crlv", nome: "CRLV do Veículo", obrigatorio: true },
          { tipo: "foto_dano", nome: "Fotos dos Danos", obrigatorio: true },
          { tipo: "foto_local", nome: "Fotos do Local", obrigatorio: false },
          { tipo: "bo", nome: "Boletim de Ocorrência", obrigatorio: false },
        ],
        roubo: [
          { tipo: "cnh", nome: "CNH do Condutor", obrigatorio: true },
          { tipo: "crlv", nome: "CRLV do Veículo", obrigatorio: true },
          { tipo: "bo", nome: "Boletim de Ocorrência", obrigatorio: true },
        ],
        furto: [
          { tipo: "cnh", nome: "CNH do Condutor", obrigatorio: true },
          { tipo: "crlv", nome: "CRLV do Veículo", obrigatorio: true },
          { tipo: "bo", nome: "Boletim de Ocorrência", obrigatorio: true },
          { tipo: "chaves", nome: "Declaração das Chaves", obrigatorio: true },
        ],
        incendio: [
          { tipo: "cnh", nome: "CNH do Condutor", obrigatorio: true },
          { tipo: "crlv", nome: "CRLV do Veículo", obrigatorio: true },
          { tipo: "bo", nome: "Boletim de Ocorrência", obrigatorio: true },
          { tipo: "laudo_bombeiros", nome: "Laudo dos Bombeiros", obrigatorio: true },
          { tipo: "foto_dano", nome: "Fotos do Veículo", obrigatorio: true },
        ],
        fenomeno_natural: [
          { tipo: "cnh", nome: "CNH do Condutor", obrigatorio: true },
          { tipo: "crlv", nome: "CRLV do Veículo", obrigatorio: true },
          { tipo: "foto_dano", nome: "Fotos dos Danos", obrigatorio: true },
          { tipo: "comprovante_evento", nome: "Comprovante do Evento", obrigatorio: false },
        ],
        vandalismo: [
          { tipo: "cnh", nome: "CNH do Condutor", obrigatorio: true },
          { tipo: "crlv", nome: "CRLV do Veículo", obrigatorio: true },
          { tipo: "bo", nome: "Boletim de Ocorrência", obrigatorio: true },
          { tipo: "foto_dano", nome: "Fotos dos Danos", obrigatorio: true },
        ],
        terceiros: [
          { tipo: "cnh", nome: "CNH do Condutor", obrigatorio: true },
          { tipo: "crlv", nome: "CRLV do Veículo", obrigatorio: true },
          { tipo: "foto_dano", nome: "Fotos dos Danos", obrigatorio: true },
          { tipo: "dados_terceiro", nome: "Dados do Terceiro", obrigatorio: true },
        ],
        vidros: [
          { tipo: "cnh", nome: "CNH do Condutor", obrigatorio: true },
          { tipo: "crlv", nome: "CRLV do Veículo", obrigatorio: true },
          { tipo: "foto_dano", nome: "Fotos dos Danos", obrigatorio: true },
        ],
        outro: [
          { tipo: "cnh", nome: "CNH do Condutor", obrigatorio: true },
          { tipo: "crlv", nome: "CRLV do Veículo", obrigatorio: true },
          { tipo: "foto_dano", nome: "Fotos do Ocorrido", obrigatorio: false },
        ],
      };

      // Status considerados como sinistro em aberto
      const statusAbertos = ["comunicado", "em_analise", "documentacao_pendente", "em_regulacao"];

      // 1. Buscar veículo ativo
      const { data: veiculosSin } = await supabase
        .from("veiculos")
        .select("id, placa, marca, modelo, cobertura_total, cobertura_roubo_furto")
        .eq("associado_id", associadoId)
        .eq("status", "ativo")
        .limit(1);

      const veiculoSin = veiculosSin?.[0];
      if (!veiculoSin) {
        return JSON.stringify({ sucesso: false, message: "Nenhum veículo ativo encontrado." });
      }

      // 2. Validar cobertura
      if (!veiculoSin.cobertura_total) {
        const isRouboFurto = ["roubo", "furto"].includes(tipoSistema) || args.tipo === "roubo_furto";
        if (!isRouboFurto) {
          return JSON.stringify({
            sucesso: false,
            bloqueado: true,
            message: "Sua cobertura atual é apenas para roubo/furto. Para sinistros de colisão, incêndio ou outros, é necessário ter Proteção 360º.",
          });
        }
      }

      // 3. Verificar duplicatas
      const { data: sinExistente } = await supabase
        .from("sinistros")
        .select("id, protocolo, status")
        .eq("veiculo_id", veiculoSin.id)
        .in("status", statusAbertos)
        .limit(1)
        .maybeSingle();

      if (sinExistente) {
        return JSON.stringify({
          sucesso: false,
          message: `Já existe um sinistro em aberto para este veículo (protocolo ${sinExistente.protocolo}). Aguarde a conclusão antes de abrir outro.`,
        });
      }

      // 4. Gerar protocolo
      const nowSin = new Date();
      const yearSin = nowSin.getFullYear();
      const monthSin = String(nowSin.getMonth() + 1).padStart(2, "0");
      const daySin = String(nowSin.getDate()).padStart(2, "0");
      const randomSin = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
      const protocoloSin = `SIN-${yearSin}${monthSin}${daySin}-${randomSin}`;

      // 5. Buscar posição do rastreador do veículo neste momento
      const { data: rastreadorSin } = await supabase
        .from("rastreadores")
        .select("ultima_posicao_lat, ultima_posicao_lng, ultima_comunicacao")
        .eq("veiculo_id", veiculoSin.id)
        .eq("status", "instalado")
        .maybeSingle();

      // 6. INSERT sinistro (com campos de bifurcação para colisão)
      const insertDataWa: Record<string, any> = {
        associado_id: associadoId,
        veiculo_id: veiculoSin.id,
        protocolo: protocoloSin,
        tipo: tipoSistema,
        data_ocorrencia: args.data_ocorrencia || null,
        local_ocorrencia: args.local || "",
        descricao: args.descricao,
        status: "comunicado",
        canal: "whatsapp",
        rastreador_lat_momento: rastreadorSin?.ultima_posicao_lat || null,
        rastreador_lng_momento: rastreadorSin?.ultima_posicao_lng || null,
        rastreador_posicao_capturada_em: rastreadorSin?.ultima_comunicacao || null,
      };

      // Campos de bifurcação (colisão)
      if (tipoSistema === "colisao" && args.necessita_reboque !== undefined) {
        insertDataWa.necessita_reboque = args.necessita_reboque;
        if (args.destino_reboque_tipo) {
          insertDataWa.destino_reboque_tipo = args.destino_reboque_tipo;
        }
        if (args.destino_reboque_endereco) {
          insertDataWa.destino_reboque_endereco = args.destino_reboque_endereco;
        }
      }

      const { data: sinistroNovo, error: sinError } = await supabase
        .from("sinistros")
        .insert(insertDataWa)
        .select("id")
        .single();

      if (sinError) {
        console.error("[whatsapp-webhook] Erro ao criar sinistro:", sinError);
        throw sinError;
      }

      console.log(`[whatsapp-webhook] Sinistro criado: ${protocoloSin} (${sinistroNovo.id})`);

      // 6. Histórico
      await supabase.from("sinistro_historico").insert({
        sinistro_id: sinistroNovo.id,
        status_novo: "comunicado",
        observacao: `Sinistro comunicado via WhatsApp - ${tipoLabels[tipoSistema] || tipoSistema}`,
      });

      // 7. Documentos obrigatórios
      const docsList = docsObrigatorios[tipoSistema] || docsObrigatorios.outro;
      const docsToInsert = docsList.map((d) => ({
        sinistro_id: sinistroNovo.id,
        tipo: d.tipo,
        nome: d.nome,
        obrigatorio: d.obrigatorio,
        status: "pendente",
      }));
      await supabase.from("sinistro_documentos").upsert(docsToInsert, { onConflict: "sinistro_id,tipo", ignoreDuplicates: true });

      // 8. Notificações internas (analistas/diretores)
      try {
        const { data: analistas } = await supabase.from("user_roles").select("user_id").eq("role", "analista_sinistros");
        let destinatarios = analistas || [];
        if (destinatarios.length === 0) {
          const { data: diretores } = await supabase.from("user_roles").select("user_id").eq("role", "diretor");
          destinatarios = diretores || [];
        }
        for (const dest of destinatarios) {
          await supabase.from("notificacoes").insert({
            user_id: dest.user_id,
            titulo: "🆕 Novo Sinistro via WhatsApp",
            mensagem: `Sinistro ${protocoloSin} - ${tipoLabels[tipoSistema] || tipoSistema} - Veículo ${veiculoSin.placa}`,
            tipo: "alerta",
            categoria: "sinistros",
            referencia_tipo: "sinistro",
            referencia_id: sinistroNovo.id,
            link: `/sinistros/${sinistroNovo.id}`,
            lida: false,
          });
        }
        // Email
        await supabase.functions.invoke("send-email", {
          body: {
            to: "sinistros@praticprotect.com.br",
            subject: `Novo Sinistro via WhatsApp: ${protocoloSin} - ${veiculoSin.placa}`,
            html: `<h2>Novo Sinistro Registrado via WhatsApp</h2>
              <p><strong>Protocolo:</strong> ${protocoloSin}</p>
              <p><strong>Tipo:</strong> ${tipoLabels[tipoSistema] || tipoSistema}</p>
              <p><strong>Veículo:</strong> ${veiculoSin.placa} - ${veiculoSin.marca} ${veiculoSin.modelo}</p>
              <p><strong>Local:</strong> ${args.local || "Não informado"}</p>
              <p><strong>Descrição:</strong> ${args.descricao}</p>`,
          },
        });
      } catch (notifErr) {
        console.error("[whatsapp-webhook] Erro notificações (não bloqueante):", notifErr);
      }

      // 9. Notificar sinistro
      try {
        await supabase.functions.invoke("notificar-sinistro", {
          body: { sinistro_id: sinistroNovo.id, status: "comunicado" },
        });
      } catch (e) {
        console.log("[whatsapp-webhook] notificar-sinistro não enviado:", e);
      }

      // 10. Agendar contato D+1 e capturar token do link
      let linkToken = "";
      try {
        const agendarResp = await supabase.functions.invoke("agendar-contato-sinistro", {
          body: { sinistro_id: sinistroNovo.id },
        });
        linkToken = agendarResp?.data?.token || "";
        console.log(`[whatsapp-webhook] Link token capturado: ${linkToken}`);
      } catch (e) {
        console.error("[whatsapp-webhook] Erro agendar contato (não bloqueante):", e);
      }

      // 11. Geocodificar local informado (com cidade/UF do associado para maior precisão)
      if (args.local) {
        try {
          const cidadeUf = [associado?.cidade, associado?.uf].filter(Boolean).join(', ');
          const searchQuery = cidadeUf ? `${args.local}, ${cidadeUf}, Brasil` : `${args.local}, Brasil`;
          console.log(`[whatsapp-webhook] Geocodificando local informado: "${searchQuery}"`);
          const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`;
          const geoRes = await fetch(geoUrl, { headers: { 'User-Agent': 'PraticConnect/1.0' } });
          const geoData = await geoRes.json();
          if (geoData.length > 0) {
            await supabase.from('sinistros').update({
              latitude_informada: parseFloat(geoData[0].lat),
              longitude_informada: parseFloat(geoData[0].lon),
            }).eq('id', sinistroNovo.id);
            console.log(`[whatsapp-webhook] Geocodificado: ${args.local} -> ${geoData[0].lat}, ${geoData[0].lon}`);
          }
        } catch (geoErr) {
          console.error('[whatsapp-webhook] Erro geocodificação (não bloqueante):', geoErr);
        }
      }

      const siteUrl = Deno.env.get("SITE_URL") || "https://pratic-connect-21.lovable.app";
      const linkEvento = linkToken ? `${siteUrl}/evento/${linkToken}` : "";

      return JSON.stringify({
        sucesso: true,
        protocolo: protocoloSin,
        link_evento: linkEvento,
        message: `Sinistro registrado com sucesso! Protocolo: *${protocoloSin}*. Nossa equipe já foi notificada e iniciará a análise em breve.`,
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
          message: "Sua cobertura atual é apenas para roubo/furto. A assistência 24h (guincho, chaveiro, etc.) está disponível apenas para veículos com Proteção 360º. Após a instalação do rastreador, você terá acesso à Proteção 360º. Entre em contato com a associação para mais informações.",
        });
      }

      // Verificar se já tem chamado em aberto
      const { data: chamadoExistente } = await supabase
        .from("chamados_assistencia")
        .select("id, protocolo, status")
        .eq("associado_id", associadoId)
        .in("status", ['aberto', 'aguardando_prestador', 'prestador_despachado', 'prestador_a_caminho', 'em_atendimento'])
        .maybeSingle();

      if (chamadoExistente) {
        return JSON.stringify({
          sucesso: false,
          message: `Você já tem um chamado em aberto (${chamadoExistente.protocolo}). Aguarde a conclusão antes de abrir outro.`,
        });
      }

      // Gerar protocolo
      const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
      const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
      const protocolo = `ASS-${dateStr}-${random}`;

      // Inserir diretamente na fila de chamados_assistencia
      const { data: chamado, error } = await supabase
        .from("chamados_assistencia")
        .insert({
          protocolo,
          associado_id: associadoId,
          veiculo_id: veiculo.id,
          tipo_servico: args.tipo_servico,
          descricao: args.descricao,
          origem_endereco: args.localizacao,
          destino_endereco: args.destino,
          canal: 'whatsapp',
          status: 'aberto',
          data_abertura: new Date().toISOString(),
        })
        .select("id, protocolo")
        .single();

      if (error) {
        console.error("[whatsapp-webhook] Erro ao criar chamado assistência:", error);
        throw error;
      }

      // Inserir histórico
      await supabase.from("chamados_assistencia_historico").insert({
        chamado_id: chamado.id,
        status_novo: 'aberto',
        observacao: `Chamado aberto via WhatsApp - ${args.tipo_servico}`,
      });

      return JSON.stringify({
        sucesso: true,
        protocolo: chamado.protocolo,
        message: `Chamado de assistência aberto com sucesso! Protocolo: *${chamado.protocolo}*. Nossa equipe já está sendo acionada.`,
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
      const { boleto_id, fonte } = args;
      
      if (!boleto_id) {
        return JSON.stringify({ success: false, message: "ID do boleto não informado" });
      }

      // Buscar boleto na tabela correta (asaas_cobrancas ou cobrancas)
      const tabela = fonte === "asaas_cobrancas" ? "asaas_cobrancas" : "cobrancas";
      const { data: boleto, error: boletoError } = await supabase
        .from(tabela)
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

        const toolApiUrl = Deno.env.get('EVOLUTION_API_URL') || instancia.api_url;
        const response = await fetch(
          `${toolApiUrl}/message/sendMedia/${instancia.instance_name}`,
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

        const toolApiUrl = Deno.env.get('EVOLUTION_API_URL') || instancia.api_url;
        const response = await fetch(
          `${toolApiUrl}/message/sendLocation/${instancia.instance_name}`,
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

      const telefoneCentral = config?.valor || "08009800001";
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

        const toolApiUrl = Deno.env.get('EVOLUTION_API_URL') || instancia.api_url;
        const response = await fetch(
          `${toolApiUrl}/message/sendContact/${instancia.instance_name}`,
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

        const toolApiUrl = Deno.env.get('EVOLUTION_API_URL') || instancia.api_url;
        const response = await fetch(
          `${toolApiUrl}/message/sendContact/${instancia.instance_name}`,
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

    case "criar_solicitacao_cancelamento": {
      if (!args.confirmacao) {
        return JSON.stringify({ sucesso: false, message: "O associado precisa confirmar que deseja cancelar." });
      }

      const { data: veiculos } = await supabase
        .from("veiculos")
        .select("id")
        .eq("associado_id", associadoId)
        .eq("status", "ativo")
        .limit(1);

      const { data, error } = await supabase.from("chat_solicitacoes_ia").insert({
        associado_id: associadoId,
        tipo: "cancelamento",
        dados: {
          veiculo_id: veiculos?.[0]?.id,
          motivo: args.motivo,
          confirmacao: true,
          origem: "whatsapp",
        },
        status: "pendente",
      }).select("id").single();

      if (error) throw error;

      return JSON.stringify({
        sucesso: true,
        message: "Solicitação de cancelamento registrada! A diretoria irá analisar. Será necessário agendar a retirada do rastreador.",
      });
    }

    case "criar_solicitacao_troca_titularidade": {
      const { data: veiculos } = await supabase
        .from("veiculos")
        .select("id")
        .eq("associado_id", associadoId)
        .eq("status", "ativo")
        .limit(1);

      const { data, error } = await supabase.from("chat_solicitacoes_ia").insert({
        associado_id: associadoId,
        tipo: "troca_titularidade",
        dados: {
          veiculo_id: veiculos?.[0]?.id,
          motivo: args.motivo || "venda_veiculo",
          origem: "whatsapp",
        },
        dados_novo_titular: {
          nome: args.novo_nome,
          cpf: args.novo_cpf,
          email: args.novo_email,
          telefone: args.novo_telefone,
        },
        status: "pendente",
      }).select("id").single();

      if (error) throw error;

      return JSON.stringify({
        sucesso: true,
        message: "Solicitação de troca de titularidade registrada! A diretoria irá analisar. Será agendada uma vistoria do veículo.",
      });
    }

    default:
      return JSON.stringify({ error: "Tool não reconhecida" });
  }
}

// Buscar contexto do associado - ENRIQUECIDO com dados completos
async function getAssociadoContext(supabase: any, associadoId: string) {
  // Buscar dados completos do associado
  const { data: associado } = await supabase
    .from("associados")
    .select("nome, email, telefone, whatsapp, cpf, status, logradouro, numero, bairro, cidade, uf, cep, plano:planos(nome)")
    .eq("id", associadoId)
    .single();

  // Buscar TODOS os veículos (incluindo pendentes de instalação)
  const { data: veiculos } = await supabase
    .from("veiculos")
    .select("id, placa, marca, modelo, ano_modelo, status, cobertura_roubo_furto, cobertura_total")
    .eq("associado_id", associadoId);

  // Buscar boletos pendentes
  const { data: boletos } = await supabase
    .from("cobrancas")
    .select("id, valor, data_vencimento, status, pix_copia_cola")
    .eq("associado_id", associadoId)
    .in("status", ["pendente", "vencido", "em_aberto"])
    .order("data_vencimento", { ascending: true })
    .limit(3);

  // Buscar sinistros REALMENTE em andamento (status ativos apenas)
  const { data: sinistros } = await supabase
    .from("sinistros")
    .select("protocolo, tipo, status")
    .eq("associado_id", associadoId)
    .in("status", ["comunicado", "em_analise", "documentacao_pendente", "em_regulacao", "aguardando_analise"])
    .limit(3);

  // Buscar sinistros recentes finalizados (para referência, últimos 30 dias)
  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: sinistrosFinalizados } = await supabase
    .from("sinistros")
    .select("protocolo, tipo, status")
    .eq("associado_id", associadoId)
    .not("status", "in", "(comunicado,em_analise,documentacao_pendente,em_regulacao,aguardando_analise)")
    .gte("updated_at", trintaDiasAtras)
    .order("updated_at", { ascending: false })
    .limit(3);

  // Buscar assistências em andamento
  const { data: assistencias } = await supabase
    .from("chamados_assistencia")
    .select("protocolo, tipo_servico, status")
    .eq("associado_id", associadoId)
    .not("status", "in", "(concluido,cancelado)")
    .limit(3);

  // Formatar veículos com informação clara de status e cobertura
  const veiculosFormatados = veiculos?.length > 0
    ? veiculos.map((v: any) => {
        const cobertura = v.cobertura_total 
          ? "PROTEÇÃO 360º (tudo liberado)" 
          : v.cobertura_roubo_furto 
            ? "APENAS ROUBO/FURTO" 
            : "SEM COBERTURA";
        const statusInfo = v.status === 'ativo' 
          ? '✅ Ativo' 
          : v.status === 'instalacao_pendente'
            ? '⏳ Aguardando Instalação'
            : `⚠️ ${v.status}`;
        return `- ${v.placa} (${v.marca} ${v.modelo} ${v.ano_modelo || ''}) - Status: ${statusInfo}, Cobertura: ${cobertura}, ID: ${v.id}`;
      }).join('\n')
    : 'Nenhum veículo cadastrado';

  // Formatar boletos
  const boletosFormatados = boletos?.length > 0
    ? boletos.map((b: any) => 
        `- R$ ${(b.valor || 0).toFixed(2)} vence ${new Date(b.data_vencimento).toLocaleDateString('pt-BR')} (${b.status})${b.pix_copia_cola ? ' - PIX disponível' : ''}`
      ).join('\n')
    : 'Nenhum boleto pendente ✅';

  // Formatar sinistros em andamento
  const sinistrosFormatados = sinistros?.length > 0
    ? sinistros.map((s: any) => `- ${s.protocolo}: ${s.tipo} (${s.status})`).join('\n')
    : 'Nenhum sinistro em aberto';

  // Formatar sinistros finalizados recentes
  const sinistrosFinalizadosFormatados = sinistrosFinalizados?.length > 0
    ? sinistrosFinalizados.map((s: any) => `- ${s.protocolo}: ${s.tipo} (${s.status}) — JÁ FINALIZADO`).join('\n')
    : 'Nenhum sinistro finalizado recentemente';

  // Formatar assistências
  const assistenciasFormatadas = assistencias?.length > 0
    ? assistencias.map((a: any) => `- ${a.protocolo}: ${a.tipo_servico} (${a.status})`).join('\n')
    : 'Nenhuma assistência em aberto';

  // Data atual em Brasília
  const agora = new Date();
  const dataHoraBrasilia = agora.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const primeiroNome = associado?.nome?.split(' ')[0] || 'Associado';

  return `
## DATA E HORA ATUAL
- **Hoje é**: ${dataHoraBrasilia} (horário de Brasília)
- Use esta data para "hoje", "agora", "ontem"

## DADOS DO ASSOCIADO
- **Nome Completo**: ${associado?.nome || 'N/A'}
- **Primeiro Nome (use para cumprimentar)**: ${primeiroNome}
- **CPF**: ${associado?.cpf || 'N/I'}
- **Status**: ${associado?.status || 'N/A'}
- **Plano**: ${associado?.plano?.nome || 'Não definido'}
- **Endereço Cadastrado**: ${[associado?.logradouro, associado?.numero, associado?.bairro, associado?.cidade, associado?.uf].filter(Boolean).join(', ') || 'Não informado'}

## VEÍCULOS DO ASSOCIADO
${veiculosFormatados}

## BOLETOS PENDENTES
${boletosFormatados}

## SINISTROS EM ANDAMENTO
${sinistrosFormatados}

## SINISTROS FINALIZADOS RECENTEMENTE (apenas referência — NÃO são em andamento!)
${sinistrosFinalizadosFormatados}

## ASSISTÊNCIAS EM ANDAMENTO
${assistenciasFormatadas}

## INSTRUÇÕES IMPORTANTES
- SEMPRE cumprimente usando o primeiro nome: "${primeiroNome}"
- Se o veículo está "Aguardando Instalação", só pode criar sinistro de roubo/furto
- Se cobertura é "APENAS ROUBO/FURTO", NÃO criar assistência 24h
- Use SEMPRE os dados acima. NÃO invente informações!
`;
}

// Buscar histórico de conversa
async function getConversationHistory(supabase: any, associadoId: string, telefone: string) {
  // Limitar histórico às últimas 2 horas para evitar contexto de conversas antigas
  const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("chat_mensagens_ia")
    .select("role, content")
    .eq("associado_id", associadoId)
    .gte("created_at", duasHorasAtras)
    .order("created_at", { ascending: false })
    .limit(10);

  return (data || []).reverse();
}

// Chamar a IA - ATUALIZADO para usar Gemini 3 Flash via ai.gateway.lovable.dev
async function callAI(messages: any[], systemPrompt: string, useTools: boolean = true) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

  const body: any = {
    model: "google/gemini-3-flash-preview", // Modelo mais rápido para evitar timeout
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

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000), // 25 segundos máximo por chamada
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
  // Fallback: se sem URL da Evolution (ex: delegação Meta), usar proxy que auto-roteia
  if (!apiUrl || !instanceName) {
    return sendWhatsAppViaProxy(telefone, texto);
  }
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

// Enviar mensagem via proxy (whatsapp-send-text) — usado para delegação Meta
async function sendWhatsAppViaProxy(telefone: string, texto: string): Promise<{ ok: boolean; messageId?: string }> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ telefone, mensagem: texto, allow_text: true }),
    });
    const result = await res.json();
    return { ok: result.success, messageId: result.message_id };
  } catch (e) {
    console.error("[whatsapp-webhook] Erro no proxy meta:", e);
    return { ok: false };
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

// Salvar log de mensagem WhatsApp - ATUALIZADO para suportar mídia
async function saveWhatsAppLog(
  supabase: any, 
  instanciaId: string, 
  telefone: string, 
  mensagem: string, 
  direcao: string, 
  messageId?: string,
  tipo?: string,
  mediaUrl?: string,
  mediaMimetype?: string,
  mediaFilename?: string,
  referenciaId?: string,
  referenciaTipo?: string,
  nomeContato?: string
) {
  await supabase.from("whatsapp_mensagens").insert({
    instancia_id: instanciaId,
    telefone,
    nome_contato: nomeContato || null,
    tipo: tipo || "text",
    mensagem,
    media_url: mediaUrl || null,
    media_mimetype: mediaMimetype || null,
    media_filename: mediaFilename || null,
    direcao,
    status: direcao === "saida" ? "enviada" : "entregue",
    message_id: messageId || null,
    sent_at: direcao === "saida" ? new Date().toISOString() : null,
    referencia_tipo: referenciaTipo || null,
    referencia_id: referenciaId || null,
  });
}

// ============================================
// HELPERS PARA DOWNLOAD E ARMAZENAMENTO DE MÍDIA
// ============================================

// Baixar mídia da Evolution API
async function downloadMediaEvolution(
  apiUrl: string, 
  instanceName: string, 
  messageId: string
): Promise<{ success: boolean; base64?: string; mimetype?: string }> {
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
  
  try {
    console.log(`[whatsapp-webhook] Baixando mídia: ${messageId}`);
    
    const response = await fetch(
      `${apiUrl}/chat/getBase64FromMediaMessage/${instanceName}`,
      {
        method: "POST",
        headers: {
          "apikey": EVOLUTION_API_KEY || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: { key: { id: messageId } },
          convertToMp4: false,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[whatsapp-webhook] Erro ao baixar mídia:", errText);
      return { success: false };
    }

    const result = await response.json();
    console.log(`[whatsapp-webhook] Mídia baixada: ${result.mimetype}, tamanho base64: ${result.base64?.length || 0}`);
    
    return {
      success: true,
      base64: result.base64,
      mimetype: result.mimetype,
    };
  } catch (err) {
    console.error("[whatsapp-webhook] Erro download mídia:", err);
    return { success: false };
  }
}

// Armazenar mídia no Supabase Storage
async function storeMediaSupabase(
  supabase: any,
  base64: string,
  mimetype: string,
  telefone: string
): Promise<string | null> {
  try {
    // Converter base64 para Uint8Array
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Determinar extensão
    const ext = mimetype.split('/')[1]?.split(';')[0] || 'bin';
    const fileName = `whatsapp/${telefone}/${Date.now()}.${ext}`;

    console.log(`[whatsapp-webhook] Armazenando mídia: ${fileName}`);

    // Upload para bucket
    const { error } = await supabase.storage
      .from('sinistros')
      .upload(fileName, bytes, {
        contentType: mimetype,
        upsert: false,
      });

    if (error) {
      console.error("[whatsapp-webhook] Erro upload storage:", error);
      return null;
    }

    // Gerar URL pública
    const { data: urlData } = supabase.storage
      .from('sinistros')
      .getPublicUrl(fileName);

    console.log(`[whatsapp-webhook] Mídia armazenada: ${urlData?.publicUrl}`);
    return urlData?.publicUrl || null;
  } catch (err) {
    console.error("[whatsapp-webhook] Erro ao armazenar mídia:", err);
    return null;
  }
}

// Transcrever áudio via Whisper
async function transcreverAudio(base64: string, mimetype: string): Promise<string | null> {
  try {
    // Converter base64 para Blob
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    
    const audioBlob = new Blob([bytes], { type: mimetype || 'audio/ogg' });
    
    // Criar FormData
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.ogg');
    
    console.log(`[whatsapp-webhook] Enviando áudio para transcrição...`);
    
    const transcricaoResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/transcrever-audio`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: formData,
      }
    );
    
    if (transcricaoResponse.ok) {
      const transcricao = await transcricaoResponse.json();
      console.log(`[whatsapp-webhook] Áudio transcrito: "${transcricao.text?.substring(0, 50)}..."`);
      return transcricao.text || null;
    } else {
      const errText = await transcricaoResponse.text();
      console.error(`[whatsapp-webhook] Erro na transcrição: ${errText}`);
      return null;
    }
  } catch (err) {
    console.error("[whatsapp-webhook] Erro ao transcrever áudio:", err);
    return null;
  }
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

  // Se quer reagendar, iniciar fluxo completo de reagendamento via WhatsApp
  if (resultado.intencao === 'REAGENDAR') {
    // Atualizar confirmação para status "reagendando" e inicializar contexto
    await supabase.from('confirmacoes_agendamento')
      .update({ 
        status: 'reagendando',
        resposta_recebida_em: new Date().toISOString(),
        resposta_cliente: mensagemCliente,
        contexto_ia: {
          ...contexto,
          etapa_reagendamento: 'INICIAL'
        }
      })
      .eq('id', confirmacao.id);
    
    // Chamar fluxo de reagendamento
    return await processarReagendamento(supabase, confirmacao, mensagemCliente, instancia);
  }

  // Enviar resposta ao cliente (CONFIRMADO, CANCELAR ou DUVIDA)
  const confirmApiUrl = Deno.env.get('EVOLUTION_API_URL') || instancia.api_url;
  await sendWhatsAppMessage(confirmApiUrl, instancia.instance_name, confirmacao.telefone, resultado.mensagem_resposta);
  await saveWhatsAppLog(supabase, instancia.id, confirmacao.telefone, resultado.mensagem_resposta, "saida");

  console.log(`[whatsapp-webhook] Confirmação processada: ${resultado.intencao}`);

  return new Response(JSON.stringify({ ok: true, intencao: resultado.intencao }), { headers: corsHeaders });
}

// Processar fluxo de reagendamento completo via WhatsApp
async function processarReagendamento(
  supabase: any,
  confirmacao: any,
  mensagemCliente: string,
  instancia: any
): Promise<Response> {
  console.log(`[whatsapp-webhook] Processando reagendamento para ${confirmacao.servico_id}`);
  
  const apiUrl = Deno.env.get('EVOLUTION_API_URL') || instancia.api_url;
  
  // Buscar dados do serviço original
  const { data: servicoOriginal } = await supabase
    .from('servicos')
    .select(`
      id, tipo, data_agendada, hora_agendada, periodo,
      cep, logradouro, numero, complemento, bairro, cidade, uf,
      latitude, longitude, associado_id, veiculo_id, contrato_id,
      cotacao_id, local_vistoria, origem,
      associado:associados!servicos_associado_id_fkey(nome)
    `)
    .eq('id', confirmacao.servico_id)
    .single();

  if (!servicoOriginal) {
    const { data: cfgTel } = await supabase.from("configuracoes").select("valor").eq("chave", "assistencia_telefone_central").maybeSingle();
    const tel0800 = cfgTel?.valor || "0800 980 0001";
    const msg = `Desculpe, não encontrei os dados do seu agendamento. Por favor, entre em contato com nossa central ${tel0800}.`;
    await sendWhatsAppMessage(apiUrl, instancia.instance_name, confirmacao.telefone, msg);
    return new Response(JSON.stringify({ ok: false, error: 'servico_nao_encontrado' }), { headers: corsHeaders });
  }

  const nomeCliente = servicoOriginal.associado?.nome?.split(' ')[0] || 'Cliente';
  
  // Verificar contexto atual do reagendamento
  const contextoAtual = confirmacao.contexto_ia || {};
  const etapaAtual = contextoAtual.etapa_reagendamento || 'INICIAL';
  const datasDisponiveis = contextoAtual.datas_disponiveis || getProximasDatasDisponiveis(3);
  
  // ETAPA INICIAL: Mostrar datas disponíveis
  if (etapaAtual === 'INICIAL') {
    const mensagemDatas = `Sem problemas, *${nomeCliente}*! 📅

Escolha uma das datas disponíveis:

*1️⃣* ${datasDisponiveis[0].formatada}
*2️⃣* ${datasDisponiveis[1].formatada}
*3️⃣* ${datasDisponiveis[2].formatada}

Responda com *1*, *2* ou *3* para escolher.`;

    await sendWhatsAppMessage(apiUrl, instancia.instance_name, confirmacao.telefone, mensagemDatas);
    await saveWhatsAppLog(supabase, instancia.id, confirmacao.telefone, mensagemDatas, "saida");
    
    // Atualizar contexto com etapa e datas
    await supabase.from('confirmacoes_agendamento')
      .update({ 
        status: 'reagendando',
        contexto_ia: {
          ...contextoAtual,
          etapa_reagendamento: 'AGUARDANDO_DATA',
          datas_disponiveis: datasDisponiveis,
          servico_original: servicoOriginal
        }
      })
      .eq('id', confirmacao.id);
    
    return new Response(JSON.stringify({ ok: true, etapa: 'AGUARDANDO_DATA' }), { headers: corsHeaders });
  }
  
  // ETAPA AGUARDANDO_DATA: Cliente escolheu data
  if (etapaAtual === 'AGUARDANDO_DATA') {
    const escolha = mensagemCliente.trim();
    let dataSelecionada = null;
    
    // Interpretar resposta (1, 2, 3 ou texto)
    if (['1', '01', 'um', 'primeira', 'primeiro'].some(v => escolha.toLowerCase().includes(v))) {
      dataSelecionada = datasDisponiveis[0];
    } else if (['2', '02', 'dois', 'segunda', 'segundo'].some(v => escolha.toLowerCase().includes(v))) {
      dataSelecionada = datasDisponiveis[1];
    } else if (['3', '03', 'três', 'tres', 'terceira', 'terceiro'].some(v => escolha.toLowerCase().includes(v))) {
      dataSelecionada = datasDisponiveis[2];
    }
    
    if (!dataSelecionada) {
      const msg = `Não entendi sua escolha. Por favor, responda *1*, *2* ou *3*:

*1️⃣* ${datasDisponiveis[0].formatada}
*2️⃣* ${datasDisponiveis[1].formatada}
*3️⃣* ${datasDisponiveis[2].formatada}`;
      
      await sendWhatsAppMessage(apiUrl, instancia.instance_name, confirmacao.telefone, msg);
      await saveWhatsAppLog(supabase, instancia.id, confirmacao.telefone, msg, "saida");
      return new Response(JSON.stringify({ ok: true, etapa: 'AGUARDANDO_DATA', retry: true }), { headers: corsHeaders });
    }
    
    // Verificar se é sábado (horário reduzido)
    const dataObj = new Date(dataSelecionada.data + 'T12:00:00');
    const isSabado = dataObj.getDay() === 6;
    
    const mensagemPeriodo = isSabado
      ? `Ótimo! *${dataSelecionada.formatada}* selecionada.

⚠️ Aos sábados atendemos apenas pela *MANHÃ* (08:00 às 13:00).

Confirma o período da *MANHÃ*? Responda *SIM* ou digite outro dia.`
      : `Ótimo! *${dataSelecionada.formatada}* selecionada.

Qual período você prefere?

*1️⃣ MANHÃ* (08:00 às 12:00)
*2️⃣ TARDE* (14:00 às 18:00)

Responda *1* ou *2*.`;

    await sendWhatsAppMessage(apiUrl, instancia.instance_name, confirmacao.telefone, mensagemPeriodo);
    await saveWhatsAppLog(supabase, instancia.id, confirmacao.telefone, mensagemPeriodo, "saida");
    
    await supabase.from('confirmacoes_agendamento')
      .update({ 
        contexto_ia: {
          ...contextoAtual,
          etapa_reagendamento: isSabado ? 'AGUARDANDO_CONFIRMACAO_SABADO' : 'AGUARDANDO_PERIODO',
          data_selecionada: dataSelecionada,
          is_sabado: isSabado
        }
      })
      .eq('id', confirmacao.id);
    
    return new Response(JSON.stringify({ ok: true, etapa: 'AGUARDANDO_PERIODO' }), { headers: corsHeaders });
  }
  
  // ETAPA AGUARDANDO_PERIODO ou CONFIRMACAO_SABADO
  if (etapaAtual === 'AGUARDANDO_PERIODO' || etapaAtual === 'AGUARDANDO_CONFIRMACAO_SABADO') {
    const dataSelecionada = contextoAtual.data_selecionada;
    const isSabado = contextoAtual.is_sabado;
    const escolha = mensagemCliente.trim().toLowerCase();
    
    let periodo: string | null = null;
    let hora: string | null = null;
    
    if (isSabado) {
      // Sábado: só manhã
      if (['sim', 's', 'ok', 'confirmo', 'pode', 'manhã', 'manha', '1'].some(v => escolha.includes(v))) {
        periodo = 'manha';
        hora = '09:00';
      } else {
        // Cliente quer outro dia - voltar para seleção
        const msg = `Entendi! Vamos escolher outro dia então.

*1️⃣* ${datasDisponiveis[0].formatada}
*2️⃣* ${datasDisponiveis[1].formatada}
*3️⃣* ${datasDisponiveis[2].formatada}

Responda *1*, *2* ou *3*.`;
        
        await sendWhatsAppMessage(apiUrl, instancia.instance_name, confirmacao.telefone, msg);
        await saveWhatsAppLog(supabase, instancia.id, confirmacao.telefone, msg, "saida");
        
        await supabase.from('confirmacoes_agendamento')
          .update({ 
            contexto_ia: { ...contextoAtual, etapa_reagendamento: 'AGUARDANDO_DATA' }
          })
          .eq('id', confirmacao.id);
        
        return new Response(JSON.stringify({ ok: true, etapa: 'AGUARDANDO_DATA' }), { headers: corsHeaders });
      }
    } else {
      // Dias úteis: manhã ou tarde
      if (['1', 'um', 'manhã', 'manha', 'primeira'].some(v => escolha.includes(v))) {
        periodo = 'manha';
        hora = '09:00';
      } else if (['2', 'dois', 'tarde', 'segunda'].some(v => escolha.includes(v))) {
        periodo = 'tarde';
        hora = '15:00';
      }
    }
    
    if (!periodo) {
      const msg = `Não entendi. Por favor, responda *1* para MANHÃ ou *2* para TARDE.`;
      await sendWhatsAppMessage(apiUrl, instancia.instance_name, confirmacao.telefone, msg);
      await saveWhatsAppLog(supabase, instancia.id, confirmacao.telefone, msg, "saida");
      return new Response(JSON.stringify({ ok: true, etapa: 'AGUARDANDO_PERIODO', retry: true }), { headers: corsHeaders });
    }
    
    // CRIAR NOVO SERVIÇO
    const servicoOriginalDados = contextoAtual.servico_original || servicoOriginal;
    const tipoServico = servicoOriginalDados.tipo === 'instalacao' 
      ? 'instalação do rastreador' 
      : servicoOriginalDados.tipo === 'vistoria' 
        ? 'vistoria veicular' 
        : 'serviço';
    
    const { data: novoServico, error: erroNovoServico } = await supabase
      .from('servicos')
      .insert({
        tipo: servicoOriginalDados.tipo,
        status: 'agendada',
        data_agendada: dataSelecionada.data,
        hora_agendada: hora,
        periodo: periodo,
        permite_encaixe: true,
        local_vistoria: servicoOriginalDados.local_vistoria,
        cep: servicoOriginalDados.cep,
        logradouro: servicoOriginalDados.logradouro,
        numero: servicoOriginalDados.numero,
        complemento: servicoOriginalDados.complemento,
        bairro: servicoOriginalDados.bairro,
        cidade: servicoOriginalDados.cidade,
        uf: servicoOriginalDados.uf,
        latitude: servicoOriginalDados.latitude,
        longitude: servicoOriginalDados.longitude,
        associado_id: servicoOriginalDados.associado_id,
        veiculo_id: servicoOriginalDados.veiculo_id,
        contrato_id: servicoOriginalDados.contrato_id,
        cotacao_id: servicoOriginalDados.cotacao_id,
        origem: 'reagendamento_whatsapp',
        observacoes: `Reagendado via WhatsApp. Serviço original: ${confirmacao.servico_id}`
      })
      .select()
      .single();

    if (erroNovoServico) {
      console.error('[whatsapp-webhook] Erro ao criar novo serviço:', erroNovoServico);
      const { data: cfgTel2 } = await supabase.from("configuracoes").select("valor").eq("chave", "assistencia_telefone_central").maybeSingle();
      const tel0800b = cfgTel2?.valor || "0800 980 0001";
      const msg = `Ocorreu um erro ao reagendar. Por favor, entre em contato com nossa central ${tel0800b}.`;
      await sendWhatsAppMessage(apiUrl, instancia.instance_name, confirmacao.telefone, msg);
      await saveWhatsAppLog(supabase, instancia.id, confirmacao.telefone, msg, "saida");
      return new Response(JSON.stringify({ ok: false, error: erroNovoServico.message }), { headers: corsHeaders });
    }
    
    // CANCELAR SERVIÇO ORIGINAL
    await supabase
      .from('servicos')
      .update({ 
        status: 'cancelada',
        confirmacao_whatsapp: 'reagendado',
        profissional_id: null,
        observacoes: `Reagendado via WhatsApp para ${dataSelecionada.data}. Novo serviço: ${novoServico.id}`
      })
      .eq('id', confirmacao.servico_id);
    
    // ATUALIZAR CONFIRMAÇÃO
    await supabase.from('confirmacoes_agendamento')
      .update({ 
        status: 'reagendada',
        contexto_ia: {
          ...contextoAtual,
          etapa_reagendamento: 'FINALIZADO',
          novo_servico_id: novoServico.id
        }
      })
      .eq('id', confirmacao.id);
    
    // MENSAGEM DE CONFIRMAÇÃO
    const periodoTexto = periodo === 'manha' ? 'MANHÃ (08:00-12:00)' : 'TARDE (14:00-18:00)';
    const enderecoInfo = [servicoOriginalDados.logradouro, servicoOriginalDados.numero, servicoOriginalDados.bairro]
      .filter(Boolean)
      .join(', ') || 'Local agendado';
    
    const mensagemFinal = `Pronto, *${nomeCliente}*! ✅

Sua *${tipoServico}* foi reagendada com sucesso:

📅 *${dataSelecionada.formatada}*
⏰ Período: *${periodoTexto}*
📍 ${enderecoInfo}

Um técnico será designado e você receberá uma nova confirmação no dia.

Obrigado pela compreensão! 🚗`;

    await sendWhatsAppMessage(apiUrl, instancia.instance_name, confirmacao.telefone, mensagemFinal);
    await saveWhatsAppLog(supabase, instancia.id, confirmacao.telefone, mensagemFinal, "saida");
    
    console.log(`[whatsapp-webhook] ✅ Reagendamento concluído: ${novoServico.id}`);
    
    return new Response(JSON.stringify({ 
      ok: true, 
      action: 'reagendamento_concluido',
      novo_servico_id: novoServico.id,
      data: dataSelecionada.data,
      periodo
    }), { headers: corsHeaders });
  }
  
  // Fallback - retornar para etapa inicial se estado desconhecido
  console.log(`[whatsapp-webhook] Estado de reagendamento desconhecido: ${etapaAtual}`);
  await supabase.from('confirmacoes_agendamento')
    .update({ 
      contexto_ia: { ...contextoAtual, etapa_reagendamento: 'INICIAL' }
    })
    .eq('id', confirmacao.id);
  
  return await processarReagendamento(supabase, confirmacao, mensagemCliente, instancia);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("[whatsapp-webhook] Payload:", JSON.stringify(payload).substring(0, 500));

    // Validar que o payload tem estrutura esperada da Evolution API
    if (!payload || typeof payload !== 'object') {
      console.error("[whatsapp-webhook] Payload inválido recebido");
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: corsHeaders });
    }

    // Validar apikey da Evolution API (apenas log, não rejeitar)
    // A instância será validada logo abaixo — rejeitar aqui bloqueia mensagens legítimas
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    if (evolutionApiKey) {
      const webhookApiKey = req.headers.get("apikey") || payload.apikey;
      if (webhookApiKey && webhookApiKey !== evolutionApiKey) {
        console.warn("[whatsapp-webhook] API key do webhook diferente da configurada — continuando processamento");
      }
    }

    // Validar instance_name no payload contra instâncias cadastradas
    const instanceName = payload.instance?.instanceName || payload.instance;

    // Criar cliente Supabase (necessário para eventos de conexão também)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verificar se a instância é conhecida (se o nome foi fornecido)
    if (instanceName && typeof instanceName === 'string') {
      const { data: instanciaConhecida } = await supabase
        .from("whatsapp_instancias")
        .select("id")
        .eq("instance_name", instanceName)
        .eq("ativa", true)
        .maybeSingle();

      if (!instanciaConhecida) {
        console.error(`[whatsapp-webhook] Instância desconhecida: ${instanceName}`);
        return new Response(JSON.stringify({ error: "Unknown instance" }), { status: 403, headers: corsHeaders });
      }
    }

    // ========================================
    // PROCESSAR EVENTOS DE CONEXÃO (CONNECTION_UPDATE)
    // ========================================
    if (payload.event === "connection.update") {
      const state = payload.data?.state || payload.instance?.state;
      console.log(`[whatsapp-webhook] CONNECTION_UPDATE recebido: ${state}`);
      
      // IMPORTANTE: Ignorar eventos 'connecting' - são transitórios e não devem sobrescrever 'open'
      if (state === 'connecting') {
        console.log(`[whatsapp-webhook] Ignorando estado 'connecting' - mantendo status atual no banco`);
        return new Response(
          JSON.stringify({ success: true, message: "Estado connecting ignorado - transitório" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Mapear estado para nosso status (apenas estados definitivos)
      let novoStatus: string;
      if (state === 'open') {
        novoStatus = 'open';
      } else if (state === 'close' || state === 'qrcode') {
        novoStatus = 'disconnected';
      } else {
        // Estado desconhecido - logar e ignorar para não corromper dados
        console.log(`[whatsapp-webhook] Estado desconhecido '${state}' - ignorando`);
        return new Response(
          JSON.stringify({ success: true, message: `Estado ${state} ignorado` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
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
          
          // Criar notificação para usuários com permissão de gerenciar integrações
          const { data: configsInteg } = await supabase
            .from('app_roles_config')
            .select('role, permissions')
            .eq('is_active', true);
          const rolesInteg = (configsInteg || [])
            .filter(c => Array.isArray(c.permissions) && c.permissions.includes('canManageIntegracoes'))
            .map(c => c.role);
          const { data: diretores } = rolesInteg.length > 0
            ? await supabase.from('user_roles').select('user_id').in('role', rolesInteg)
            : { data: [] };
          
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
    const isMetaDelegate = !!payload._meta_delegate;
    if (isMetaDelegate) {
      console.log("[whatsapp-webhook] Delegação Meta detectada");
    }
    if (!data?.key || data.key.fromMe) {
      return new Response(JSON.stringify({ ok: true, ignored: "própria mensagem" }), { headers: corsHeaders });
    }

    // Extrair telefone
    const remoteJid = data.key.remoteJid || "";
    
    // Log detalhado para debug
    console.log("[whatsapp-webhook] Dados recebidos:", {
      remoteJid: data.key.remoteJid,
      sender: payload.sender,
      fromMe: data.key.fromMe,
      messageTypes: Object.keys(data.message || {})
    });
    
    if (remoteJid.includes("@g.us")) {
      // Ignorar grupos
      return new Response(JSON.stringify({ ok: true, ignored: "grupo" }), { headers: corsHeaders });
    }

    // Extrair telefone - suporte para formato LID vs tradicional
    let telefone: string;
    if (remoteJid.includes("@lid")) {
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

    // ============================================
    // DETECTAR TIPO DE MENSAGEM (TEXTO, ÁUDIO, IMAGEM, DOCUMENTO, etc.)
    // ============================================
    const messageData = data.message;
    const messageId = data.key.id;
    
    // Tipos de mensagem suportados pela Evolution API
    const tipoMensagem = {
      texto: messageData?.conversation || messageData?.extendedTextMessage?.text,
      imagem: messageData?.imageMessage,
      documento: messageData?.documentMessage,
      audio: messageData?.audioMessage,
      video: messageData?.videoMessage,
      localizacao: messageData?.locationMessage,
      contato: messageData?.contactMessage,
    };

    // Determinar tipo principal
    type TipoMensagem = 'texto' | 'imagem' | 'documento' | 'audio' | 'video' | 'localizacao' | 'contato' | 'desconhecido';
    let tipoPrincipal: TipoMensagem = 'desconhecido';

    if (tipoMensagem.texto) tipoPrincipal = 'texto';
    else if (tipoMensagem.audio) tipoPrincipal = 'audio';
    else if (tipoMensagem.imagem) tipoPrincipal = 'imagem';
    else if (tipoMensagem.documento) tipoPrincipal = 'documento';
    else if (tipoMensagem.video) tipoPrincipal = 'video';
    else if (tipoMensagem.localizacao) tipoPrincipal = 'localizacao';
    else if (tipoMensagem.contato) tipoPrincipal = 'contato';

    console.log(`[whatsapp-webhook] Tipo de mensagem detectado: ${tipoPrincipal}`);

    // Extrair dados conforme tipo
    let mensagemTexto = '';
    let mediaUrl: string | null = null;
    let mediaMimetype: string | null = null;
    let mediaFilename: string | null = null;
    let mediaArmazenada: string | null = null;

    // Buscar instância primeiro (precisamos para download de mídia)
    let instancia: any;
    if (isMetaDelegate) {
      // Delegação Meta: usar instância sintética (IA habilitada, sem Evolution API)
      instancia = { id: "meta_delegate", api_url: "", instance_name: "", ia_habilitada: true };
    } else {
      const { data: instanciaDb } = await supabase
        .from("whatsapp_instancias")
        .select("id, api_url, instance_name, ia_habilitada")
        .eq("principal", true)
        .single();

      if (!instanciaDb) {
        console.error("[whatsapp-webhook] Instância não encontrada");
        return new Response(JSON.stringify({ error: "Instância não configurada" }), { headers: corsHeaders });
      }
      instancia = instanciaDb;
    }

    // PRIORIZAR URL do secret sobre a URL do banco de dados
    const apiUrl = isMetaDelegate ? "" : (Deno.env.get('EVOLUTION_API_URL') || instancia.api_url);
    console.log(`[whatsapp-webhook] Usando API URL: ${apiUrl}`);

    switch (tipoPrincipal) {
      case 'texto':
        mensagemTexto = tipoMensagem.texto || '';
        break;
      
      case 'audio': {
        console.log(`[whatsapp-webhook] Áudio recebido de ${telefone}, processando...`);
        mediaUrl = tipoMensagem.audio.url;
        mediaMimetype = tipoMensagem.audio.mimetype;
        
        // Baixar e transcrever áudio
        const mediaResult = await downloadMediaEvolution(apiUrl, instancia.instance_name, messageId);
        
        if (mediaResult.success && mediaResult.base64) {
          // Armazenar mídia
          mediaArmazenada = await storeMediaSupabase(supabase, mediaResult.base64, mediaResult.mimetype || 'audio/ogg', telefone);
          
          // Transcrever áudio
          const transcricao = await transcreverAudio(mediaResult.base64, mediaResult.mimetype || 'audio/ogg');
          
          if (transcricao) {
            mensagemTexto = `[Áudio transcrito]: ${transcricao}`;
            console.log(`[whatsapp-webhook] Áudio transcrito com sucesso`);
          } else {
            mensagemTexto = "[Áudio recebido - não foi possível transcrever]";
          }
        } else {
          mensagemTexto = "[Áudio recebido - não foi possível processar]";
        }
        break;
      }
      
      case 'imagem': {
        console.log(`[whatsapp-webhook] Imagem recebida de ${telefone}`);
        mediaUrl = tipoMensagem.imagem.url;
        mediaMimetype = tipoMensagem.imagem.mimetype;
        const captionImagem = tipoMensagem.imagem.caption || '';
        
        // Baixar e armazenar imagem
        const mediaResult = await downloadMediaEvolution(apiUrl, instancia.instance_name, messageId);
        
        if (mediaResult.success && mediaResult.base64) {
          mediaArmazenada = await storeMediaSupabase(supabase, mediaResult.base64, mediaResult.mimetype || 'image/jpeg', telefone);
        }
        
        mensagemTexto = captionImagem ? `[Imagem]: ${captionImagem}` : '[Imagem recebida]';
        break;
      }
      
      case 'documento': {
        console.log(`[whatsapp-webhook] Documento recebido de ${telefone}`);
        mediaUrl = tipoMensagem.documento.url;
        mediaMimetype = tipoMensagem.documento.mimetype;
        mediaFilename = tipoMensagem.documento.fileName || 'documento';
        const captionDoc = tipoMensagem.documento.caption || '';
        
        // Baixar e armazenar documento
        const mediaResult = await downloadMediaEvolution(apiUrl, instancia.instance_name, messageId);
        
        if (mediaResult.success && mediaResult.base64) {
          mediaArmazenada = await storeMediaSupabase(supabase, mediaResult.base64, mediaResult.mimetype || 'application/pdf', telefone);
        }
        
        mensagemTexto = captionDoc ? `[Documento: ${mediaFilename}]: ${captionDoc}` : `[Documento recebido: ${mediaFilename}]`;
        break;
      }
      
      case 'video': {
        console.log(`[whatsapp-webhook] Vídeo recebido de ${telefone}`);
        mediaUrl = tipoMensagem.video.url;
        mediaMimetype = tipoMensagem.video.mimetype;
        const captionVideo = tipoMensagem.video.caption || '';
        
        // Baixar e armazenar vídeo (pode ser grande)
        const mediaResult = await downloadMediaEvolution(apiUrl, instancia.instance_name, messageId);
        
        if (mediaResult.success && mediaResult.base64) {
          mediaArmazenada = await storeMediaSupabase(supabase, mediaResult.base64, mediaResult.mimetype || 'video/mp4', telefone);
        }
        
        mensagemTexto = captionVideo ? `[Vídeo]: ${captionVideo}` : '[Vídeo recebido]';
        break;
      }
      
      case 'localizacao': {
        const lat = tipoMensagem.localizacao.degreesLatitude;
        const lng = tipoMensagem.localizacao.degreesLongitude;
        const nome = tipoMensagem.localizacao.name || '';
        
        console.log(`[whatsapp-webhook] Localização recebida: ${lat}, ${lng}`);
        
        // Tentar converter coordenadas em endereço
        try {
          const geoResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/reverse-geocode`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ latitude: lat, longitude: lng }),
          });
          
          if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            if (geoData.success && geoData.endereco_completo) {
              mensagemTexto = `[Localização compartilhada]: ${geoData.endereco_completo}`;
            } else {
              mensagemTexto = `[Localização compartilhada]: ${lat}, ${lng}${nome ? ` - ${nome}` : ''}`;
            }
          } else {
            mensagemTexto = `[Localização compartilhada]: ${lat}, ${lng}${nome ? ` - ${nome}` : ''}`;
          }
        } catch (e) {
          mensagemTexto = `[Localização compartilhada]: ${lat}, ${lng}${nome ? ` - ${nome}` : ''}`;
        }
        break;
      }
      
      case 'contato': {
        const displayName = tipoMensagem.contato.displayName || 'Contato';
        mensagemTexto = `[Contato compartilhado]: ${displayName}`;
        break;
      }
      
      default:
        // Tipo desconhecido - ignorar
        console.log(`[whatsapp-webhook] Tipo de mensagem não suportado:`, Object.keys(messageData || {}));
        return new Response(JSON.stringify({ ok: true, ignored: "tipo não suportado" }), { headers: corsHeaders });
    }

    // Validar se tem conteúdo para processar
    if (!mensagemTexto.trim() && !mediaArmazenada) {
      return new Response(JSON.stringify({ ok: true, ignored: "sem conteúdo" }), { headers: corsHeaders });
    }

    console.log(`[whatsapp-webhook] Mensagem de ${telefone}: ${mensagemTexto.substring(0, 100)}`);

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
    // VINCULAR MÍDIA A DOCUMENTOS PENDENTES
    // Primeiro tenta sinistro, depois cadastro
    // ========================================
    if (mediaArmazenada && (tipoPrincipal === 'imagem' || tipoPrincipal === 'documento')) {
      // 1. Tentar vincular a SINISTRO primeiro
      const resultadoSinistro = await vincularMidiaASinistroPendente(
        supabase,
        telefonesBusca,
        mediaArmazenada,
        instancia
      );
      
      if (resultadoSinistro.vinculado) {
        // Enviar confirmação
        const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
        if (EVOLUTION_API_KEY && resultadoSinistro.mensagem) {
          try {
            await fetch(`${apiUrl}/message/sendText/${instancia.instance_name}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: EVOLUTION_API_KEY,
              },
              body: JSON.stringify({
                number: telefone,
                text: resultadoSinistro.mensagem,
              }),
            });
            console.log(`[whatsapp-webhook] Confirmação de documento sinistro enviada para ${telefone}`);
          } catch (e) {
            console.error("[whatsapp-webhook] Erro ao enviar confirmação:", e);
          }
        }
        
        await saveWhatsAppLog(supabase, instancia.id, telefone, mensagemTexto, "entrada", messageId, tipoPrincipal, mediaArmazenada, mediaMimetype || undefined, mediaFilename || undefined);
        return new Response(JSON.stringify({ ok: true, sinistro_documento_vinculado: true }), { headers: corsHeaders });
      }

      // 2. Se não vinculou a sinistro, tentar CADASTRO
      const resultadoVinculo = await vincularMidiaADocumentoPendente(
        supabase,
        telefonesBusca,
        mediaArmazenada,
        tipoPrincipal as 'imagem' | 'documento',
        mediaFilename,
        instancia
      );
      
      if (resultadoVinculo.vinculado && resultadoVinculo.mensagem) {
        // Enviar confirmação ao cliente
        const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
        if (EVOLUTION_API_KEY) {
          try {
            await fetch(`${apiUrl}/message/sendText/${instancia.instance_name}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: EVOLUTION_API_KEY,
              },
              body: JSON.stringify({
                number: telefone,
                text: resultadoVinculo.mensagem,
              }),
            });
            console.log(`[whatsapp-webhook] Confirmação de documento enviada para ${telefone}`);
          } catch (e) {
            console.error("[whatsapp-webhook] Erro ao enviar confirmação:", e);
          }
        }
        
        // Salvar log e retornar
        await saveWhatsAppLog(supabase, instancia.id, telefone, mensagemTexto, "entrada", messageId, tipoPrincipal, mediaArmazenada, mediaMimetype || undefined, mediaFilename || undefined);
        return new Response(JSON.stringify({ ok: true, documento_vinculado: true }), { headers: corsHeaders });
      }
    }

    // ========================================
    // VERIFICAR SE É RESPOSTA DE CONFIRMAÇÃO
    // ========================================
    // Buscar confirmação pendente - incluindo status 'aguardando_confirmacao_manha' do disparo matinal
    const { data: confirmacaoPendente } = await supabase
      .from('confirmacoes_agendamento')
      .select('*, servico:servicos(id, profissional_id, hora_agendada, confirmacao_whatsapp)')
      .in('telefone', telefonesBusca)
      .in('status', ['enviada', 'reagendando'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (confirmacaoPendente && tipoPrincipal === 'texto') {
      console.log(`[whatsapp-webhook] Resposta de confirmação detectada para ${confirmacaoPendente.servico_id}`);
      return await processarRespostaConfirmacao(supabase, confirmacaoPendente, mensagemTexto, instancia);
    }

    // ========================================
    // FLUXO PADRÃO: ASSOCIADO OU LEAD
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

    // ========================================
    // SE NÃO É ASSOCIADO, VERIFICAR SE É LEAD
    // ========================================
    if (!associado) {
      console.log(`[whatsapp-webhook] Associado não encontrado, buscando lead para ${telefone}`);
      
      // Buscar lead pelo telefone
      const { data: lead } = await supabase
        .from("leads")
        .select("id, nome, vendedor_id, etapa, telefone")
        .or(`telefone.in.(${telefonesBusca.join(",")})`)
        .maybeSingle();
      
      if (lead) {
        console.log(`[whatsapp-webhook] Lead encontrado: ${lead.nome} (${lead.id})`);
        
        // Registrar mensagem no histórico do lead
        await supabase.from("leads_historico").insert({
          lead_id: lead.id,
          tipo: "mensagem_whatsapp",
          descricao: mensagemTexto.substring(0, 500),
          dados_extras: {
            telefone,
            tipo_mensagem: tipoPrincipal,
            media_url: mediaArmazenada,
          },
        });
        
        // Atualizar data do último contato
        await supabase.from("leads")
          .update({ 
            data_ultimo_contato: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", lead.id);
        
        // Salvar na tabela whatsapp_mensagens com referência ao lead
        await saveWhatsAppLog(
          supabase, 
          instancia.id, 
          telefone, 
          mensagemTexto, 
          "entrada",
          messageId,
          tipoPrincipal,
          mediaArmazenada || undefined,
          mediaMimetype || undefined,
          mediaFilename || undefined,
          lead.id,
          "lead",
          lead.nome
        );
        
        // Responder ao lead
        const primeiroNome = lead.nome?.split(' ')[0] || 'Cliente';
        await sendWhatsAppMessage(
          apiUrl,
          instancia.instance_name,
          telefone,
          `Olá ${primeiroNome}! 😊\n\nRecebemos sua mensagem. Nosso consultor entrará em contato em breve.\n\nAgradecemos o interesse na PRATICCAR! 🚗`
        );
        
        // Notificar vendedor do lead (se tiver)
        if (lead.vendedor_id) {
          // Buscar profile_id do vendedor
          const { data: vendedorProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", lead.vendedor_id)
            .single();
          
          if (vendedorProfile) {
            await supabase.from("notificacoes").insert({
              usuario_id: vendedorProfile.id,
              titulo: "📱 Lead respondeu no WhatsApp",
              mensagem: `${lead.nome}: "${mensagemTexto.substring(0, 100)}${mensagemTexto.length > 100 ? '...' : ''}"`,
              tipo: "info",
              dados: { lead_id: lead.id, telefone },
            });
          }
        }
        
        return new Response(JSON.stringify({ ok: true, lead_id: lead.id }), { headers: corsHeaders });
      }
      
      // ========================================
      // NÚMERO DESCONHECIDO - TENTAR IDENTIFICAR POR CPF
      // ========================================
      console.log(`[whatsapp-webhook] Número desconhecido: ${telefone}`);
      
      // Verificar se a mensagem é um CPF (11 dígitos)
      const cpfLimpo = mensagemTexto.replace(/\D/g, '');
      
      if (cpfLimpo.length === 11 && tipoPrincipal === 'texto') {
        console.log(`[whatsapp-webhook] Tentando identificar por CPF: ${cpfLimpo}`);
        
        // Buscar associado pelo CPF
        const { data: associadoPorCpf } = await supabase
          .from("associados")
          .select("id, nome, status, whatsapp, telefone")
          .eq("cpf", cpfLimpo)
          .eq("status", "ativo")
          .maybeSingle();
        
        if (associadoPorCpf) {
          // Atualizar o whatsapp do associado com esse número
          await supabase
            .from("associados")
            .update({ 
              whatsapp: telefone,
              updated_at: new Date().toISOString()
            })
            .eq("id", associadoPorCpf.id);
          
          const primeiroNome = associadoPorCpf.nome.split(' ')[0];
          
          await sendWhatsAppMessage(
            apiUrl,
            instancia.instance_name,
            telefone,
            `Encontrei você, *${primeiroNome}*! 🎉

Seu número foi vinculado ao seu cadastro. A partir de agora, posso te ajudar diretamente por aqui!

Como posso te ajudar hoje? 😊`
          );
          
          await saveWhatsAppLog(supabase, instancia.id, telefone, `CPF identificado: ${cpfLimpo}`, "entrada", messageId);
          await saveWhatsAppLog(supabase, instancia.id, telefone, `Associado vinculado: ${associadoPorCpf.nome}`, "saida");
          
          console.log(`[whatsapp-webhook] Associado ${associadoPorCpf.nome} vinculado ao telefone ${telefone}`);
          
          return new Response(JSON.stringify({ ok: true, cpf_linked: true, associado_id: associadoPorCpf.id }), { headers: corsHeaders });
        } else {
          // CPF não encontrado
          await saveWhatsAppLog(supabase, instancia.id, telefone, mensagemTexto, "entrada", messageId);
          
          await sendWhatsAppMessage(
            apiUrl,
            instancia.instance_name,
            telefone,
            `Não encontrei nenhum associado ativo com esse CPF. 😕

Verifique se o CPF está correto ou entre em contato com nossa central para mais informações.

📞 *Central de Atendimento*: Entre em contato pelo site praticcar.com.br`
          );
          
          return new Response(JSON.stringify({ ok: true, cpf_not_found: true }), { headers: corsHeaders });
        }
      }
      
      // Salvar mensagem mesmo assim para histórico
      await saveWhatsAppLog(
        supabase, 
        instancia.id, 
        telefone, 
        mensagemTexto, 
        "entrada",
        messageId,
        tipoPrincipal,
        mediaArmazenada || undefined,
        mediaMimetype || undefined,
        mediaFilename || undefined
      );
      
      // Pedir CPF para identificação
      await sendWhatsAppMessage(
        apiUrl,
        instancia.instance_name,
        telefone,
        `Olá! 👋 Não consegui identificar seu número em nosso sistema.

Por favor, me informe seu *CPF* (apenas números) para que eu possa te ajudar.

Se você ainda não é associado PRATIC, acesse nosso site ou entre em contato conosco! 📞`
      );
      return new Response(JSON.stringify({ ok: true, notFound: true, awaiting_cpf: true }), { headers: corsHeaders });
    }

    // ========================================
    // FLUXO ASSOCIADO: PROCESSAR COM IA
    // ========================================
    console.log(`[whatsapp-webhook] Associado encontrado: ${associado.nome} (${associado.id})`);

    // Salvar mensagem recebida com dados de mídia
    await saveWhatsAppLog(
      supabase, 
      instancia.id, 
      telefone, 
      mensagemTexto, 
      "entrada",
      messageId,
      tipoPrincipal,
      mediaArmazenada || undefined,
      mediaMimetype || undefined,
      mediaFilename || undefined,
      associado.id,
      "associado",
      associado.nome
    );
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
        const result = await executeTool(supabase, associado.id, toolName, toolArgs, telefone, instancia);
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
    const sendResult = isMetaDelegate
      ? await sendWhatsAppViaProxy(telefone, respostaFinal)
      : await sendWhatsAppMessage(apiUrl, instancia.instance_name, telefone, respostaFinal);
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
