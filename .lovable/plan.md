## Diagnóstico

A tela em anexo ("Link liberado — continue sua contratação") é o **estado de boas-vindas** do `TelaAnaliseTrocaTitularidade.tsx` (linhas 35-39):

```ts
} else if (status === 'cotacao_em_andamento' && termoAssinadoEm) {
  title = 'Link liberado — continue sua contratação';
  showContinuarCTA = true;  // botão recarrega a página
}
```

Ela só faz sentido **antes** do novo titular começar — convidando-o a entrar no link público para escolher plano, enviar docs, etc.

### Por que a COT‑20260520-151115073-803 cai aqui

Estado real no banco:
- `cotacoes.status_contratacao = 'pagamento_ok'`
- `cotacoes.plano_escolhido_id` preenchido
- `contratos.status = 'assinado'`
- `solicitacoes_troca_titularidade.status = 'cotacao_em_andamento'` ← **deveria ser `aguardando_cadastro`**
- `termo_cancelamento_assinado_em` preenchido

O usuário **fez tudo**: plano, docs, contrato, pagamento. Mas a solicitação nunca migrou para `aguardando_cadastro` porque a trigger `fn_troca_promove_cadastro_via_cotacao` (`AFTER UPDATE OF status_contratacao ON cotacoes`) só dispara quando o status_contratacao vira **exatamente** `aguardando_aprovacao_cadastro`:

```sql
IF NEW.status_contratacao IS DISTINCT FROM 'aguardando_aprovacao_cadastro' THEN
  RETURN NEW;
END IF;
```

No fluxo dessa cotação (FIPE acima, sem autovistoria opcional, sem instalação ainda agendada após pagamento), o `recompute_cotacao_status_contratacao` saltou direto para `pagamento_ok`/`contrato_gerado` sem passar por `aguardando_aprovacao_cadastro`. Resultado: a trigger nunca rodou; a solicitação ficou eternamente em `cotacao_em_andamento`; o componente renderiza o convite "Link liberado" com botão `Continuar contratação` que recarrega a página em loop.

## Correção (3 frentes)

### 1. Trigger DB — promover em qualquer status pós-fluxo do cliente

Migration recriando `fn_troca_promove_cadastro_via_cotacao` para promover quando `status_contratacao` ∈ {`aguardando_aprovacao_cadastro`, `pagamento_ok`, `contrato_gerado`, `aguardando_aprovacao_monitoramento`}. Mantém idempotência (`WHERE status = 'cotacao_em_andamento'`) e o gate `origem_troca_titularidade = true`.

```sql
IF NEW.status_contratacao IS NULL
   OR NEW.status_contratacao NOT IN (
     'aguardando_aprovacao_cadastro',
     'pagamento_ok',
     'contrato_gerado',
     'aguardando_aprovacao_monitoramento'
   ) THEN
  RETURN NEW;
END IF;
IF OLD.status_contratacao IS NOT DISTINCT FROM NEW.status_contratacao THEN
  RETURN NEW;
END IF;
```

### 2. Backfill da solicitação travada

```sql
UPDATE solicitacoes_troca_titularidade
SET status = 'aguardando_cadastro', updated_at = now()
WHERE id = 'da35dfbd-5dc5-4df6-95aa-dac017d40546'
  AND status = 'cotacao_em_andamento';
```

Junto, varrer todas as solicitações no mesmo limbo (cotação vinculada já em `pagamento_ok`/`contrato_gerado` e solicitação em `cotacao_em_andamento`) para corrigir outros casos.

### 3. UI defensiva (presentation)

Em `src/pages/public/CotacaoContratacao.tsx`, no branch novo da etapa 5 (Troca), aplicar **override** ao status passado para `TelaAnaliseTrocaTitularidade` enquanto a trigger não rodou:

```ts
const statusEfetivoTroca =
  (solicitacaoTroca?.status === 'cotacao_em_andamento' &&
   ['pagamento_ok','contrato_gerado','aguardando_aprovacao_monitoramento'].includes(
     cotacao?.status_contratacao || ''
   ))
    ? 'aguardando_cadastro'
    : (solicitacaoTroca?.status as any) || 'aguardando_cadastro';
```

Assim, mesmo se a trigger atrasar ou um caso novo escapar, o cliente vê **"Em análise pelo Cadastro"** em vez do convite "Link liberado".

## Validação

1. Recarregar a COT‑20260520-151115073-803 → tela "Em análise pelo Cadastro" (não mais "Link liberado").
2. SQL: `SELECT status FROM solicitacoes_troca_titularidade WHERE id='da35dfbd-…';` → `aguardando_cadastro`.
3. Nova troca completa: fluxo termina em `pagamento_ok` → trigger promove → cliente vê acompanhamento.
4. Fila do Cadastro → solicitação aparece pronta para análise manual.
5. Cotação comum (não-troca) → trigger ignora (gate `origem_troca_titularidade=true`).

## Arquivos

- **Nova migration** em `supabase/migrations/` — recria `fn_troca_promove_cadastro_via_cotacao` + UPDATE de backfill.
- `src/pages/public/CotacaoContratacao.tsx` — override defensivo do `status` passado para `TelaAnaliseTrocaTitularidade`.

## Memória a atualizar

`mem://logic/operations/troca-titularidade-promocao-cadastro-canonica` — registrar que a promoção `cotacao_em_andamento → aguardando_cadastro` agora acontece em qualquer transição pós-fluxo do cliente (`aguardando_aprovacao_cadastro`, `pagamento_ok`, `contrato_gerado`, `aguardando_aprovacao_monitoramento`), e que a UI tem fallback defensivo se a trigger atrasar.
