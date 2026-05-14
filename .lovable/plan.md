## Objetivo

Toda nova listagem CSV importada em **Régua › Emissão de Cobranças › Importar CSV (SGA)** deve **reconciliar a tabela canônica `cobrancas`**, refletindo:
- **Pagamentos**: boletos que estavam em aberto e sumiram do novo CSV → marcar como **pagos**.
- **Atrasos / atualizações**: boletos que continuam no novo CSV → atualizar `data_vencimento`, `valor`, `valor_final`, `linha_digitavel`, `link_fatura` se mudaram.
- **Novos boletos**: linhas do CSV que não existem em `cobrancas` → criar registros (`origem='sga_hinova'`, `status='aguardando_pagamento'`).

Hoje a reconciliação acontece **só no escopo `cobranca_csv_boletos`** (marca como `recuperado` / `reemitido`), mas **não toca em `cobrancas`** — então o painel financeiro não enxerga essas baixas.

## Plano

### 1. Edge Function nova: `reconciliar-csv-cobrancas`
Disparada uma única vez ao final do upload (no último chunk, junto com a promoção do lote para `ativo`). Recebe `lote_id`.

**Algoritmo (em transação por matrícula, em lotes de 500):**

```
Para cada matricula presente no novo lote (cobranca_csv_boletos.lote_id = X):
  1. Lê linhas_digitaveis_novas = set(boletos do CSV dessa matrícula)
  2. Lê cobrancas_abertas = SELECT * FROM cobrancas
        WHERE associado_id = (associado da matrícula)
          AND status = 'aguardando_pagamento'
          AND origem = 'sga_hinova'

  3. PAGAMENTOS: para cada cobranca_aberta cuja linha_digitavel
     NÃO está em linhas_digitaveis_novas:
        UPDATE cobrancas SET
          status = 'pago',
          data_pagamento = (data do CSV anterior ou hoje),
          valor_pago = valor_final,           -- não inflar
          forma_pagamento = 'baixa_csv_sga',
          updated_at = now()

  4. ATUALIZAÇÕES: para cada linha do CSV que JÁ existe em cobrancas
     (match por linha_digitavel):
        UPDATE cobrancas SET
          data_vencimento = csv.vencimento,
          valor = csv.valor,
          valor_final = csv.valor,
          link_fatura = csv.link,
          updated_at = now()
        WHERE status = 'aguardando_pagamento'

  5. NOVOS: para cada linha do CSV cuja linha_digitavel NÃO existe
     em cobrancas (do mesmo associado):
        INSERT INTO cobrancas (...)
        VALUES (origem='sga_hinova', status='aguardando_pagamento', ...)
```

### 2. Match de associado e veículo
Já existe em `cobranca_csv_boletos`: campos `associado_id`, `veiculo_id`, `match_origem`.
A reconciliação só roda nas linhas onde `associado_id IS NOT NULL` (skip silencioso para CSV sem match — registra count em `lote.observacao`).

### 3. Salvaguardas (lições aprendidas)
- **Não inflar `valor_pago`**: gravar exatamente `valor_final` (corrige o bug histórico que vimos).
- **Idempotência**: rodar `reconciliar-csv-cobrancas` 2× no mesmo lote não cria duplicatas — UPDATEs filtram por `status='aguardando_pagamento'` (já pago não muda) e INSERT usa `ON CONFLICT (linha_digitavel) DO NOTHING` (vou criar índice único parcial `WHERE linha_digitavel IS NOT NULL`).
- **Janela de proteção**: cobranças criadas há **menos de 24h** não são marcadas como pagas (pode ser CSV parcial). Marcar como pago só se `created_at < now() - 24h`.
- **Auditoria**: tabela nova `cobranca_reconciliacao_log` armazena `lote_id`, `cobranca_id`, `acao` (`pago_por_ausencia` / `atualizada` / `criada`), `valor`, `created_at` — para rastrear cada baixa e poder reverter se necessário.

### 4. UI de feedback
Após o upload, exibir card de resumo na tela:
- ✅ X cobranças marcadas como pagas (R$ Y)
- 🔄 Z cobranças atualizadas (vencimento/valor)
- ➕ N cobranças criadas
- ⚠️ M linhas sem match de associado (ignoradas)

Hoje já há contadores `recuperados_count` / `reemitidos_count` no card; os novos contadores são complementares e ficam em outro bloco (reconciliação ≠ comparação entre lotes CSV).

### 5. Migrations necessárias
- Criar tabela `cobranca_reconciliacao_log` com RLS (apenas funcionários veem).
- Criar índice único parcial em `cobrancas (linha_digitavel)` onde `linha_digitavel IS NOT NULL`.

### Fora do escopo
- Não recalcular `valor_pago` retroativamente.
- Não criar pagamentos no SGA Hinova (apenas reflete o que o SGA já confirmou via ausência no CSV).
- Não enviar mensagens — esta reconciliação é **muda** (não dispara WhatsApp).

## Decisões a confirmar
1. **Marcar como `pago` ou `baixado_por_csv`?** Recomendo `pago` (forma_pagamento='baixa_csv_sga') para o painel já mostrar como recebido. Alternativa: criar status novo `presumido_pago` se preferir.
2. **`valor_pago` = `valor_final` exato** (sem juros/multa)? Recomendo sim, para evitar repetir o bug de inflação.
3. **Janela de proteção 24h** está OK ou prefere outro valor (ex.: 48h, ou desabilitada)?

## Detalhes técnicos
- Arquivos: `supabase/functions/reconciliar-csv-cobrancas/index.ts` (novo), patch em `supabase/functions/disparar-cobranca-csv-meta/index.ts` (chamar a nova edge no `isLastChunk`), `src/components/financeiro/ImportarCobrancaCsv.tsx` (mostrar resumo).
- Migration: `cobranca_reconciliacao_log` + índice único parcial em `cobrancas.linha_digitavel`.
