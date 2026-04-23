

## Histórico de pagamentos SGA — situação atual e plano

### Resposta direta

**Sim, é possível** e o sistema **já está parcialmente fazendo isso**, mas com 3 limitações que vou corrigir.

### O que já funciona

1. `listarBoletosVeiculo` (`POST /listar/boleto-associado-veiculo`) **retorna boletos em todos os status**: `aguardando_pagamento`, `vencido`, **`pago`** (BAIXA/LIQUIDA) e `cancelado`.
2. O sync `sga-sync-financeiro-veiculo` já persiste em `cobrancas` os campos: `status='pago'`, `data_pagamento`, `valor_pago` (quando vier no payload), `forma_pagamento`, `nosso_numero`, `tipo_boleto_hinova`, `dados_brutos_sga` (payload completo Hinova).
3. Upsert por `nosso_numero` é **idempotente** — pode rodar várias vezes sem duplicar.
4. Estado atual: 0 cobranças ainda porque a fila de reconciliação (4.663 jobs) não terminou de rodar. Conforme ela drenar, as cobranças (incluindo histórico de pagamentos) vão aparecer.

### Limitações reais que precisam ser endereçadas

**1. Janela retornada pela Hinova é limitada.** O endpoint `/listar/boleto-associado-veiculo` historicamente devolve só os últimos ~12 meses (mesma observação do código antigo em `sga-hinova-sync`). Boletos pagos mais antigos não vêm. Não há endpoint público v2 para "histórico completo" — está documentado em [api.hinova.com.br/api/sga/v2/doc](https://api.hinova.com.br/api/sga/v2/doc/) e o que existe é só esse listar.

**2. Campo `valor_pago` não está sendo persistido.** O upsert atual grava `valor` e `valor_final`, mas **não copia** `b.valor_pago_boleto` / `b.valor_recebido` quando o status é `pago`. Resultado: relatórios financeiros locais não conseguem distinguir o que foi pago do que era devido.

**3. Campo `forma_pagamento` também não está sendo persistido** apesar de a coluna existir e a Hinova retornar `b.forma_pagamento_boleto` / `b.tipo_pagamento`.

### Mudanças (somente backend, sem frontend)

**A. `supabase/functions/sga-sync-financeiro-veiculo/index.ts` (linhas 335–360) — completar o payload de pagamento**

Adicionar 2 campos no objeto `row` do upsert:
```ts
valor_pago: status === 'pago' 
  ? toNumber(b.valor_pago_boleto ?? b.valor_recebido ?? b.valor_pago ?? valorFinal) 
  : null,
forma_pagamento: status === 'pago' 
  ? (b.forma_pagamento_boleto ?? b.tipo_pagamento ?? b.forma_pagamento ?? null) 
  : null,
```

Mudança mínima, ~6 linhas. Boletos antigos que reentrarem no sync vão ser **atualizados** com esses dados (upsert por `nosso_numero`).

**B. Nova tabela `pagamentos_sga_historico` para preservar pagamentos antigos que sumirem da janela Hinova**

Como a Hinova só retorna ~12 meses, preciso de uma "memória local" para que pagamentos pagos há 2 anos não sumam de uma sincronização para outra. Nova tabela:

```sql
CREATE TABLE public.pagamentos_sga_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id uuid NOT NULL REFERENCES associados(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  nosso_numero text NOT NULL,
  status text NOT NULL,
  valor numeric NOT NULL,
  valor_pago numeric NULL,
  data_vencimento date NOT NULL,
  data_pagamento date NULL,
  forma_pagamento text NULL,
  tipo_boleto_hinova text NULL,
  mes_referencia text NULL,
  dados_brutos_sga jsonb NOT NULL,
  primeira_observacao_em timestamptz NOT NULL DEFAULT now(),
  ultima_observacao_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(nosso_numero)
);
CREATE INDEX idx_pag_sga_assoc ON pagamentos_sga_historico(associado_id, data_vencimento DESC);
CREATE INDEX idx_pag_sga_veic ON pagamentos_sga_historico(veiculo_id, data_vencimento DESC);
ALTER TABLE pagamentos_sga_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read" ON pagamentos_sga_historico FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_write" ON pagamentos_sga_historico FOR ALL USING (auth.jwt()->>'role'='service_role') WITH CHECK (auth.jwt()->>'role'='service_role');
```

**C. Trigger PostgreSQL para espelhar `cobrancas` SGA → `pagamentos_sga_historico`**

```sql
CREATE OR REPLACE FUNCTION mirror_cobranca_sga_to_historico() RETURNS trigger 
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.origem = 'sga_hinova' AND NEW.nosso_numero IS NOT NULL THEN
    INSERT INTO pagamentos_sga_historico (
      associado_id, veiculo_id, nosso_numero, status, valor, valor_pago,
      data_vencimento, data_pagamento, forma_pagamento, tipo_boleto_hinova,
      mes_referencia, dados_brutos_sga
    ) VALUES (
      NEW.associado_id, NEW.veiculo_id, NEW.nosso_numero, NEW.status, NEW.valor,
      NEW.valor_pago, NEW.data_vencimento, NEW.data_pagamento, NEW.forma_pagamento,
      NEW.tipo_boleto_hinova, NULLIF(split_part(NEW.descricao,' ',-1),''),
      NEW.dados_brutos_sga
    )
    ON CONFLICT (nosso_numero) DO UPDATE SET
      status = EXCLUDED.status,
      valor_pago = COALESCE(EXCLUDED.valor_pago, pagamentos_sga_historico.valor_pago),
      data_pagamento = COALESCE(EXCLUDED.data_pagamento, pagamentos_sga_historico.data_pagamento),
      forma_pagamento = COALESCE(EXCLUDED.forma_pagamento, pagamentos_sga_historico.forma_pagamento),
      dados_brutos_sga = EXCLUDED.dados_brutos_sga,
      ultima_observacao_em = now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_mirror_cobranca_sga AFTER INSERT OR UPDATE ON cobrancas
FOR EACH ROW EXECUTE FUNCTION mirror_cobranca_sga_to_historico();
```

Resultado: tudo que entra/atualiza em `cobrancas` com origem SGA fica preservado em `pagamentos_sga_historico` para sempre, mesmo que a Hinova pare de devolver. Sem código Deno extra.

**D. Backfill retroativo de cobranças existentes (uma vez só)**

Migration de inicialização:
```sql
INSERT INTO pagamentos_sga_historico (associado_id, veiculo_id, nosso_numero, status, valor, valor_pago, data_vencimento, data_pagamento, forma_pagamento, tipo_boleto_hinova, dados_brutos_sga)
SELECT associado_id, veiculo_id, nosso_numero, status, valor, valor_pago, data_vencimento, data_pagamento, forma_pagamento, tipo_boleto_hinova, dados_brutos_sga
FROM cobrancas WHERE origem='sga_hinova' AND nosso_numero IS NOT NULL
ON CONFLICT (nosso_numero) DO NOTHING;
```

Hoje retorna 0 linhas (cobranças SGA = 0), mas garante consistência quando a fila drenar.

### O que NÃO muda

- Frontend (zero alterações `.tsx`).
- Endpoints Hinova consumidos (mesmos).
- Tabela `cobrancas` schema (sem alteração).
- `sga-reconciliar-codigo-veiculo` em curso — continua processando; à medida que mapeia veículos, `sga-backfill-financeiro` vai puxar histórico de pagamento de cada um automaticamente.

### Validação (após implementação)

1. SQL: confirmar que `pagamentos_sga_historico` foi criada e o trigger está ativo.
2. Forçar sync de 1 veículo conhecido com pagamentos: `supabase.functions.invoke('sga-sync-financeiro-veiculo', { veiculo_id: '...' })`.
3. Query: `SELECT status, COUNT(*), SUM(valor_pago) FROM cobrancas WHERE origem='sga_hinova' GROUP BY status` — esperado `pago` > 0 com `valor_pago` populado.
4. Query: `SELECT COUNT(*) FROM pagamentos_sga_historico` — deve igualar a contagem em `cobrancas` SGA.
5. Após cron diário rodar (09h BRT), conferir crescimento de `pago` em ambas as tabelas.

### Riscos

- **Trigger em INSERT/UPDATE de `cobrancas`** adiciona ~1ms por linha. Em batches de 4.000 por execução do backfill, é negligenciável.
- **Hinova pode não devolver `valor_pago_boleto`** em todos os payloads. Fallback usa `valor_final`. Aceitável: dado parcial é melhor que dado nenhum.
- **Janela de 12 meses da Hinova é hard limit do parceiro** — não tem como pegar histórico anterior à primeira sync. A tabela `pagamentos_sga_historico` mitiga daqui pra frente, mas não recupera o passado pré-implementação. Mesmo assim, a primeira sync já vai trazer o último ano de cada veículo, o que cobre 90% dos casos de uso (régua de cobrança, status atual, último pagamento).

