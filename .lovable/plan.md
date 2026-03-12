

# Diagnóstico: Atribuição Automática de Tarefas

## Estado Atual — O que funciona

A auditoria mostra que o sistema de atribuição **funciona**, mas com **atraso**:

```text
Fluxo atual:
Aprovação → criar-instalacao-pos-pagamento → INSERT instalacoes
  → trigger sync_instalacao_to_servicos → INSERT servicos
  → ... aguarda até 5 min ...
  → cron-atribuir-tarefas (*/5 * * * *) → encontra servico → atribui ao profissional

Exemplo real de hoje:
  15:46:42 - Instalação criada
  15:55:00 - Cron rodou e atribuiu (9 min de espera)
```

A tarefa de hoje (id `2884e1f1`) **foi atribuída** ao profissional `[TESTE] Vistoriador` pelo cron às 15:55. A aba "Hoje (0)" no screenshot mostra tarefas **concluídas**, não pendentes — a tarefa ativa aparece na aba "Atual".

## Problemas Identificados

### 1. Sem atribuição imediata após aprovação
`criar-instalacao-pos-pagamento` cria a instalação mas **não dispara a atribuição**. O profissional espera até 5 min (próximo ciclo do cron).

### 2. `processar-encaixes-automaticos` não tem cron job
A edge function existe mas **nunca é chamada automaticamente** — não há entrada em `cron.job` para ela. Os encaixes futuros dependem do `cron-atribuir-tarefas` que já tem lógica de encaixe embutida, mas a função dedicada está ociosa.

### 3. Instalações sem coordenadas ficam invisíveis
A instalação de 01/03 (id `025905ca`) tem `latitude: NULL, longitude: NULL` — ambos os crons filtram `NOT latitude IS NULL`, tornando-a impossível de atribuir.

## Plano de Correção

### Correção 1: Disparo imediato após criar instalação
Em `criar-instalacao-pos-pagamento/index.ts`, após criar a instalação com sucesso (linha ~389), invocar `cron-atribuir-tarefas` imediatamente:

```typescript
// Após criar instalação com sucesso, disparar atribuição imediata
try {
  await fetch(`${supabaseUrl}/functions/v1/cron-atribuir-tarefas`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  console.log('[CriarInstalacaoPosPagamento] ✓ Atribuição automática disparada');
} catch (e) {
  console.warn('[CriarInstalacaoPosPagamento] Atribuição imediata falhou (será tentada no próximo cron):', e);
}
```

Isso reduz o tempo de atribuição de **até 5 min** para **segundos** após a aprovação.

### Correção 2: Agendar cron para `processar-encaixes-automaticos`
Criar cron job rodando a cada 10 minutos para processar encaixes futuros que podem ser antecipados:

```sql
SELECT cron.schedule(
  'processar-encaixes-automaticos',
  '*/10 * * * *',
  $$ SELECT net.http_post(...) $$
);
```

### Resumo de alterações
- **1 arquivo**: `supabase/functions/criar-instalacao-pos-pagamento/index.ts` — adicionar chamada imediata ao `cron-atribuir-tarefas`
- **1 SQL**: Agendar cron para `processar-encaixes-automaticos`
- **Redeploy**: `criar-instalacao-pos-pagamento`

