

## Correção SGA Hinova — Sincronização Falhando — ✅ Implementado

### Causas Raiz Identificadas
1. **`return new Response(...)` dentro de `doBackgroundSync`** — Responses descartadas silenciosamente (background closure, não handler HTTP)
2. **Loop infinito de CPF duplicado** — CPF existe no Hinova mas busca retorna 404/406, gerando retry infinito
3. **Código associado inválido em cascata** — códigos de outra conta Hinova causam falha no cadastro de veículo

### Correções Aplicadas

1. **`sga-hinova-sync/index.ts`**:
   - Substituídos 11 `return new Response(...)` por `return;` dentro de `doBackgroundSync`
   - Adicionado **guard de loop infinito** no início do background: se 3+ falhas consecutivas de CPF duplicado, marca como `falha_permanente` e para de retentar

2. **`cron-sga-retry/index.ts`**:
   - Adicionada **detecção de loops** antes de reprocessar: se 5+ tentativas com mesmo padrão de erro (CPF duplicado, "não aceitável"), marca como `falha_permanente` e pula o item
