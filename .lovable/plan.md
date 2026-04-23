

## Reconciliar `veiculos.codigo_hinova` em massa via CPF (sem tocar Hinova por veículo, sem mudar frontend)

### Diagnóstico

| Métrica | Valor |
|---|---|
| Associados base antiga | 9.495 |
| ↳ **com `codigo_hinova` preenchido** | **9.495 (100%)** ✅ |
| Veículos base antiga | 9.623 |
| ↳ com `codigo_hinova` preenchido | 4.624 |
| ↳ **sem `codigo_hinova` (mas com placa)** | **4.999** ❌ |
| Associados únicos a consultar (cobre os 4.999 veículos) | **4.678** |

A boa notícia: como **todo associado já tem código**, o endpoint `GET /associado/buscar/{cpf}/cpf` da Hinova retorna no mesmo payload **a lista de veículos com `codigo_veiculo` + `placa`**. Já é usado em `sga-hinova-sync/index.ts` linha 1392 como "Estratégia 2". Logo: **1 chamada por associado resolve N veículos dele**, em vez de 1 chamada por veículo.

Total: ~4.700 chamadas (não 4.999). E elas atacam só o gargalo do `veiculos.codigo_hinova` — depois disso a `sga-sync-financeiro-veiculo` (que é por-veículo) tem o vínculo certo e pode fazer o trabalho dela.

### Mudanças (somente backend, **sem frontend**)

**A. Nova edge function `sga-reconciliar-codigo-veiculo`**

Em `supabase/functions/sga-reconciliar-codigo-veiculo/index.ts`. Aceita `{ acao: 'enfileirar' | 'processar', batch_size?: number, delay_ms?: number, limit?: number }`.

Fluxo:

1. **`enfileirar`** — popula nova tabela `sga_reconciliacao_veiculo_jobs` com 1 linha por associado pendente:
   ```sql
   SELECT DISTINCT v.associado_id, a.cpf, a.codigo_hinova
   FROM veiculos v JOIN associados a ON a.id=v.associado_id
   WHERE a.origem_cadastro='api_externa'
     AND v.codigo_hinova IS NULL AND v.placa IS NOT NULL
     AND a.cpf IS NOT NULL AND a.codigo_hinova IS NOT NULL
   ```
   Esperado: ~4.678 jobs.

2. **`processar`** — para cada job pendente:
   - `GET {hinovaApiUrl}/associado/buscar/{cpfLimpo}/cpf` (com fallback CPF formatado, igual ao código existente).
   - Se retornar `veiculos[]`, para cada `{placa, codigo_veiculo}` faz:
     ```sql
     UPDATE veiculos SET codigo_hinova = $codigo, sincronizado_hinova = true,
       sincronizado_hinova_em = now()
     WHERE associado_id = $aid AND placa = $placa AND codigo_hinova IS NULL
     ```
   - Marca o job como `concluido` + grava `veiculos_resolvidos` no payload.
   - Trata `HinovaTransientError` (401/janela horária/5xx) → `pendente_retry` + `proximo_retry_em` (mesma política da régua financeira).
   - Trata 404 real → `nao_encontrado_hinova`.
   - Throttle: `delay_ms` (default 100ms) entre chamadas. Reusa `getHinovaCreds`/`autenticarHinova` do `_shared/hinova-client.ts`.

3. **Idempotente:** o `WHERE codigo_hinova IS NULL` no UPDATE garante que reexecuções não sobrescrevem códigos já corretos.

**B. Adicionar helper `buscarAssociadoComVeiculosPorCpf` em `_shared/hinova-client.ts`**

Wrapper que chama `/associado/buscar/{cpf}/cpf` (com retry no formato), parseia retorno e devolve `{ codigo_associado, veiculos: [{placa, codigo_veiculo}] }`. Usa `HinovaTransientError`/`HinovaNotFoundError` já existentes para classificar erros corretamente (mesma lógica robusta da iteração anterior).

**C. Migration mínima — nova tabela de fila**

```sql
CREATE TABLE public.sga_reconciliacao_veiculo_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id uuid NOT NULL REFERENCES associados(id) ON DELETE CASCADE,
  cpf text NOT NULL,
  codigo_hinova_associado integer NOT NULL,
  status text NOT NULL DEFAULT 'pendente',  -- pendente | concluido | nao_encontrado_hinova | pendente_retry | erro
  proximo_retry_em timestamptz NULL,
  veiculos_resolvidos integer NULL DEFAULT 0,
  ultimo_erro text NULL,
  tentativas integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (associado_id)
);
CREATE INDEX idx_recon_pendente ON sga_reconciliacao_veiculo_jobs(created_at) WHERE status='pendente';
CREATE INDEX idx_recon_retry ON sga_reconciliacao_veiculo_jobs(proximo_retry_em) WHERE status='pendente_retry';
ALTER TABLE sga_reconciliacao_veiculo_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON sga_reconciliacao_veiculo_jobs FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
```

**D. Cron `cron-sga-reconciliar-codigo-veiculo`**

Edge function que invoca `sga-reconciliar-codigo-veiculo` com `acao=processar`, `batch_size=80`. Agendado via `pg_cron` para rodar **2x ao dia dentro da janela comercial** (10h e 15h BRT) até a fila esvaziar. Depois pode ser desligado manualmente.

**E. Bonus operacional**

Após processar a fila, dispara automaticamente `sga-backfill-financeiro` com `acao=enfileirar` para que os 4.999 veículos (agora com código) entrem na fila de boletos da próxima execução do cron financeiro existente.

### O que NÃO muda

- Frontend (zero alterações em `.tsx`).
- `sga-sync-financeiro-veiculo` — já consome `veiculos.codigo_hinova`; vai funcionar automaticamente assim que reconciliação rodar.
- `sga-hinova-sync` — segue cuidando de novos cadastros.
- Schema de `veiculos`, `associados`, `cobrancas` — só dados.

### Validação (após implementação)

1. Login `admin@teste.com / 123456789` (consulta SQL via tool, não UI).
2. Disparar `acao=enfileirar` → conferir ~4.678 jobs `pendente`.
3. Disparar `acao=processar` em batches → acompanhar `concluido` crescendo e `veiculos_resolvidos` somando.
4. Query final: `SELECT COUNT(*) FROM veiculos v JOIN associados a ON a.id=v.associado_id WHERE a.origem_cadastro='api_externa' AND v.codigo_hinova IS NOT NULL` deve subir de 4.624 para ~9.000+.
5. Disparar `sga-backfill-financeiro` `acao=processar` → cobranças SGA começam a popular `cobrancas`.

### Riscos

- **CPF divergente entre local e Hinova** (~5–10% histórico): job vira `nao_encontrado_hinova`. Não bloqueia os outros. Esses casos viram backlog manual igual aos 2.852 atuais — política inalterada.
- **Veículo existe na Hinova com placa diferente** (renovação/troca): UPDATE casa por placa, então não matcha. Aceitável: melhor não-fazer-nada do que vincular código errado.
- **Janela horária**: mesma política `pendente_retry → 09h BRT seguinte` já implementada na régua financeira — reaproveitada via `calcularProximoRetry`.
- **Rate limit Hinova**: `delay_ms=100` + exponential backoff em 429 (já no client compartilhado).

