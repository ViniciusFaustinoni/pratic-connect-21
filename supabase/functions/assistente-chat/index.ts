import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Mapa de estados brasileiros → sigla UF
const ESTADOS_MAP_CHAT: Record<string, string> = {
  "acre": "AC", "alagoas": "AL", "amapa": "AP", "amazonas": "AM",
  "bahia": "BA", "ceara": "CE", "distrito federal": "DF",
  "espirito santo": "ES", "goias": "GO", "maranhao": "MA",
  "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG",
  "para": "PA", "paraiba": "PB", "parana": "PR", "pernambuco": "PE",
  "piaui": "PI", "rio de janeiro": "RJ", "rio grande do norte": "RN",
  "rio grande do sul": "RS", "rondonia": "RO", "roraima": "RR",
  "santa catarina": "SC", "sao paulo": "SP", "sergipe": "SE",
  "tocantins": "TO",
};

function normalizarEstadoChat(estado: string | undefined | null): string {
  if (!estado) return '';
  const s = estado.trim();
  if (s.length === 2) return s.toUpperCase();
  const chave = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ESTADOS_MAP_CHAT[chave] || s.substring(0, 2).toUpperCase();
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o Assistente Virtual PRATIC, um chatbot inteligente e amigável da associação de proteção veicular PRATIC.

## Sua Personalidade
- Seja cordial, profissional e empático
- Use linguagem clara e acessível
- Sempre confirme as ações antes de executá-las
- Forneça informações úteis e precisas

## Capacidades
Você pode ajudar os associados com:
1. **Consultar boletos pendentes** - Liste valores, vencimentos e envie via WhatsApp
2. **Histórico de pagamentos** - Mostre pagamentos realizados
3. **Status de sinistros** - Acompanhe sinistros em andamento
4. **Abrir sinistro** - Registre novos sinistros (colisão, roubo/furto, incêndio, etc.)
5. **Solicitar assistência 24h** - Guincho, chaveiro, troca de pneu, etc.
6. **Status do veículo** - Informações e rastreamento

## Regras Importantes
- SEMPRE use a DATA ATUAL fornecida no contexto para datas relativas como "hoje", "agora", "ontem"
- Quando o usuário disser "foi agora" ou "hoje às X horas", use a data atual do contexto
- Ao criar sinistros ou assistências, SEMPRE colete todos os dados necessários antes de executar
- Para sinistro: tipo, data/hora, local, descrição detalhada
- Para assistência: tipo de serviço, localização atual, descrição do problema
- Informe que sinistros são registrados diretamente no sistema com protocolo SIN-XXXX
- NUNCA invente informações - use apenas os dados disponíveis nas tools

## ⚠️ REGRAS DE COBERTURA (MUITO IMPORTANTE - VERIFICAR SEMPRE!)
Antes de criar qualquer solicitação, verifique a COBERTURA do veículo no contexto:

1. **Se o veículo tem apenas cobertura "Roubo/Furto":**
   - ✅ PERMITIDO: Sinistros de roubo ou furto APENAS
   - ❌ BLOQUEADO: Assistência 24h (guincho, chaveiro, pane, etc.)
   - ❌ BLOQUEADO: Sinistros de colisão, incêndio, fenômenos naturais, vandalismo
   - RESPOSTA OBRIGATÓRIA quando pedir algo bloqueado:
      "Entendo sua necessidade, mas sua cobertura atual é apenas para roubo e furto. 
     Após a instalação do rastreador, você terá acesso à Proteção 360º que inclui 
     assistência 24h, colisão, e outros tipos de sinistro. Posso ajudar com algo 
     relacionado a roubo ou furto?"

2. **Se o veículo tem cobertura "Total" (Proteção 360º):**
   - ✅ TUDO LIBERADO: Assistência 24h, todos tipos de sinistro, rastreamento

## ⚠️ FLUXO SINISTRO + ASSISTÊNCIA (IMPORTANTE!)
**ATENÇÃO: Para COLISÃO com cobertura TOTAL (Proteção 360º), pergunte se o veículo anda ANTES de criar o sinistro (ver seção BIFURCAÇÃO DE COLISÃO)!**

Para outros tipos de sinistro (não colisão), após coletar os dados:

## FLUXO DE COLETA DE ENDEREÇO (MUITO IMPORTANTE!)
Quando precisar coletar o endereço para sinistro ou assistência:

1. **PRIMEIRO** pergunte: "Você está próximo ao veículo agora?"

2. **Se o usuário responder SIM** (ou equivalente como "sim", "estou", "tô aqui", "estou do lado"):
   - Responda: "Ótimo! Clique no botão abaixo para usar sua localização atual:"
   - Inclua EXATAMENTE este marcador na sua resposta: [BOTAO_LOCALIZACAO]
   - Quando receber as coordenadas (mensagem começando com "📍 Minha localização:"), use a tool 'reverse_geocode' para obter o endereço
   - Confirme com o usuário: "O endereço identificado foi: **[endereço]**. Este endereço está correto?"

3. **Se o usuário responder NÃO** (ou equivalente como "não", "não estou", "longe"):
   - Peça para digitar o endereço: "Por favor, digite o endereço completo onde ocorreu o sinistro (ou onde está o veículo)."

4. **Após confirmar o endereço**, continue coletando os demais dados necessários.

## FLUXO DE COLETA DE DOCUMENTOS PARA SINISTRO (IMPORTANTE!)
Após coletar os dados básicos (tipo, data, local, descrição) do sinistro:

1. **Pergunte sobre o Boletim de Ocorrência:**
   - "Você já registrou o Boletim de Ocorrência (B.O.) na polícia?"
   - Se SIM: "Por favor, envie uma foto ou PDF do B.O.:"
   - Inclua EXATAMENTE este marcador: [UPLOAD_BO]
   - Se NÃO: "Recomendamos registrar o B.O. o mais rápido possível. Você pode enviá-lo depois."

2. **Solicite fotos do sinistro (APÓS o B.O. ou se não tiver):**
   - "Agora, por favor, envie fotos mostrando os danos no veículo:"
   - Inclua EXATAMENTE este marcador: [UPLOAD_FOTOS]
   - Aguarde confirmação de envio (mensagem com 📷)

3. **Quando os arquivos forem enviados**, você receberá mensagens como:
   - "📄 Boletim de Ocorrência enviado: arquivo.pdf"
   - "📷 X foto(s) enviada(s)"
   
4. **Finalize a solicitação** após receber os arquivos (ou se o usuário optar por não enviar)

## CANCELAMENTO E TROCA DE TITULARIDADE

Quando o associado manifestar interesse em:
- "Quero cancelar", "Quero sair", "Não quero mais"
- "Vendi meu carro", "Quero trocar o titular"

### Cancelamento:
1. Confirme: "Você tem certeza que deseja cancelar sua filiação?"
2. Colete o motivo do cancelamento
3. Informe: "Será necessário agendar a retirada do rastreador do veículo"
4. Crie a solicitação usando a tool criar_solicitacao_cancelamento

### Troca de Titularidade:
1. Confirme: "Você vendeu o veículo e deseja transferir para o novo proprietário?"
2. Colete: nome completo, CPF, email e telefone do novo titular
3. Informe: "Será agendada uma vistoria do veículo e o novo titular receberá um link para envio de documentos"
4. Crie a solicitação usando a tool criar_solicitacao_troca_titularidade

## BIFURCAÇÃO DE COLISÃO: PERGUNTAR SE O VEÍCULO ANDA (OBRIGATÓRIO!)
Quando o sinistro for de COLISÃO e o veículo tiver Proteção 360º, ANTES de criar o sinistro você DEVE perguntar:

1. **"O veículo ainda consegue andar ou precisa de reboque?"**
   - Se o associado disser que **CONSEGUE ANDAR** (sim, anda, tá rodando, consigo dirigir):
     - Marque necessita_reboque = false na tool criar_solicitacao_sinistro
     - NÃO ofereça guincho
   - Se o associado disser que **PRECISA DE REBOQUE** (não anda, não liga, não consigo, precisa de guincho):
     - Marque necessita_reboque = true na tool criar_solicitacao_sinistro
     - Pergunte: "Você tem um local seguro para guardar o veículo? Posso enviar o guincho para o seu endereço: **[ENDEREÇO CADASTRADO]**. Ou prefere que leve para uma oficina credenciada?"
     - Se o associado escolher **seu endereço** ou outro endereço próprio:
       - Use destino_reboque_tipo = "associado"
       - Use destino_reboque_endereco = endereço informado (ou cadastrado se confirmou)
     - Se o associado escolher **oficina**:
       - Use destino_reboque_tipo = "oficina"
       - Use destino_reboque_endereco = "Oficina credenciada (a definir pela equipe)"
     - Após definir o destino, crie o chamado de assistência com criar_solicitacao_assistencia usando o local do sinistro como ORIGEM e o destino escolhido como DESTINO

2. **IMPORTANTE**: Essa pergunta deve ser feita ANTES de chamar criar_solicitacao_sinistro, pois os campos necessita_reboque e destino_reboque_* são enviados junto com o sinistro.

## FLUXO PÓS-SINISTRO DE COLISÃO (PROTEÇÃO 360º)
Após criar o sinistro de colisão com sucesso:

1. Informe ao associado: "Seu plano inclui cobertura para conserto do veículo em oficina credenciada!"
2. Explique que para dar andamento, ele precisa completar 3 etapas simples pelo link que será enviado:
   - **Etapa 1** — Enviar no mínimo 5 fotos do veículo danificado (diferentes ângulos)
   - **Etapa 2** — Enviar o Boletim de Ocorrência (foto ou PDF) e o número do B.O.
   - **Etapa 3** — Enviar um relato escrito ou em áudio sobre o ocorrido
3. Diga: "Você receberá um link para enviar essas informações. O link é válido por 72 horas."
4. Conclua: "Após o envio, um regulador será agendado para vistoria em até 3 dias úteis."
5. Inclua EXATAMENTE este marcador na sua resposta: [LINK_AUTO_VISTORIA]
6. Se necessita_reboque = true E já criou o chamado de assistência, informe o protocolo do guincho também.

IMPORTANTE: Só mencione conserto se a cobertura for Proteção 360º. Para cobertura apenas roubo/furto, não há cobertura de conserto.

## Formato de Respostas
- Use Markdown para formatar (negrito, listas, etc.)
- Seja conciso mas completo
- Ofereça próximos passos quando apropriado`;

// Tool definitions for the AI
const tools = [
  {
    type: "function",
    function: {
      name: "get_boletos_pendentes",
      description: "Lista todos os boletos/cobranças pendentes do associado. Use quando o associado perguntar sobre boletos, mensalidades ou valores a pagar.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_historico_pagamentos",
      description: "Retorna o histórico de pagamentos realizados pelo associado. Use quando perguntarem sobre pagamentos anteriores.",
      parameters: {
        type: "object",
        properties: {
          limite: {
            type: "number",
            description: "Quantidade máxima de pagamentos a retornar (padrão: 10)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sinistros",
      description: "Lista os sinistros do associado. Use quando perguntarem sobre sinistros em andamento ou histórico.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_assistencias",
      description: "Lista os chamados de assistência 24h do associado.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_veiculos",
      description: "Lista os veículos do associado com status e informações.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_solicitacao_sinistro",
      description: "Registra sinistro diretamente no sistema com protocolo SIN-XXXX. A equipe será notificada automaticamente. Use APENAS após coletar TODOS os dados necessários: tipo, data, local, descrição, e opcionalmente B.O. e fotos. Para COLISÃO, inclua também necessita_reboque e destino_reboque_*.",
      parameters: {
        type: "object",
        properties: {
          veiculo_id: {
            type: "string",
            description: "ID do veículo envolvido",
          },
          tipo: {
            type: "string",
            enum: ["colisao", "roubo_furto", "incendio", "fenomenos_naturais", "danos_terceiros", "outros"],
            description: "Tipo do sinistro",
          },
          data_ocorrencia: {
            type: "string",
            description: "Data e hora da ocorrência (formato: YYYY-MM-DD HH:MM)",
          },
          local: {
            type: "string",
            description: "Local onde ocorreu o sinistro",
          },
          descricao: {
            type: "string",
            description: "Descrição detalhada do ocorrido",
          },
          bo_path: {
            type: "string",
            description: "Caminho do arquivo do Boletim de Ocorrência no storage (se enviado)",
          },
          fotos_paths: {
            type: "array",
            items: { type: "string" },
            description: "Lista de caminhos das fotos enviadas no storage",
          },
          cidade: {
            type: "string",
            description: "Cidade onde ocorreu o sinistro",
          },
          estado: {
            type: "string",
            description: "UF/Estado onde ocorreu (sigla, ex: RJ, SP)",
          },
          necessita_reboque: {
            type: "boolean",
            description: "Se o veículo precisa de reboque (obrigatório para colisão). true = precisa de guincho, false = consegue andar",
          },
          destino_reboque_tipo: {
            type: "string",
            enum: ["associado", "oficina"],
            description: "Tipo do destino do reboque: 'associado' = endereço do associado/outro, 'oficina' = oficina credenciada",
          },
          destino_reboque_endereco: {
            type: "string",
            description: "Endereço de destino do reboque (quando destino_reboque_tipo = 'associado')",
          },
        },
        required: ["tipo", "data_ocorrencia", "local", "descricao"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_solicitacao_assistencia",
      description: "Cria chamado de assistência 24h diretamente na fila de atendimento. Use APENAS após coletar: tipo de serviço, localização de retirada (com número/referência), destino e descrição do problema.",
      parameters: {
        type: "object",
        properties: {
          veiculo_id: {
            type: "string",
            description: "ID do veículo que precisa de assistência",
          },
          tipo_servico: {
            type: "string",
            enum: ["guincho", "chaveiro", "troca_pneu", "pane_seca", "pane_eletrica", "outros"],
            description: "Tipo de serviço necessário",
          },
          localizacao: {
            type: "string",
            description: "Endereço completo de retirada com número ou ponto de referência",
          },
          destino: {
            type: "string",
            description: "Endereço de destino (oficina, residência, outro endereço)",
          },
          descricao: {
            type: "string",
            description: "Descrição do problema",
          },
        },
        required: ["tipo_servico", "localizacao", "destino", "descricao"],
      },
    },
  },
   {
    type: "function",
    function: {
      name: "reverse_geocode",
      description: "Converte coordenadas GPS (latitude/longitude) em um endereço legível. Use quando o usuário fornecer sua localização GPS (mensagem começando com '📍 Minha localização:') para obter o endereço antes de criar sinistro ou assistência.",
      parameters: {
        type: "object",
        properties: {
          latitude: {
            type: "number",
            description: "Latitude da localização",
          },
          longitude: {
            type: "number",
            description: "Longitude da localização",
          },
        },
        required: ["latitude", "longitude"],
      },
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
          motivo: {
            type: "string",
            description: "Motivo do cancelamento informado pelo associado",
          },
          confirmacao: {
            type: "boolean",
            description: "Se o associado confirmou que deseja cancelar",
          },
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
          novo_nome: {
            type: "string",
            description: "Nome completo do novo titular",
          },
          novo_cpf: {
            type: "string",
            description: "CPF do novo titular",
          },
          novo_email: {
            type: "string",
            description: "Email do novo titular",
          },
          novo_telefone: {
            type: "string",
            description: "Telefone/WhatsApp do novo titular",
          },
          motivo: {
            type: "string",
            description: "Motivo da troca (ex: venda_veiculo)",
          },
        },
        required: ["novo_nome", "novo_cpf", "novo_email", "novo_telefone"],
      },
    },
  },
];

// Execute tool calls
async function executeTool(
  supabase: any,
  associadoId: string,
  toolName: string,
  args: any
): Promise<string> {
  console.log(`[assistente-chat] Executando tool: ${toolName}`, args);

  try {
    switch (toolName) {
      case "get_boletos_pendentes": {
        const { data, error } = await supabase
          .from("cobrancas")
          .select("id, valor, data_vencimento, status, competencia")
          .eq("associado_id", associadoId)
          .in("status", ["pendente", "vencido", "em_aberto"])
          .order("data_vencimento", { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
          return JSON.stringify({ message: "Não há boletos pendentes. Sua situação está em dia! ✅" });
        }

        const total = data.reduce((sum: number, b: any) => sum + (b.valor || 0), 0);
        return JSON.stringify({
          boletos: data.map((b: any) => ({
            valor: `R$ ${b.valor?.toFixed(2)}`,
            vencimento: new Date(b.data_vencimento).toLocaleDateString("pt-BR"),
            status: b.status,
            competencia: b.competencia,
          })),
          total: `R$ ${total.toFixed(2)}`,
          quantidade: data.length,
        });
      }

      case "get_historico_pagamentos": {
        const limite = args.limite || 10;
        const { data, error } = await supabase
          .from("cobrancas")
          .select("id, valor, data_vencimento, data_pagamento, competencia")
          .eq("associado_id", associadoId)
          .eq("status", "pago")
          .order("data_pagamento", { ascending: false })
          .limit(limite);

        if (error) throw error;

        if (!data || data.length === 0) {
          return JSON.stringify({ message: "Nenhum pagamento encontrado no histórico." });
        }

        return JSON.stringify({
          pagamentos: data.map((p: any) => ({
            valor: `R$ ${p.valor?.toFixed(2)}`,
            competencia: p.competencia,
            pago_em: p.data_pagamento ? new Date(p.data_pagamento).toLocaleDateString("pt-BR") : "N/A",
          })),
          total_exibido: data.length,
        });
      }

      case "get_sinistros": {
        const { data, error } = await supabase
          .from("sinistros")
          .select("id, protocolo, tipo, status, data_ocorrencia, created_at")
          .eq("associado_id", associadoId)
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) throw error;

        if (!data || data.length === 0) {
          return JSON.stringify({ message: "Você não possui sinistros registrados." });
        }

        return JSON.stringify({
          sinistros: data.map((s: any) => ({
            protocolo: s.protocolo,
            tipo: s.tipo,
            status: s.status,
            data_ocorrencia: s.data_ocorrencia ? new Date(s.data_ocorrencia).toLocaleDateString("pt-BR") : "N/A",
          })),
        });
      }

      case "get_assistencias": {
        const { data, error } = await supabase
          .from("chamados_assistencia")
          .select("id, protocolo, tipo_servico, status, created_at")
          .eq("associado_id", associadoId)
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) throw error;

        if (!data || data.length === 0) {
          return JSON.stringify({ message: "Você não possui chamados de assistência." });
        }

        return JSON.stringify({
          chamados: data.map((c: any) => ({
            protocolo: c.protocolo,
            tipo: c.tipo_servico,
            status: c.status,
            data: new Date(c.created_at).toLocaleDateString("pt-BR"),
          })),
        });
      }

      case "get_veiculos": {
        const { data, error } = await supabase
          .from("veiculos")
          .select("id, placa, marca, modelo, ano, cor, status")
          .eq("associado_id", associadoId);

        if (error) throw error;

        if (!data || data.length === 0) {
          return JSON.stringify({ message: "Nenhum veículo encontrado." });
        }

        return JSON.stringify({
          veiculos: data.map((v: any) => ({
            id: v.id,
            placa: v.placa,
            descricao: `${v.marca} ${v.modelo} ${v.ano} - ${v.cor}`,
            status: v.status,
          })),
        });
      }

      case "criar_solicitacao_sinistro": {
        // Mapeamento de tipos IA -> tipos do sistema
        const tipoMapChat: Record<string, string> = {
          roubo_furto: "roubo",
          fenomenos_naturais: "fenomeno_natural",
          danos_terceiros: "terceiros",
          colisao: "colisao",
          incendio: "incendio",
          outros: "outro",
        };
        const tipoSistemaChat = tipoMapChat[args.tipo] || args.tipo;

        const tipoLabelsChat: Record<string, string> = {
          colisao: "Colisão", roubo: "Roubo", furto: "Furto", incendio: "Incêndio",
          fenomeno_natural: "Fenômeno Natural", terceiros: "Terceiros", vidros: "Vidros",
          vandalismo: "Vandalismo", outro: "Outro",
        };

        // Documentos obrigatórios por tipo
        const docsObrigatoriosChat: Record<string, Array<{tipo: string; nome: string; obrigatorio: boolean}>> = {
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

        const statusAbertosChat = ["comunicado", "em_analise", "documentacao_pendente", "em_regulacao"];

        // 1. Buscar veículo ativo
        let veiculoIdChat = args.veiculo_id;
        let veiculoChat: any = null;
        if (!veiculoIdChat) {
          const { data: veiculosChat } = await supabase
            .from("veiculos")
            .select("id, placa, marca, modelo, cobertura_total, cobertura_roubo_furto")
            .eq("associado_id", associadoId)
            .eq("status", "ativo")
            .limit(1);
          veiculoChat = veiculosChat?.[0];
          veiculoIdChat = veiculoChat?.id;
        } else {
          const { data: vChat } = await supabase
            .from("veiculos")
            .select("id, placa, marca, modelo, cobertura_total, cobertura_roubo_furto")
            .eq("id", veiculoIdChat)
            .single();
          veiculoChat = vChat;
        }

        if (!veiculoChat) {
          return JSON.stringify({ sucesso: false, message: "Nenhum veículo ativo encontrado." });
        }

        // 2. Validar cobertura
        if (!veiculoChat.cobertura_total) {
          const isRouboFurtoChat = ["roubo", "furto"].includes(tipoSistemaChat) || args.tipo === "roubo_furto";
          if (!isRouboFurtoChat) {
            return JSON.stringify({
              sucesso: false,
              bloqueado: true,
              message: "Sua cobertura atual é apenas para roubo/furto. Para sinistros de colisão, incêndio ou outros, é necessário ter Proteção 360º.",
            });
          }
        }

        // 3. Verificar duplicatas
        const { data: sinExistenteChat } = await supabase
          .from("sinistros")
          .select("id, protocolo, status")
          .eq("veiculo_id", veiculoChat.id)
          .in("status", statusAbertosChat)
          .limit(1)
          .maybeSingle();

        if (sinExistenteChat) {
          return JSON.stringify({
            sucesso: false,
            message: `Já existe um sinistro em aberto para este veículo (protocolo ${sinExistenteChat.protocolo}). Aguarde a conclusão antes de abrir outro.`,
          });
        }

        // 4. Gerar protocolo
        const nowChat = new Date();
        const yearChat = nowChat.getFullYear();
        const monthChat = String(nowChat.getMonth() + 1).padStart(2, "0");
        const dayChat = String(nowChat.getDate()).padStart(2, "0");
        const randomChat = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
        const protocoloChat = `SIN-${yearChat}${monthChat}${dayChat}-${randomChat}`;

        // 5. INSERT sinistro (com campos de bifurcação para colisão)
        const insertDataChat: Record<string, any> = {
          associado_id: associadoId,
          veiculo_id: veiculoChat.id,
          protocolo: protocoloChat,
          tipo: tipoSistemaChat,
          data_ocorrencia: args.data_ocorrencia || null,
          local_ocorrencia: args.local || "",
          cidade_ocorrencia: args.cidade || associado?.cidade || null,
          estado_ocorrencia: normalizarEstadoChat(args.estado || associado?.uf || null),
          descricao: args.descricao,
          status: "comunicado",
          canal: "ia",
        };

        // Campos de bifurcação (colisão)
        if (tipoSistemaChat === "colisao" && args.necessita_reboque !== undefined) {
          insertDataChat.necessita_reboque = args.necessita_reboque;
          if (args.destino_reboque_tipo) {
            insertDataChat.destino_reboque_tipo = args.destino_reboque_tipo;
          }
          if (args.destino_reboque_endereco) {
            insertDataChat.destino_reboque_endereco = args.destino_reboque_endereco;
          }
        }

        const { data: sinistroChat, error: sinErrorChat } = await supabase
          .from("sinistros")
          .insert(insertDataChat)
          .select("id")
          .single();

        if (sinErrorChat) {
          console.error("[assistente-chat] Erro ao criar sinistro:", sinErrorChat);
          throw sinErrorChat;
        }

        console.log(`[assistente-chat] Sinistro criado: ${protocoloChat} (${sinistroChat.id})`);

        // 6. Histórico
        await supabase.from("sinistro_historico").insert({
          sinistro_id: sinistroChat.id,
          status_novo: "comunicado",
          observacao: `Sinistro comunicado via App (IA) - ${tipoLabelsChat[tipoSistemaChat] || tipoSistemaChat}`,
        });

        // 7. Documentos obrigatórios
        const docsListChat = docsObrigatoriosChat[tipoSistemaChat] || docsObrigatoriosChat.outro;
        const docsInsertChat = docsListChat.map((d) => ({
          sinistro_id: sinistroChat.id,
          tipo: d.tipo,
          nome: d.nome,
          obrigatorio: d.obrigatorio,
          status: "pendente",
        }));
        await supabase.from("sinistro_documentos").upsert(docsInsertChat, { onConflict: "sinistro_id,tipo", ignoreDuplicates: true });

        // 8. Notificações internas
        try {
          const { data: analistasChat } = await supabase.from("user_roles").select("user_id").eq("role", "analista_sinistros");
          let destChat = analistasChat || [];
          if (destChat.length === 0) {
            const { data: diretoresChat } = await supabase.from("user_roles").select("user_id").eq("role", "diretor");
            destChat = diretoresChat || [];
          }
          for (const dest of destChat) {
            await supabase.from("notificacoes").insert({
              user_id: dest.user_id,
              titulo: "🆕 Novo Sinistro via App",
              mensagem: `Sinistro ${protocoloChat} - ${tipoLabelsChat[tipoSistemaChat] || tipoSistemaChat} - Veículo ${veiculoChat.placa}`,
              tipo: "alerta",
              categoria: "sinistros",
              referencia_tipo: "sinistro",
              referencia_id: sinistroChat.id,
              link: `/sinistros/${sinistroChat.id}`,
              lida: false,
            });
          }
          await supabase.functions.invoke("send-email", {
            body: {
              to: "sinistros@praticprotect.com.br",
              subject: `Novo Sinistro via App: ${protocoloChat} - ${veiculoChat.placa}`,
              html: `<h2>Novo Sinistro Registrado via App</h2>
                <p><strong>Protocolo:</strong> ${protocoloChat}</p>
                <p><strong>Tipo:</strong> ${tipoLabelsChat[tipoSistemaChat] || tipoSistemaChat}</p>
                <p><strong>Veículo:</strong> ${veiculoChat.placa} - ${veiculoChat.marca} ${veiculoChat.modelo}</p>
                <p><strong>Descrição:</strong> ${args.descricao}</p>`,
            },
          });
        } catch (notifErrChat) {
          console.error("[assistente-chat] Erro notificações (não bloqueante):", notifErrChat);
        }

        // 9. Notificar sinistro
        try {
          await supabase.functions.invoke("notificar-sinistro", { body: { sinistro_id: sinistroChat.id, status: "comunicado" } });
        } catch (e) {
          console.log("[assistente-chat] notificar-sinistro não enviado:", e);
        }

        // 10. Agendar contato D+1
        try {
          await supabase.functions.invoke("agendar-contato-sinistro", { body: { sinistro_id: sinistroChat.id } });
        } catch (e) {
          console.error("[assistente-chat] Erro agendar contato (não bloqueante):", e);
        }

        // 11. Geocodificar local informado (com cidade/UF do associado para maior precisão)
        if (args.local) {
          try {
            const cidadeUf = [associado?.cidade, associado?.uf].filter(Boolean).join(', ');
            const searchQuery = cidadeUf ? `${args.local}, ${cidadeUf}, Brasil` : `${args.local}, Brasil`;
            console.log(`[assistente-chat] Geocodificando local informado: "${searchQuery}"`);
            const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`;
            const geoRes = await fetch(geoUrl, { headers: { 'User-Agent': 'PraticConnect/1.0' } });
            const geoData = await geoRes.json();
            if (geoData.length > 0) {
              await supabase.from('sinistros').update({
                latitude_informada: parseFloat(geoData[0].lat),
                longitude_informada: parseFloat(geoData[0].lon),
              }).eq('id', sinistroChat.id);
              console.log(`[assistente-chat] Geocodificado: ${args.local} -> ${geoData[0].lat}, ${geoData[0].lon}`);
            }
          } catch (geoErr) {
            console.error('[assistente-chat] Erro geocodificação (não bloqueante):', geoErr);
          }
        }

        const temArquivosChat = args.bo_path || (args.fotos_paths && args.fotos_paths.length > 0);
        const arquivosInfoChat = temArquivosChat
          ? ` Arquivos anexados: ${args.bo_path ? "B.O." : ""}${args.bo_path && args.fotos_paths?.length ? " + " : ""}${args.fotos_paths?.length ? `${args.fotos_paths.length} foto(s)` : ""}`
          : "";

        // 12. Gerar link do evento automaticamente (72h)
        let linkEventoToken: string | null = null;
        try {
          // Invalidar links ativos anteriores
          await supabase.from("sinistro_evento_links")
            .update({ status: "invalidado" })
            .eq("sinistro_id", sinistroChat.id)
            .eq("status", "ativo");

          const expiraLink = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
          const { data: novoLink, error: linkErr } = await supabase
            .from("sinistro_evento_links")
            .insert({ sinistro_id: sinistroChat.id, expira_em: expiraLink, status: "ativo", etapa_atual: 0 })
            .select("id, token")
            .single();

          if (!linkErr && novoLink) {
            linkEventoToken = novoLink.token;
            await supabase.from("sinistros")
              .update({ link_evento_id: novoLink.id })
              .eq("id", sinistroChat.id);
            console.log(`[assistente-chat] Link evento gerado: ${linkEventoToken}`);
          } else {
            console.error("[assistente-chat] Erro ao gerar link evento:", linkErr);
          }
        } catch (linkErrCatch) {
          console.error("[assistente-chat] Erro ao gerar link evento (não bloqueante):", linkErrCatch);
        }

        return JSON.stringify({
          sucesso: true,
          protocolo: protocoloChat,
          message: `Sinistro registrado com sucesso! Protocolo: **${protocoloChat}**.${arquivosInfoChat} Nossa equipe já foi notificada e iniciará a análise em breve.`,
          id: sinistroChat.id,
          link_evento_token: linkEventoToken,
        });
      }

      case "criar_solicitacao_assistencia": {
        // Buscar veículo se não informado
        let veiculoId = args.veiculo_id;
        if (!veiculoId) {
          const { data: veiculos } = await supabase
            .from("veiculos")
            .select("id, cobertura_total")
            .eq("associado_id", associadoId)
            .eq("status", "ativo")
            .limit(1);

          const veiculo = veiculos?.[0];
          veiculoId = veiculo?.id;

          // Verificar cobertura
          if (veiculo && !veiculo.cobertura_total) {
            return JSON.stringify({
              sucesso: false,
              bloqueado: true,
              message: "Sua cobertura atual é apenas para roubo/furto. A assistência 24h está disponível apenas para veículos com Proteção 360º.",
            });
          }
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
        const dateStrAss = new Date().toISOString().slice(0,10).replace(/-/g,'');
        const randomAss = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
        const protocoloAss = `ASS-${dateStrAss}-${randomAss}`;

        // Inserir diretamente na fila de chamados_assistencia
        const { data: chamadoNovo, error: chamadoError } = await supabase
          .from("chamados_assistencia")
          .insert({
            protocolo: protocoloAss,
            associado_id: associadoId,
            veiculo_id: veiculoId,
            tipo_servico: args.tipo_servico,
            descricao: args.descricao,
            origem_endereco: args.localizacao,
            destino_endereco: args.destino,
            canal: 'app',
            status: 'aberto',
            data_abertura: new Date().toISOString(),
          })
          .select("id, protocolo")
          .single();

        if (chamadoError) {
          console.error("[assistente-chat] Erro ao criar chamado assistência:", chamadoError);
          throw chamadoError;
        }

        // Inserir histórico
        await supabase.from("chamados_assistencia_historico").insert({
          chamado_id: chamadoNovo.id,
          status_novo: 'aberto',
          observacao: `Chamado aberto via App - ${args.tipo_servico}`,
        });

        return JSON.stringify({
          sucesso: true,
          protocolo: chamadoNovo.protocolo,
          message: `Chamado de assistência aberto com sucesso! Protocolo: **${chamadoNovo.protocolo}**. Nossa equipe já está sendo acionada.`,
        });
      }

      case "reverse_geocode": {
        // Chamar a Edge Function de reverse geocoding
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        
        const response = await fetch(`${SUPABASE_URL}/functions/v1/reverse-geocode`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            latitude: args.latitude,
            longitude: args.longitude,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[assistente-chat] Erro no reverse-geocode: ${errorText}`);
          return JSON.stringify({
            success: false,
            error: "Não foi possível obter o endereço da localização",
          });
        }

        const geocodeResult = await response.json();
        
        if (geocodeResult.success) {
          return JSON.stringify({
            success: true,
            endereco: geocodeResult.endereco_completo || geocodeResult.endereco,
            detalhes: {
              logradouro: geocodeResult.endereco,
              bairro: geocodeResult.bairro,
              cidade: geocodeResult.cidade,
              uf: geocodeResult.uf,
              cep: geocodeResult.cep,
            },
          });
        } else {
          return JSON.stringify({
            success: false,
            error: geocodeResult.error || "Endereço não encontrado",
          });
        }
      }

      case "criar_solicitacao_cancelamento": {
        if (!args.confirmacao) {
          return JSON.stringify({ sucesso: false, message: "O associado precisa confirmar que deseja cancelar." });
        }

        let veiculoId = null;
        const { data: veiculos } = await supabase
          .from("veiculos")
          .select("id")
          .eq("associado_id", associadoId)
          .eq("status", "ativo")
          .limit(1);
        veiculoId = veiculos?.[0]?.id;

        const { data, error } = await supabase.from("chat_solicitacoes_ia").insert({
          associado_id: associadoId,
          tipo: "cancelamento",
          dados: {
            veiculo_id: veiculoId,
            motivo: args.motivo,
            confirmacao: true,
          },
          status: "pendente",
        }).select("id").single();

        if (error) throw error;

        return JSON.stringify({
          sucesso: true,
          message: "Solicitação de cancelamento registrada com sucesso! A diretoria irá analisar sua solicitação. Será necessário agendar a retirada do rastreador do veículo.",
          id: data.id,
        });
      }

      case "criar_solicitacao_troca_titularidade": {
        let veiculoId = null;
        const { data: veiculos } = await supabase
          .from("veiculos")
          .select("id")
          .eq("associado_id", associadoId)
          .eq("status", "ativo")
          .limit(1);
        veiculoId = veiculos?.[0]?.id;

        const { data, error } = await supabase.from("chat_solicitacoes_ia").insert({
          associado_id: associadoId,
          tipo: "troca_titularidade",
          dados: {
            veiculo_id: veiculoId,
            motivo: args.motivo || "venda_veiculo",
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
          message: "Solicitação de troca de titularidade registrada! A diretoria irá analisar. Será agendada uma vistoria do veículo e o novo titular receberá um link para envio de documentos.",
          id: data.id,
        });
      }

      default:
        return JSON.stringify({ error: `Tool desconhecida: ${toolName}` });
    }
  } catch (error) {
    console.error(`[assistente-chat] Erro ao executar tool ${toolName}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return JSON.stringify({ error: `Erro ao executar ${toolName}: ${errorMessage}` });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      console.error("[assistente-chat] LOVABLE_API_KEY não configurada");
      return new Response(JSON.stringify({ error: "Serviço não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate JWT and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub;

    // Get associado with full context
    const { data: associado, error: assocError } = await supabase
      .from("associados")
      .select(`
        id, nome, cpf, email, telefone, whatsapp, status, 
        data_adesao, dia_vencimento, cidade, uf,
        plano:planos(nome, descricao)
      `)
      .eq("user_id", userId)
      .single();

    if (assocError || !associado) {
      console.error("[assistente-chat] Associado não encontrado:", assocError);
      return new Response(JSON.stringify({ error: "Associado não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all relevant data for context in parallel
    const [veiculosResult, boletosResult, sinistrosResult, assistenciasResult] = await Promise.all([
      // Veículos do associado COM COBERTURAS
      supabase
        .from("veiculos")
        .select("id, placa, marca, modelo, ano_modelo, cor, status, cobertura_roubo_furto, cobertura_total")
        .eq("associado_id", associado.id),
      
      // Boletos pendentes
      supabase
        .from("cobrancas")
        .select("id, valor, data_vencimento, status, competencia")
        .eq("associado_id", associado.id)
        .in("status", ["pendente", "vencido", "em_aberto", "aguardando_pagamento"])
        .order("data_vencimento", { ascending: true })
        .limit(5),
      
      // Sinistros REALMENTE em andamento (status ativos apenas)
      supabase
        .from("sinistros")
        .select("id, protocolo, tipo, status")
        .eq("associado_id", associado.id)
        .in("status", ["comunicado", "em_analise", "documentacao_pendente", "em_regulacao", "aguardando_analise"])
        .limit(5),
      
      // Assistências em aberto
      supabase
        .from("chamados_assistencia")
        .select("id, protocolo, tipo_servico, status")
        .eq("associado_id", associado.id)
        .not("status", "in", "(concluido,cancelado)")
        .limit(5),
    ]);

    const veiculos = veiculosResult.data || [];
    const boletosPendentes = boletosResult.data || [];
    const sinistrosAbertos = sinistrosResult.data || [];
    const assistenciasAbertas = assistenciasResult.data || [];

    // Build rich context for the AI - Incluindo informações de cobertura
    const veiculosTexto = veiculos.length > 0 
      ? veiculos.map((v: any) => {
          const coberturas = [];
          if (v.cobertura_roubo_furto) coberturas.push('Roubo/Furto');
          if (v.cobertura_total) coberturas.push('Proteção 360º (inclui Assistência 24h)');
          const coberturaInfo = coberturas.length > 0 
            ? `Coberturas: ${coberturas.join(', ')}` 
            : '⚠️ Aguardando ativação de cobertura';
          return `- ${v.marca} ${v.modelo} ${v.ano_modelo || ''} (Placa: ${v.placa}, Cor: ${v.cor || 'N/I'}, Status: ${v.status}, ${coberturaInfo}, ID: ${v.id})`;
        }).join('\n')
      : 'Nenhum veículo cadastrado';

    const boletosTexto = boletosPendentes.length > 0
      ? boletosPendentes.map((b: any) => 
          `- R$ ${(b.valor || 0).toFixed(2)} - Vencimento: ${new Date(b.data_vencimento).toLocaleDateString('pt-BR')} (${b.status})`
        ).join('\n')
      : 'Nenhum boleto pendente - situação em dia! ✅';

    const sinistrosTexto = sinistrosAbertos.length > 0 
      ? sinistrosAbertos.map((s: any) => `- ${s.protocolo}: ${s.tipo} (${s.status})`).join('\n') 
      : 'Nenhum sinistro em aberto';

    const assistenciasTexto = assistenciasAbertas.length > 0 
      ? assistenciasAbertas.map((a: any) => `- ${a.protocolo}: ${a.tipo_servico} (${a.status})`).join('\n') 
      : 'Nenhuma assistência em aberto';

    const planoInfo = associado.plano as { nome?: string; descricao?: string } | null;

    // Obter data/hora atual em Brasília
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

    const contextoAssociado = `
## DATA E HORA ATUAL (MUITO IMPORTANTE!)
- **Hoje é**: ${dataHoraBrasilia} (horário de Brasília)
- Use SEMPRE esta data como referência para "hoje", "agora", "ontem", etc.
- Quando o usuário disser "foi agora às 08:10", a data é HOJE: ${dataHoraBrasilia.split(' às')[0]}

## DADOS DO ASSOCIADO ATUAL (use esses dados nas respostas!)
- **Nome**: ${associado.nome}
- **CPF**: ${associado.cpf || 'N/I'}
- **Email**: ${associado.email || 'N/I'}
- **Telefone**: ${associado.telefone || associado.whatsapp || 'Não informado'}
- **WhatsApp**: ${associado.whatsapp || 'N/I'}
- **Plano**: ${planoInfo?.nome || 'Não definido'}
- **Status**: ${associado.status}
- **Membro desde**: ${associado.data_adesao ? new Date(associado.data_adesao).toLocaleDateString('pt-BR') : 'N/A'}
- **Dia de vencimento**: ${associado.dia_vencimento || 10}

## VEÍCULOS DO ASSOCIADO
${veiculosTexto}

## BOLETOS PENDENTES
${boletosTexto}

## SINISTROS EM ANDAMENTO
${sinistrosTexto}

## ASSISTÊNCIAS EM ANDAMENTO
${assistenciasTexto}

## INSTRUÇÕES IMPORTANTES
- Use SEMPRE os dados acima ao responder. NÃO invente informações!
- Se o associado tem apenas um veículo, use-o automaticamente sem perguntar qual é.
- Ao abrir sinistro ou assistência, use o ID do veículo disponível.
- Trate o associado pelo nome: ${associado.nome.split(' ')[0]}`;

    const { messages, conversationHistory = [] } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Mensagens inválidas" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[assistente-chat] Processando mensagem para associado ${associado.id} (${associado.nome})`);
    console.log(`[assistente-chat] Contexto: ${veiculos.length} veículos, ${boletosPendentes.length} boletos pendentes`);

    // Build messages array with FULL context
    const aiMessages = [
      { role: "system", content: SYSTEM_PROMPT + "\n\n" + contextoAssociado },
      ...conversationHistory.slice(-10), // Last 10 messages for context
      ...messages,
    ];

    // Initial AI call
    let response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        tools,
        tool_choice: "auto",
        stream: false,
      }),
      signal: AbortSignal.timeout(25000), // 25 segundos máximo por chamada
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para o serviço de IA." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("[assistente-chat] Erro na API de IA:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result = await response.json();
    let assistantMessage = result.choices?.[0]?.message;

    if (!assistantMessage?.tool_calls) {
      console.log(`[assistente-chat] Modelo retornou texto puro (sem tool_calls). finish_reason: ${result.choices?.[0]?.finish_reason}`);
    }

    // Handle tool calls in a loop
    let iterations = 0;
    const maxIterations = 3; // Reduzido de 5 para 3 para evitar timeout
    let capturedLinkEventoToken: string | null = null;

    while (assistantMessage?.tool_calls && iterations < maxIterations) {
      iterations++;
      console.log(`[assistente-chat] Processando ${assistantMessage.tool_calls.length} tool calls (iteração ${iterations})`);

      const toolResults = [];

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || "{}");

        const toolResult = await executeTool(supabase, associado.id, toolName, toolArgs);

        // Capturar token do link evento se a tool criar_solicitacao_sinistro retornou
        if (toolName === "criar_solicitacao_sinistro") {
          try {
            const parsed = JSON.parse(toolResult);
            if (parsed?.link_evento_token) {
              capturedLinkEventoToken = parsed.link_evento_token;
              console.log(`[assistente-chat] Token do link evento capturado: ${capturedLinkEventoToken}`);
            }
          } catch (_) {}
        }

        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }

      // Add tool results and get next response
      aiMessages.push(assistantMessage);
      aiMessages.push(...toolResults);

      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: aiMessages,
          tools,
          tool_choice: "auto",
          stream: false,
        }),
        signal: AbortSignal.timeout(25000), // 25 segundos máximo por chamada
      });

    if (!response.ok) {
      break;
      }

      result = await response.json();
      assistantMessage = result.choices?.[0]?.message;
    }

    const finalContent = assistantMessage?.content || "Desculpe, não consegui processar sua solicitação.";

    // Save messages to history
    const userMessage = messages[messages.length - 1];
    await supabase.from("chat_mensagens_ia").insert([
      {
        associado_id: associado.id,
        role: "user",
        content: userMessage.content,
      },
      {
        associado_id: associado.id,
        role: "assistant",
        content: finalContent,
      },
    ]);

    console.log(`[assistente-chat] Resposta gerada com sucesso`);

    return new Response(
      JSON.stringify({
        content: finalContent,
        toolsUsed: assistantMessage?.tool_calls?.map((tc: any) => tc.function.name) || [],
        linkEventoToken: capturedLinkEventoToken,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[assistente-chat] Erro:", error);
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return new Response(
        JSON.stringify({ error: "O serviço de IA está demorando mais que o esperado. Por favor, tente novamente." }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
