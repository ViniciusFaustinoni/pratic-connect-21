
# Corrigir: IA cria guincho sem confirmacao e nao gera link do evento

## Diagnostico (confirmado pelos logs)

Os logs da edge function revelam o problema real:

```
18:50:49 - Executando tool: criar_solicitacao_assistencia (guincho)
18:51:04 - Executando tool: criar_solicitacao_assistencia (guincho)
18:51:34 - Executando tool: criar_solicitacao_assistencia (guincho)
18:56:34 - Modelo retornou texto puro (sem tool_calls). finish_reason: stop
18:56:48 - Modelo retornou texto puro (sem tool_calls). finish_reason: stop
```

**A IA esta chamando `criar_solicitacao_assistencia` (guincho) mas NUNCA chama `criar_solicitacao_sinistro`.** Resultado:
- Chamado de guincho criado sem o associado pedir
- Sinistro nunca registrado no banco
- Link do evento nunca gerado (depende do sinistro existir)
- `[LINK_AUTO_VISTORIA]` aparece como texto puro (sem token associado)

## Causa Raiz

O prompt do sistema (linhas 51-54) esta incompleto. Diz "Apos coletar os dados de um sinistro de COLISAO..." mas a secao corta abruptamente para o fluxo de endereco sem definir:
1. Que o sinistro DEVE ser criado PRIMEIRO com `criar_solicitacao_sinistro`
2. Que o guincho so deve ser oferecido APOS criar o sinistro E com confirmacao explicita
3. Que NUNCA deve chamar `criar_solicitacao_assistencia` automaticamente

## Solucao

### 1. Corrigir prompt do sistema (assistente-chat)

**Arquivo:** `supabase/functions/assistente-chat/index.ts`

Reescrever a secao "FLUXO SINISTRO + ASSISTENCIA" (linhas 51-55) para ser explicita e inequivoca:

```text
## FLUXO SINISTRO + ASSISTENCIA (IMPORTANTE!)
ATENCAO: So pergunte sobre guincho se a cobertura for TOTAL!

ORDEM OBRIGATORIA para sinistro de COLISAO com cobertura TOTAL:

1. PRIMEIRO: Colete TODOS os dados do sinistro (tipo, data, local, descricao)
2. SEGUNDO: Chame a tool "criar_solicitacao_sinistro" para registrar o sinistro
3. TERCEIRO: So APOS o sinistro criado com sucesso, PERGUNTE ao associado:
   "Voce precisa de guincho/reboque para o veiculo?"
4. QUARTO: Se o associado CONFIRMAR que precisa de guincho:
   - Colete origem e destino
   - Ai sim chame "criar_solicitacao_assistencia"
5. QUINTO: Apos tudo, siga o FLUXO POS-REBOQUE (etapas + link)

REGRA CRITICA: NUNCA chame "criar_solicitacao_assistencia" sem
confirmacao EXPLICITA do associado. A IA DEVE perguntar e aguardar
resposta antes de criar qualquer chamado de assistencia.
```

### 2. Corrigir o fluxo pos-sinistro no prompt

Atualizar a secao "FLUXO POS-REBOQUE PARA COLISAO" (linhas 110-121) para funcionar tanto COM quanto SEM guincho:

```text
## FLUXO POS-SINISTRO PARA COLISAO (COBERTURA TOTAL)
Apos criar o sinistro com sucesso (protocolo SIN-XXXX gerado):

1. Informe: "Seu sinistro foi registrado com protocolo SIN-XXXX!"
2. Se cobertura TOTAL, informe sobre as 3 etapas do link
3. Inclua o marcador [LINK_AUTO_VISTORIA] na resposta
4. So entao pergunte sobre guincho
```

### 3. Corrigir a descricao da tool `criar_solicitacao_assistencia`

Adicionar enfase na descricao da tool para reforcar que precisa de confirmacao:

```text
description: "Cria chamado de assistencia 24h. IMPORTANTE: Use SOMENTE
apos o associado CONFIRMAR EXPLICITAMENTE que deseja o servico.
NUNCA crie automaticamente."
```

### 4. Corrigir renderizacao do `[LINK_AUTO_VISTORIA]` no frontend

**Arquivo:** `src/components/app/chat/ChatMessage.tsx`

O componente ja detecta o marcador e ja tem o `EventoLinkButton`. O problema e que `linkEventoToken` chega como `null` porque `criar_solicitacao_sinistro` nunca foi chamado. Com a correcao do prompt (itens 1-3), o sinistro sera criado, o token gerado, e o botao renderizado.

Porem, como fallback adicional, quando `[LINK_AUTO_VISTORIA]` esta presente mas `linkEventoToken` e null, o marcador deve ser removido do texto (ja e feito) e nenhum botao deve aparecer (ja e o comportamento atual). Nao ha mudanca necessaria no frontend.

### 5. Deploy

Fazer deploy da edge function `assistente-chat` apos as alteracoes no prompt.

## Resumo das alteracoes

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/assistente-chat/index.ts` | Reescrever prompt: fluxo obrigatorio sinistro-primeiro, guincho apenas com confirmacao explicita; atualizar descricao da tool de assistencia |

## Resultado esperado

1. Associado relata colisao no chat
2. IA coleta dados (tipo, data, local, descricao)
3. IA chama `criar_solicitacao_sinistro` -> sinistro criado + link gerado
4. IA mostra protocolo + botao "Acessar Link do Evento" (renderizado pelo frontend)
5. IA PERGUNTA: "Voce precisa de guincho?"
6. So cria chamado de assistencia se o associado confirmar
