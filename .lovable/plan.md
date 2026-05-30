# Problema

Quando um template Meta é disparado pelo sistema (ex.: lembrete de instalação, cobrança, confirmação de vistoria) e o associado responde minutos/horas depois, a Maya IA não entende o contexto e responde de forma genérica (frequentemente como "mensagem fria").

# Causa raiz (duas falhas combinadas)

**1. `whatsapp-send-text` grava template Meta como `tipo: "text"` (sem template_id)**

Em `supabase/functions/whatsapp-send-text/index.ts`, no envio bem-sucedido via Meta API (linhas 436–440 e retry em 395–399), o registro em `whatsapp_mensagens` sempre usa:

```
tipo: "text", mensagem: <fallback texto>
```

mesmo quando `templateName` foi usado. Não persiste `template_id` nem `template_variaveis`.

Consequência: o `getConversationHistory` da Maya (whatsapp-webhook, linha 1898) **só rotula como `[Template enviado:…]` quando `w.tipo === "template"`**. Como o tipo está `"text"`, a IA recebe apenas o corpo do fallback sem nenhuma marcação de continuidade — e a regra "Continuidade de templates" do system prompt (linhas 270–273) nunca dispara.

**2. Janela de contexto fixa em 2 horas**

`getConversationHistory` (whatsapp-webhook, linha 1860) filtra `whatsapp_mensagens` por `created_at >= now - 2h`. No caso do screenshot, o template foi enviado às 07:00 e o "Sim" chegou às 09:14 — **2h14min depois, fora da janela**. A IA recebeu o histórico sem o template, perdendo o gatilho de continuidade.

Templates Meta abrem janela de 24h pela política da própria Meta, então qualquer resposta dentro desse intervalo deveria ter contexto.

# Correção (escopo mínimo)

### A. Registrar templates Meta corretamente em `whatsapp-send-text`

Nos 3 pontos de insert pós-envio bem-sucedido via Meta com template (linhas 395–399 retry e 436–440 principal), quando `templateName` estiver presente, gravar:

```
tipo: "template",
template_id: templateName,
template_variaveis: { params: paramsArray, components: components },  // o que estiver disponível no escopo
mensagem: mensagem  // mantém o fallback textual para leitura humana
```

Não tocar nos inserts de erro/bloqueio (linhas 139, 288, 422) — esses já estão consistentes com o que aconteceu. Não tocar nos envios de texto livre (sem template_name).

### B. Ampliar janela do histórico da IA

Em `supabase/functions/whatsapp-webhook/index.ts`, função `getConversationHistory` (linha 1860):

- Trocar a janela de **2h** por **24h** (alinhada com a janela de atendimento Meta).
- Manter o `limit(20)` em cada fonte e o corte final `slice(-15)` para não estourar contexto da IA — apenas a peneira temporal expande.

### C. Verificação

Após o deploy, reproduzir o cenário: enviar um template Meta de teste, aguardar ~3h, responder "Sim", e confirmar via `supabase--edge_function_logs whatsapp-webhook` que a Maya processa como continuação (e não chama tools como "mensagem fria").

# Arquivos afetados

- `supabase/functions/whatsapp-send-text/index.ts` — 2 inserts (retry e principal) para gravar `tipo: "template"` quando há `templateName`
- `supabase/functions/whatsapp-webhook/index.ts` — alterar `duasHorasAtras` (linha 1860) para janela de 24h e renomear variável

# Fora de escopo

- Não alterar `chatwoot-webhook`, hooks de frontend, ou templates específicos.
- Não tocar nos inserts que já gravam `tipo: "template"` corretamente (disparar-cobranca-csv-meta, enviar-lembretes-vencimento etc.).
- Não alterar o system prompt da Maya — a regra de continuidade de templates já existe e funciona quando o histórico chega marcado corretamente.
