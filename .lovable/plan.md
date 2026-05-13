# Resposta direta

**Não.** Hoje a IA (`agente-consultor-ia`) **não consegue entender o contexto do template de cobrança CSV** quando o associado responde. Confirmado por leitura do código + banco.

## Por que falha

1. `agente-consultor-ia` monta o histórico assim (linhas 225–238):
   ```ts
   .from("whatsapp_mensagens")
   .select("mensagem, direcao, created_at")
   ```
   Ele lê **apenas a coluna `mensagem`** — não lê `template_variaveis`, não lê o corpo do template, não cruza com `cobrancas`.

2. A função `disparar-cobranca-csv-meta` grava em `whatsapp_mensagens.mensagem` apenas um marcador:
   ```
   [template cobranca_inadimplencia_pratic] EUZIRENE — 4 boleto(s) em 2 envio(s)
   ```
   O conteúdo real (nome, placa, vencimentos, linhas digitáveis) fica só na Meta e nunca entra na coluna `mensagem`.

3. O template `cobranca_inadimplencia_pratic` (`whatsapp_meta_templates.corpo`) é:
   ```
   Olá, {{1}}! 👋
   Identificamos pendência(s) financeira(s) ...
   📋 Boletos em aberto:
   {{2}}
   💳 Para regularizar, copie a linha digitável ...
   ```
   Os valores reais de `{{1}}` (nome) e `{{2}}` (blocos com placa/vencimento/linha digitável) são montados em runtime e descartados após enviar.

**Resultado prático**: quando EUZIRENE responde "qual o valor?" ou "já paguei o de setembro", o LLM vê no histórico só `[template cobranca_inadimplencia_pratic] EUZIRENE — 4 boleto(s) em 2 envio(s)` seguido da pergunta dela. Não tem placa, valor, vencimento nem código — vai responder genérico ou alucinar.

# Plano de correção

## 1. Renderizar e persistir o corpo real do template no envio CSV
Arquivo: `supabase/functions/disparar-cobranca-csv-meta/index.ts` (no insert das linhas 472 e 496).

- Buscar `corpo` do template uma vez por execução (`whatsapp_meta_templates` por `nome`).
- Para cada bloco enviado, substituir `{{1}}` pelo `nome` e `{{2}}` pelo texto do bloco que já é montado para o envio à Meta.
- Salvar esse texto final em `whatsapp_mensagens.mensagem` (uma linha por bloco enviado), mantendo `template_variaveis` com `{ template, matricula, bloco_index, total_blocos }`.
- Para o registro de erro, gravar o corpo renderizado do bloco que tentou enviar (mesmo padrão).

Assim o histórico passa a conter literalmente o que o associado recebeu.

## 2. Reforçar o contexto da IA quando há cobrança recente
Arquivo: `supabase/functions/agente-consultor-ia/index.ts`.

- Após carregar `historicoFormatado`, detectar se nas últimas 48h existe `whatsapp_mensagens` com `referencia_tipo = 'cobranca_csv'` para o telefone.
- Se existir, buscar a `matricula` em `template_variaveis` e carregar de `cobrancas` os boletos em aberto desse associado (placa, vencimento, valor, linha digitável, status).
- Injetar um bloco no `systemPrompt` tipo:
  ```
  ## CONTEXTO DE COBRANÇA RECENTE
  Você enviou ao associado {nome} (matrícula {matricula}) um template de cobrança em {data}.
  Boletos em aberto enviados:
  - Placa X, venc dd/mm, R$ Y, linha digitável ...
  Use estes dados como verdade ao responder dúvidas sobre valores, datas e pagamento.
  ```
- Garantir que o histórico real do template (passo 1) também esteja presente, dando dupla cobertura: texto literal + dados estruturados.

## 3. Validação ponta a ponta
- Como diretor (`admin@teste.com`), rodar novamente o fluxo Régua → Importar CSV (SGA) com 2 associados, disparar.
- Conferir em `whatsapp_mensagens` que `mensagem` agora contém o corpo renderizado completo (nome + bloco de boletos).
- Em `Eventos → Conversas IA`, abrir o atendimento do associado de teste, simular uma resposta ("qual valor do mais antigo?") e verificar nos logs do `agente-consultor-ia` que: (a) o histórico inclui o texto do template, (b) o bloco "CONTEXTO DE COBRANÇA RECENTE" foi injetado, (c) a resposta da IA cita placa/valor/vencimento corretos.

## Detalhes técnicos
- Não alterar schema: `whatsapp_mensagens.mensagem` já é `text`, `template_variaveis` já é `jsonb`.
- Manter idempotência do disparo (não regravar mensagem se `message_id` já existe).
- Sem alteração no webhook Meta de entrada — ele já grava `direcao = 'entrada'` corretamente; o gap era só no lado de saída + no prompt.
- Sem mudança de UI obrigatória; opcionalmente o badge "Cobrança" no chat continua valendo.
