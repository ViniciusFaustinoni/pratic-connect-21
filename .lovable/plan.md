

## Plano: Melhorar Identificação e Acolhimento no WhatsApp

### Problemas Identificados

A análise do código revelou que:

| Problema | Causa | Impacto |
|----------|-------|---------|
| IA não acolhe adequadamente | System prompt sem instruções de acolhimento | Experiência fria para o associado |
| "Nenhum veículo" quando existe | Contexto não mostra veículos com status pendente como válidos | Associado confuso |
| Não pede CPF para desconhecidos | Fluxo envia resposta genérica sem tentar identificar | Perde oportunidade de atendimento |
| Contexto muito simples | `getAssociadoContext` no webhook é básico vs rico no app | IA sem informações suficientes |

### Estado Atual

```text
Associado: MARCUS VINICIUS
  - telefone: 21992593830 ✅ (encontrado)
  - whatsapp: NULL
  - status: ativo ✅

Veículo: Toyota Corolla LTB4J74
  - status: instalacao_pendente
  - cobertura_roubo_furto: true ✅
  - cobertura_total: false

Contexto passado para IA:
  "Veículos: Nenhum" ❌ (deveria mostrar o veículo)
```

### Arquivos a Modificar

**1. `supabase/functions/whatsapp-webhook/index.ts`**

#### 1.1 Atualizar System Prompt (WHATSAPP_SYSTEM_PROMPT)

Adicionar regras de acolhimento e identificação:

```typescript
const WHATSAPP_SYSTEM_PROMPT = `Você é o Assistente Virtual PRATIC via WhatsApp.

## Acolhimento (MUITO IMPORTANTE!)
- SEMPRE cumprimente pelo PRIMEIRO NOME do associado
- Seja ACOLHEDOR e EMPÁTICO, especialmente em situações de sinistro
- Exemplo: "Oi, Marcus! Sinto muito pelo que aconteceu. Vou te ajudar..."
- Pergunte "está tudo bem?" quando o contexto pedir ajuda

## Regras do WhatsApp
- Seja CONCISO (mensagens curtas)
- Use formatação: *negrito*, _itálico_
- NÃO use marcadores [BOTAO_*] ou [UPLOAD_*]
- Para localização, peça endereço OU use reverse_geocode

## Capacidades
1. Consultar boletos pendentes e enviar PIX
2. Histórico de pagamentos
3. Status de sinistros
4. Abrir sinistro (coleta dados para aprovação)
5. Solicitar assistência 24h
6. Informações sobre veículos
7. Converter coordenadas em endereço

## REGRAS DE COBERTURA
Verifique a cobertura do veículo antes de criar solicitações:

### Veículo com status "instalacao_pendente":
- ✅ PERMITIDO: Sinistros de roubo/furto (se tiver cobertura_roubo_furto)
- ❌ BLOQUEADO: Assistência 24h, colisão, etc. (aguardando instalação)
- RESPONDA: "O veículo está aguardando instalação do rastreador. 
  No momento, só posso ajudar com sinistros de roubo ou furto."

### Veículo ativo com cobertura "APENAS ROUBO/FURTO":
- ✅ PERMITIDO: Sinistros de roubo/furto
- ❌ BLOQUEADO: Assistência 24h, colisão, incêndio

### Veículo ativo com cobertura "TOTAL":
- ✅ TUDO LIBERADO

## Coleta de Dados para Sinistro
1. Tipo do sinistro (colisão, roubo, furto, etc.)
2. Data e hora do ocorrido
3. Local (peça endereço ou coordenadas)
4. Descrição detalhada
5. B.O. foi registrado? (se sim, pedir para enviar)
6. Pedir fotos do veículo/danos (se aplicável)

## Coleta de Dados para Assistência
1. Tipo do serviço (guincho, chaveiro, pane, etc.)
2. Localização atual
3. Descrição do problema
4. Tipo de veículo (carro, moto)

## Regras Gerais
- Use a DATA ATUAL fornecida para datas relativas
- Confirme dados antes de criar solicitações
- Informe que solicitações passam por aprovação
- NUNCA invente informações

## Formato
- Respostas curtas e diretas
- Use emojis com moderação 🚗
- Máximo 3-4 parágrafos`;
```

#### 1.2 Melhorar `getAssociadoContext()` (~linha 1215)

Adicionar mais dados e tratar veículos pendentes:

```typescript
async function getAssociadoContext(supabase: any, associadoId: string) {
  // Buscar dados completos do associado
  const { data: associado } = await supabase
    .from("associados")
    .select("nome, email, telefone, whatsapp, cpf, status, plano:planos(nome)")
    .eq("id", associadoId)
    .single();

  // Buscar TODOS os veículos (incluindo pendentes)
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

  // Buscar sinistros em andamento
  const { data: sinistros } = await supabase
    .from("sinistros")
    .select("protocolo, tipo, status")
    .eq("associado_id", associadoId)
    .not("status", "in", "(finalizado,encerrado,cancelado)")
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
          ? "TOTAL (tudo liberado)" 
          : v.cobertura_roubo_furto 
            ? "APENAS ROUBO/FURTO" 
            : "SEM COBERTURA";
        const statusInfo = v.status === 'ativo' 
          ? '✅ Ativo' 
          : v.status === 'instalacao_pendente'
            ? '⏳ Aguardando Instalação'
            : `${v.status}`;
        return `- ${v.placa} (${v.marca} ${v.modelo}) - Status: ${statusInfo}, Cobertura: ${cobertura}, ID: ${v.id}`;
      }).join('\n')
    : 'Nenhum veículo cadastrado';

  // Formatar boletos
  const boletosFormatados = boletos?.length > 0
    ? boletos.map((b: any) => 
        `- R$ ${(b.valor || 0).toFixed(2)} vence ${new Date(b.data_vencimento).toLocaleDateString('pt-BR')} (${b.status})${b.pix_copia_cola ? ' - PIX disponível' : ''}`
      ).join('\n')
    : 'Nenhum boleto pendente ✅';

  // Formatar sinistros
  const sinistrosFormatados = sinistros?.length > 0
    ? sinistros.map((s: any) => `- ${s.protocolo}: ${s.tipo} (${s.status})`).join('\n')
    : 'Nenhum sinistro em aberto';

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
- **Nome**: ${associado?.nome || 'N/A'} (chame de "${primeiroNome}")
- **CPF**: ${associado?.cpf || 'N/I'}
- **Status**: ${associado?.status || 'N/A'}
- **Plano**: ${associado?.plano?.nome || 'Não definido'}

## VEÍCULOS
${veiculosFormatados}

## BOLETOS PENDENTES
${boletosFormatados}

## SINISTROS EM ANDAMENTO
${sinistrosFormatados}

## ASSISTÊNCIAS EM ANDAMENTO
${assistenciasFormatadas}

## INSTRUÇÕES
- Chame o associado pelo primeiro nome: "${primeiroNome}"
- Se o veículo está "Aguardando Instalação", só pode criar sinistro de roubo/furto
- Use SEMPRE os dados acima. NÃO invente informações!
`;
}
```

#### 1.3 Melhorar Fluxo para Números Desconhecidos (~linha 2333)

Antes de enviar mensagem genérica, tentar identificar por CPF:

```typescript
// Número desconhecido (nem associado nem lead)
console.log(`[whatsapp-webhook] Número desconhecido: ${telefone}`);

// Salvar mensagem para histórico
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

// Enviar mensagem de identificação
await sendWhatsAppMessage(
  apiUrl,
  instancia.instance_name,
  telefone,
  `Olá! 👋 Não consegui identificar seu número em nosso sistema.

Por favor, me informe seu *CPF* (apenas números) para que eu possa te ajudar.

Se você ainda não é associado PRATIC, acesse nosso site ou entre em contato conosco! 📞`
);

return new Response(JSON.stringify({ ok: true, notFound: true, awaiting_cpf: true }), { headers: corsHeaders });
```

#### 1.4 Adicionar Fluxo de Identificação por CPF

Criar função para processar CPF enviado por número desconhecido:

```typescript
// Verificar se é resposta com CPF (antes do fluxo de associado)
if (!associado && tipoPrincipal === 'texto') {
  const cpfLimpo = mensagemTexto.replace(/\D/g, '');
  
  // Se parece ser um CPF (11 dígitos)
  if (cpfLimpo.length === 11) {
    console.log(`[whatsapp-webhook] Tentando identificar por CPF: ${cpfLimpo}`);
    
    const { data: associadoPorCpf } = await supabase
      .from("associados")
      .select("id, nome, status, whatsapp, telefone")
      .eq("cpf", cpfLimpo)
      .eq("status", "ativo")
      .maybeSingle();
    
    if (associadoPorCpf) {
      // Atualizar o telefone/whatsapp do associado
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

Como posso te ajudar hoje?`
      );
      
      await saveWhatsAppLog(supabase, instancia.id, telefone, `CPF identificado: ${cpfLimpo}`, "entrada", messageId);
      await saveWhatsAppLog(supabase, instancia.id, telefone, `Associado vinculado: ${associadoPorCpf.nome}`, "saida");
      
      return new Response(JSON.stringify({ ok: true, cpf_linked: true, associado_id: associadoPorCpf.id }), { headers: corsHeaders });
    } else {
      await sendWhatsAppMessage(
        apiUrl,
        instancia.instance_name,
        telefone,
        `Não encontrei nenhum associado ativo com esse CPF. 😕

Verifique se o CPF está correto ou entre em contato com nossa central para mais informações.

📞 *Central de Atendimento*: (21) XXXX-XXXX`
      );
      
      return new Response(JSON.stringify({ ok: true, cpf_not_found: true }), { headers: corsHeaders });
    }
  }
}
```

### Resumo das Mudanças

| Alteração | Linhas | Descrição |
|-----------|--------|-----------|
| System Prompt | 258-301 | Adicionar regras de acolhimento, tratar veículos pendentes |
| `getAssociadoContext()` | 1215-1248 | Enriquecer contexto com boletos, sinistros, assistências |
| Identificação por CPF | ~2240 | Novo fluxo antes de processar como desconhecido |
| Mensagem para desconhecidos | ~2333 | Pedir CPF em vez de só dizer "não cadastrado" |

### Fluxo Esperado Após Correções

```text
Número desconhecido envia mensagem
        |
        v
Busca associado por telefone --> Não encontrado
        |
        v
Mensagem parece CPF? (11 dígitos)
        |
   Sim  |  Não
        |    |
        v    v
Busca por CPF    Envia: "Informe seu CPF"
        |
   Encontrado?
        |
   Sim  |  Não
        |    |
        v    v
Vincula telefone    "CPF não encontrado"
ao cadastro
        |
        v
"Encontrei você, [Nome]!"
```

### Testes Recomendados

1. **Teste de acolhimento**: Enviar "bati de carro" e verificar se a IA chama pelo nome e acolhe
2. **Teste de veículo pendente**: Verificar se mostra o veículo mesmo com status "instalacao_pendente"
3. **Teste de identificação por CPF**: Enviar mensagem de número desconhecido e depois CPF válido
4. **Teste de sinistro roubo/furto**: Para veículo com apenas cobertura roubo/furto, verificar se permite

