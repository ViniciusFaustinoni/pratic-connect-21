## Diagnóstico

A Hinova **está retornando boletos** (22, 28, 30, 26... por veículo — confirmado em `sga_sync_logs`), mas **nenhum entra em `cobrancas`**. Causa raiz nos logs da Edge Function:

```
[SGA Sync Veículo] upsert falhou 234322
there is no unique or exclusion constraint matching the ON CONFLICT specification
```

A tabela `public.cobrancas` tem apenas a PK em `id`. O código em `sga-sync-financeiro-veiculo/index.ts:379` faz:
```ts
.upsert(row, { onConflict: 'nosso_numero' })
```
Sem UNIQUE em `nosso_numero`, o Postgres rejeita 100% dos upserts. O loop captura o erro com `console.error` + `continue`, então o job grava `boletos_importados=0` e marca `concluido` falsamente. Resultado: 78 jobs "concluídos", 0 cobranças importadas.

Há ainda dois problemas secundários:
1. Job marca `status='concluido'` baseado em `boletos.length > 0` (resposta da Hinova), e não em `importados > 0`. Logo, falhas de upsert ficam invisíveis na fila.
2. Os 78 jobs já marcados como concluído não serão reprocessados — precisam voltar para `pendente`.

## Correções

### 1. Migration: UNIQUE constraint em `cobrancas.nosso_numero`
- Antes do `ALTER TABLE`, deduplicar eventuais registros legados com mesmo `nosso_numero` (manter o mais recente por `created_at`).
- Tratar `nosso_numero` vazio/NULL como não-conflitante: criar `UNIQUE INDEX cobrancas_nosso_numero_uniq ON cobrancas(nosso_numero) WHERE nosso_numero IS NOT NULL AND nosso_numero <> ''`.
- Ajustar o `.upsert(..., { onConflict: 'nosso_numero' })` permanece válido com índice parcial único.

### 2. Reprocessar jobs falsos-concluídos
Mesma migration: `UPDATE sga_sync_financeiro_jobs SET status='pendente', boletos_importados=0, concluido_em=NULL, ultimo_erro=NULL, tentativas=0, proximo_retry_em=NULL WHERE status IN ('concluido','sem_historico_hinova') AND boletos_importados=0;` — assim os 78 + 2.852 voltam para a fila.

### 3. Endurecer `sga-sync-financeiro-veiculo/index.ts`
- Se `upErr` ocorrer, **não** apenas `continue` silenciosamente: acumular erros e, se houver qualquer falha de upsert, marcar o job como `pendente_retry` com `ultimo_erro` descritivo (em vez de `concluido`).
- Trocar a condição final de `boletos.length > 0 ? 'concluido' : 'sem_historico_hinova'` por: `importados > 0 ? 'concluido' : (boletos.length === 0 ? 'sem_historico_hinova' : 'pendente_retry')`.

### 4. Após deploy: clicar em "Forçar sync agora" novamente
A fila drena os 205k pendentes + os reprocessados, agora gravando de fato em `cobrancas`.

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — UNIQUE INDEX parcial + dedupe + reset de jobs.
- `supabase/functions/sga-sync-financeiro-veiculo/index.ts` — tratamento de erro de upsert + status final baseado em `importados`.

## Resultado esperado

- Próximos jobs gravam boletos em `cobrancas` (origem=`sga_hinova`).
- "Cobranças SGA importadas" no painel passa a refletir o real.
- Falhas de banco param de ser mascaradas como "concluído".
