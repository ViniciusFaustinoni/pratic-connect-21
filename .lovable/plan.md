

## Plano: Permitir atribuição automática de encaixes sem confirmação WhatsApp

### Problema
O motor de atribuição (`cron-atribuir-tarefas`) exige `confirmacao_whatsapp = 'confirmada'` para **todos** os serviços, incluindo encaixes. Encaixes são confirmados presencialmente, então ficam com `confirmacao_whatsapp = NULL` e nunca são atribuídos.

Além disso, nas linhas 579-650, existe lógica que tenta enviar confirmação WhatsApp para encaixes antes de atribuir — redundante se encaixes já estão confirmados presencialmente.

### Alterações

**Arquivo: `supabase/functions/cron-atribuir-tarefas/index.ts`**

1. **BUSCA 1 (serviços normais, linha ~335)**: Manter `.eq('confirmacao_whatsapp', 'confirmada')` — serviços normais continuam precisando de confirmação.

2. **BUSCA 2 (encaixes, linha ~372)**: Remover `.eq('confirmacao_whatsapp', 'confirmada')` e substituir por filtro que aceite `confirmada` OU `NULL`:
   ```
   .or('confirmacao_whatsapp.eq.confirmada,confirmacao_whatsapp.is.null')
   ```

3. **BUSCA 3 (sem coordenadas, linha ~395)**: Mesmo ajuste — aceitar encaixes sem confirmação:
   ```
   .or('confirmacao_whatsapp.eq.confirmada,confirmacao_whatsapp.is.null,permite_encaixe.eq.true')
   ```
   Ou separar em duas buscas. Abordagem mais simples: `.or('confirmacao_whatsapp.eq.confirmada,confirmacao_whatsapp.is.null')`.

4. **Bloco de confirmação WhatsApp para encaixes (linhas ~579-650)**: Remover toda a lógica que envia confirmação WhatsApp para encaixes e bloqueia atribuição. Encaixes passarão direto para atribuição como serviços normais confirmados.

### Não alterado
- Fluxo de confirmação WhatsApp para serviços normais (véspera + matinal)
- Lógica de geolocalização e priorização
- BUSCA 1 (serviços normais) — continua exigindo confirmação

### Resultado esperado
Encaixes com `confirmacao_whatsapp = NULL` serão incluídos nas buscas e atribuídos automaticamente ao profissional mais próximo, sem aguardar confirmação WhatsApp.

