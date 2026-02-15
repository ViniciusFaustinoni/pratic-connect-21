

# Corrigir IA WhatsApp: Distinguir Eventos Novos de Finalizados

## Problema

Quando o associado reporta um novo sinistro pelo WhatsApp apos o anterior ter sido finalizado, a IA confunde com o evento anterior. Isso acontece por 3 causas:

1. **Historico de conversa carrega contexto antigo**: A funcao `getConversationHistory` busca as ultimas 10 mensagens sem filtro de tempo. Se as 10 ultimas mensagens sao sobre o sinistro anterior (colisao na Estrada do Rio Grande), a IA interpreta a nova mensagem "Bati de carro" como continuacao daquela conversa.

2. **Query de sinistros no contexto inclui status intermediarios**: O filtro `.not("status", "in", "(finalizado,encerrado,cancelado)")` exclui apenas 3 status terminais. Mas status como `aprovado`, `reprovado`, `indenizado`, `aguardando_analise`, `em_oficina`, `em_reparo`, `aguardando_pagamento` sao todos intermediarios que NAO devem aparecer como "em andamento" para efeito de "posso abrir um novo?".

3. **System prompt nao orienta sobre distinguir eventos novos vs existentes**: A IA nao recebe instrucao para verificar se o associado esta falando de um evento novo ou se e continuacao de um existente.

## Solucao

### Mudanca 1 — Limitar historico por tempo (WhatsApp)

Adicionar filtro de tempo no `getConversationHistory` para buscar apenas mensagens das ultimas 2 horas. Se o associado volta no dia seguinte, a conversa comeca "limpa" sem contexto de sinistros anteriores.

**Arquivo**: `supabase/functions/whatsapp-webhook/index.ts` (funcao `getConversationHistory`, linha ~1517)

### Mudanca 2 — Expandir status terminais no contexto

Separar sinistros em 2 categorias no contexto:
- **Em andamento** (status: comunicado, em_analise, documentacao_pendente, em_regulacao, aguardando_analise)
- **Ja finalizados** (todos os outros: aprovado, reprovado, encerrado, finalizado, cancelado, indenizado, em_oficina, etc.)

Alterar a query para mostrar apenas sinistros REALMENTE em andamento. Adicionar informacao sobre sinistros recentes finalizados para referencia.

**Arquivo**: `supabase/functions/whatsapp-webhook/index.ts` (funcao `getAssociadoContext`, linha ~1421)

### Mudanca 3 — Adicionar instrucao no System Prompt

Adicionar ao `WHATSAPP_SYSTEM_PROMPT` uma regra clara:

```
## EVENTOS NOVOS vs EXISTENTES
- Se o contexto mostra "Nenhum sinistro em aberto" e o associado relata um novo acidente, TRATE COMO NOVO SINISTRO
- NAO assuma que e continuacao de um evento anterior ja finalizado
- Se houver sinistro em andamento E o associado relatar novo evento, pergunte: "Vi que voce ja tem um sinistro em andamento (protocolo X). Esse e um novo evento ou e sobre o mesmo?"
- Eventos com status finalizado/encerrado/aprovado/indenizado JA FORAM RESOLVIDOS — ignore-os para novas solicitacoes
```

**Arquivo**: `supabase/functions/whatsapp-webhook/index.ts` (constante `WHATSAPP_SYSTEM_PROMPT`, linha ~258)

### Mudanca 4 — Verificacao de duplicata na tool criar_solicitacao_sinistro

Adicionar verificacao antes de criar nova solicitacao: se ja existe solicitacao pendente (status='pendente') para o mesmo associado, avisar. Se a ultima solicitacao ja foi aprovada/rejeitada, permitir criar nova.

**Arquivo**: `supabase/functions/whatsapp-webhook/index.ts` (case `criar_solicitacao_sinistro`, linha ~757)

### Mudanca 5 — Aplicar mesma correcao no assistente do App

O `assistente-chat/index.ts` tem o mesmo problema na query de sinistros (linha 748-753). Aplicar a mesma expansao de status terminais.

**Arquivo**: `supabase/functions/assistente-chat/index.ts` (linha ~748)

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/whatsapp-webhook/index.ts` | Historico com filtro de tempo, contexto com status refinado, system prompt com regra de eventos novos, verificacao de duplicata na tool |
| `supabase/functions/assistente-chat/index.ts` | Query de sinistros com status terminais expandidos |

---

## Detalhes Tecnicos

**Historico com filtro de tempo:**
```typescript
// Antes: sem filtro de tempo
.limit(10);

// Depois: ultimas 2 horas apenas
const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
.gte("created_at", duasHorasAtras)
.limit(10);
```

**Status terminais expandidos:**
```typescript
// Antes:
.not("status", "in", "(finalizado,encerrado,cancelado)")

// Depois - status REALMENTE em andamento:
.in("status", ["comunicado", "em_analise", "documentacao_pendente", "em_regulacao", "aguardando_analise"])
```

**Verificacao de duplicata na tool:**
```typescript
// Verificar se ja existe solicitacao pendente
const { data: solicitacaoPendente } = await supabase
  .from("chat_solicitacoes_ia")
  .select("id, created_at")
  .eq("associado_id", associadoId)
  .eq("tipo", "sinistro")
  .eq("status", "pendente")
  .limit(1)
  .maybeSingle();

if (solicitacaoPendente) {
  return JSON.stringify({
    sucesso: false,
    message: "Voce ja tem uma solicitacao de sinistro pendente de analise. Aguarde a resposta da diretoria."
  });
}
```

