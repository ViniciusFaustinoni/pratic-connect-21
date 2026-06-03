## Princípio canônico (novo)

**Maya NUNCA deixa vácuo.** Toda mensagem do cliente recebe uma resposta com **começo, meio e fim** — mesmo quando:

- O cliente manda dado inválido (CPF errado, telefone errado, foto ilegível, áudio ruim, localização vazia)
- O cliente manda só "oi" / "?" / emoji / sticker / nada inteligível
- O cliente manda fora do contexto do que a Maya pediu
- O cliente repete a mesma coisa várias vezes
- A IA não conseguiu interpretar a intenção
- Uma tool falhou (timeout, erro técnico, sem resultado)
- O cliente está em pausa de transbordo humano
- O debounce de alguma frase específica está ativo

Debounce existe para evitar **repetir a mesma frase** literal, NÃO para silenciar a conversa. Se uma frase está debounced, a Maya manda **outra coisa** (reformulação, próximo passo, oferta de ajuda).

## Estrutura "começo, meio, fim" obrigatória em toda resposta

- **Começo**: reconhece o que o cliente acabou de mandar ("Recebi seu CPF", "Entendi que você quer um guincho", "Vi sua foto")
- **Meio**: explica o resultado / próximo passo / por que não dá pra prosseguir
- **Fim**: pergunta clara OU oferta de transbordo ("Pode me mandar X?" / "Prefere falar com um atendente humano?")

Sem essas 3 partes, a mensagem da Maya é rejeitada por um validador antes de sair.

## Pontos de vácuo identificados hoje (a corrigir)

Levantamento rápido por leitura do `agente-consultor-ia`, `processar-fila-ia`, `whatsapp-webhook` e tools (precisa ser confirmado no momento da implementação):

1. **Gate de CPF** (`agente-consultor-ia/index.ts` ~447–530)
   - Texto sem CPF + debounce saudação ativo → silêncio
   - Número de 8–10 ou 12–14 dígitos → tratado como "sem CPF" → silêncio
   - CPF inválido repetido → mesma frase loop sem escalada
2. **Pós-greeting** sem resposta do cliente em X tempo → nada
3. **Tool falhou** (ex.: SGA timeout, OCR falhou, busca de boleto vazia) → fallback genérico ausente em vários branches
4. **Pausa por transbordo humano** → já manda `notificacoes_sistema`, mas **cliente** não recebe sinal de "alguém vai te chamar em breve"
5. **Mensagem não-textual sem handler** (sticker, contato, doc não esperado) → nenhum reconhecimento
6. **LLM devolve resposta vazia / só whitespace / só tool_call sem texto** → mensagem do usuário fica sem reply
7. **Erro 5xx da LLM** → catch silencioso em alguns branches do `processar-fila-ia`

## Mudanças

### A. Middleware "garantia-de-resposta" no `agente-consultor-ia`

Wrapper em torno do handler principal:

```ts
async function handleComGarantia(req, ctx) {
  try {
    const resp = await handleOriginal(req, ctx);
    if (!respostaFoiEnviada(ctx)) {
      await enviarFallbackContinuidade(ctx, 'sem_resposta_handler');
    }
    return resp;
  } catch (err) {
    await enviarFallbackContinuidade(ctx, 'erro_interno', err);
    throw err;
  }
}
```

`enviarFallbackContinuidade` monta começo+meio+fim baseado no contexto:
- Sabe a última coisa que a Maya pediu (ex.: CPF, foto, localização) → repete o pedido reformulado
- Sabe a última coisa que o cliente mandou → reconhece
- Sempre termina oferecendo transbordo: *"Se preferir falar com um humano agora, é só responder 'atendente'."*

Debounce próprio (2 min) por **tipo de fallback**, não por frase exata, para não floodar mas garantir 1 sinal a cada interação.

### B. Validador de saída

Antes de chamar `whatsapp-send-text`, passar a resposta por `validarRespostaMaya(texto)`:

- Rejeita string vazia / só whitespace / só emoji
- Rejeita se for **idêntica** à última mensagem enviada nesta conversa (debounce literal)
- Se reprovar, substitui pela `enviarFallbackContinuidade` apropriada

### C. Gate de CPF — casos faltantes

No bloco do CPF (citado acima):
- Numérico 6–14 dígitos que não passa `validateCpf` → "Recebi os números, mas não formam um CPF válido (precisa ter 11). Pode conferir? 😉"
- Texto livre + debounce saudação ativo → continuidade ("Entendi! Pra eu seguir, preciso do CPF — só números.")
- 3 tentativas inválidas → oferta de transbordo humano (já existe a tool)

Coluna nova em `agente_ia_contatos`: `cpf_tentativas_invalidas int default 0` (reseta ao capturar CPF válido).

### D. Branches de tool failure

Auditar handlers de tool no `agente-consultor-ia` (cada `case 'nome_tool'` no dispatcher) e garantir que **todo `catch` chama enviarFallbackContinuidade** em vez de só `console.error`. Lista atual de tools (precisa confirmar na implementação):

- `consultar_boletos`, `buscar_associado_cpf`, `solicitar_atendente_humano`, `verificar_status_servico`, `enviar_link_pagamento`, etc.

Resposta padrão de tool falha:
> *"Tive um probleminha técnico aqui pra buscar essa informação 😅. Posso tentar de novo em alguns segundos, ou se preferir já te transfiro pra um atendente humano — é só responder 'atendente'."*

### E. Mensagens não-textuais sem handler

No `whatsapp-webhook`, quando o tipo (sticker, contato, áudio sem transcrição válida) cair em branch sem ação:
- Enviar: *"Recebi sua mensagem, mas não consegui ler [tipo]. Pode escrever em texto o que precisa? Se preferir falar com um humano, é só responder 'atendente'."*

### F. Cliente em pausa de transbordo humano

Hoje a pausa é silenciosa do lado cliente (só notifica Relacionamento). Adicionar **1 mensagem de confirmação** no momento que a pausa entra:
> *"Já avisei nosso time aqui 💬 Em instantes alguém da equipe vem falar com você por aqui mesmo. Aguarda só um momentinho 🙏"*

Dedup 12h (uma vez por janela de pausa). Já existe a notificação interna; só falta a confirmação ao cliente.

### G. Telemetria

Tabela nova `maya_vacuo_log` (ou campo em `chat_mensagens_ia`):
- `motivo` (handler_sem_resposta, tool_failure, validador_rejeitou, mensagem_nao_textual, etc.)
- `telefone`, `created_at`, `payload_in`, `payload_out_fallback`

Permite painel de auditoria pra ver se ainda existe vácuo depois das mudanças.

## Detalhes técnicos

**Arquivos afetados:**
- `supabase/functions/agente-consultor-ia/index.ts` — wrapper + gate CPF + tool catches
- `supabase/functions/whatsapp-webhook/index.ts` — handler de tipos não suportados
- `supabase/functions/processar-fila-ia/index.ts` — catch raiz com fallback
- `supabase/functions/whatsapp-send-text/index.ts` — chamar `validarRespostaMaya` no entry point (ou criar `enviar-mensagem-maya` que encapsula)
- Nova lib compartilhada: `supabase/functions/_shared/maya-garantia-resposta.ts`

**Migrations:**
- `agente_ia_contatos.cpf_tentativas_invalidas int default 0`
- `agente_ia_contatos.ultima_msg_continuidade_em timestamptz`
- `maya_vacuo_log` (tabela + GRANT + RLS)

**Memória canônica a adicionar:**
> Maya NUNCA deixa vácuo. Toda mensagem recebe resposta com começo+meio+fim. Debounce só impede repetir a mesma frase, nunca silencia a conversa. Wrapper `handleComGarantia` + validador de saída + log em `maya_vacuo_log`. Ver `mem://logic/operations/maya-nunca-deixa-vacuo`.

## Resultado esperado

Em qualquer cenário — CPF errado, foto borrada, sticker, tool quebrada, LLM vazia, pausa humana — o cliente recebe **uma mensagem coerente** em menos de 30s reconhecendo o que mandou, explicando o estado, e ou pedindo o próximo passo ou oferecendo transbordo. Zero silêncio.
