

## Plano: Corrigir conversao de fuso horario no agente-consultor-ia

### Problema
A formula de conversao de fuso horario na linha 208 esta **invertida**. Em servidores UTC (onde `getTimezoneOffset()` retorna 0), o calculo resulta em:

```text
brasilia = agora + (0 - (-180)) * 60000
         = agora + 3 horas  (UTC+3, ERRADO)
```

O correto seria UTC-3. Entao as 12:17 BRT (15:17 UTC), o codigo calcula 18:17, que cai fora do horario comercial (08-18h), e a IA responde com a mensagem de fora de horario ao inves de processar a conversa.

### Correcao

**Arquivo: `supabase/functions/agente-consultor-ia/index.ts`** (linhas 205-208)

Substituir a formula complexa por calculo direto:

```typescript
const agora = new Date();
const brasilia = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
```

Remove as variaveis `brasiliaOffset` e `localOffset` que causam a inversao.

### Deploy
Redeployar a edge function `agente-consultor-ia`.

