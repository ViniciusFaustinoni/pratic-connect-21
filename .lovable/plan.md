

## Sincronização Financeira da Base Antiga via API SGA Hinova

### Resposta direta

**Sim, é totalmente possível.** A API SGA v2 (`https://api.hinova.com.br/api/sga/v2/`) expõe exatamente os dois endpoints necessários:

| Endpoint | O que retorna |
|---|---|
| `GET /buscar/situacao-financeira-veiculo/:codigo_ou_placa` | Status global do veículo: `ADIMPLENTE` / `INADIMPLENTE` |
| `POST /listar/boleto-associado-veiculo` | Lista completa de boletos do veículo: pagos, em aberto, vencidos, a vencer — com valor, multa, mora, dias vencidos, data emissão/vencimento/pagamento, situação, nosso_número, linha digitável, taxas detalhadas |

Outros endpoints suporte: `GET /buscar/boleto/:nosso_numero` (detalhe individual), `GET /listar/situacao-boleto/:situacao` (mapa de códigos de situação → ABERTO/BAIXADO/CANCELADO/etc).

### Estado atual no sistema

- `associados` com `codigo_hinova` preenchido: **9.506 / 9.537** (99,7%)
- `veiculos` com `codigo_hinova` preenchido: **9 / 9.662** (0,1%) — gargalo
- Tabela `cobrancas` já existe com todos os campos necessários (`nosso_numero`, `valor_final`, `multa`, `juros`, `data_vencimento`, `data_pagamento`, `status`, `linha_digitavel`, `boleto_url`, etc) — está **vazia (0 registros)**
- Edge functions Hinova já existem: `sga-hinova-sync`, `sga-verificar-veiculo`, `cron-sga-retry`, `cron-sga-health-check` — autenticação, credenciais e rate limiting já resolvidos

### Estratégia em 3 fases

```text
FASE 1 — Mapear codigo_hinova nos 9.653 veículos faltantes
   │ Para cada veículo da base antiga sem codigo_hinova:
   │   GET /veiculo/buscar/{placa}/placa  (já implementado em sga-verificar-veiculo)
   │   → preenche veiculos.codigo_hinova
   ▼
FASE 2 — Backfill financeiro inicial (one-shot por veículo)
   │ Para cada veículo com codigo_hinova:
   │   1) GET /buscar/situacao-financeira-veiculo/{codigo}
   │      → atualiza veiculos.situacao_financeira_sga ('ADIMPLENTE'/'INADIMPLENTE')
   │   2) POST /listar/boleto-associado-veiculo
   │      body: {codigo_associado, codigo_veiculo}
   │      → upsert em cobrancas (chave única: nosso_numero)
   ▼
FASE 3 — Sincronização recorrente (cron diário + on-demand)
   │ Cron diário 02:00: re-sync de todos os veículos base antiga
   │ Botão "Atualizar financeiro" no detalhe do veículo (on-demand)
   │ Webhook hipotético da Hinova (se disponível) — fallback no cron
```

### Mudanças no banco

**Tabela `cobrancas`** — adicionar:
- `origem` enum `'sistema' | 'sga_hinova'` (default `sistema`) para distinguir cobranças nativas vs importadas
- `codigo_situacao_boleto_hinova` int — código bruto da Hinova (mapeamento via `listar/situacao-boleto`)
- `tipo_boleto_hinova` text — ex: `FECHAMENTO`, `MENSALIDADE`, `TAXA`
- `dados_brutos_sga` jsonb — payload completo do boleto Hinova (auditoria + futuros campos)
- `sincronizado_sga_em` timestamptz
- UNIQUE constraint em `(nosso_numero)` quando `nosso_numero IS NOT NULL` para idempotência do upsert
- Índice em `(veiculo_id, status, data_vencimento)` para queries de inadimplência

**Tabela `veiculos`** — adicionar:
- `situacao_financeira_sga` text — `ADIMPLENTE` / `INADIMPLENTE` / `null`
- `situacao_financeira_sga_em` timestamptz
- `total_aberto_sga` numeric — soma de cobranças abertas (cache p/ listagem)
- `total_vencido_sga` numeric

**Nova tabela `sga_sync_financeiro_jobs`** (controle do backfill):
- `id`, `veiculo_id`, `tipo` (`mapear_codigo` | `backfill_inicial` | `resync`), `status` (`pendente` | `executando` | `concluido` | `erro`), `tentativas`, `ultimo_erro`, `boletos_importados`, `iniciado_em`, `concluido_em`

### Edge Functions

| Função | Responsabilidade |
|---|---|
| `sga-mapear-codigos-veiculos` (nova) | Worker em batch: lê veículos sem `codigo_hinova`, busca por placa, atualiza. Processa N por execução (rate-limit safe) |
| `sga-sync-financeiro-veiculo` (nova) | Para um único veículo: chama os 2 endpoints, faz upsert em `cobrancas`, atualiza totais em `veiculos`. Reusável para on-demand e cron |
| `sga-backfill-financeiro` (nova) | Orquestrador: enfileira todos os veículos elegíveis em `sga_sync_financeiro_jobs` e dispara workers paralelos com throttling (ex: 5 req/s) |
| `cron-sga-sync-financeiro-diario` (nova, pg_cron 02:00) | Re-sincroniza todos os veículos da base antiga diariamente |
| `sga-hinova-sync` (existente) | Inalterada — continua sincronizando cadastros para o SGA |

### Frontend (mínimo)

1. **`/cadastro/base-antiga`** — adicionar:
   - Botão "Sincronizar Financeiro (Backfill)" no header → dispara `sga-backfill-financeiro` e mostra progresso
   - Coluna nova: "Situação SGA" (ADIMPLENTE/INADIMPLENTE/—) na aba Veículos
   - No drawer de detalhe do veículo: aba **"Financeiro SGA"** com lista de boletos (status, vencimento, valor, multa/mora, link), filtros, e botão "Atualizar agora"
2. **Tela de progresso do backfill** (modal ou rota `/cadastro/base-antiga/sync`): contadores live de `sga_sync_financeiro_jobs` (pendente/executando/concluído/erro), gráfico, lista de erros para retry manual

### Mapeamento de campos (Hinova → cobrancas)

| Hinova | cobrancas |
|---|---|
| `nosso_numero` | `nosso_numero` (chave única) |
| `valor_boleto` | `valor` |
| `valor_boleto_multa_mora` | `valor_final` |
| `valor_multa` | `multa` |
| `valor_mora` | `juros` |
| `data_emissao` | `data_emissao` |
| `data_vencimento` | `data_vencimento` |
| `data_vencimento_original` | (novo: `data_vencimento_original`) |
| `data_pagamento` | `data_pagamento` |
| `linha_digitavel` | `linha_digitavel` |
| `situacao_boleto` (texto) | `status` mapeado: `ABERTO`→`aguardando_pagamento`, `BAIXADO`→`pago`, `VENCIDO`→`vencido`, `CANCELADO`→`cancelado` |
| `mes_referente` | `referencia_mes` + `referencia_ano` |
| `tipo_boleto` | `tipo_boleto_hinova` |
| objeto completo | `dados_brutos_sga` (jsonb) |
| — | `origem = 'sga_hinova'` |

### Ordem de execução

1. Migração de schema (cobrancas + veiculos + jobs + índices)
2. Edge function `sga-sync-financeiro-veiculo` (unidade reutilizável) + testes
3. Edge function `sga-mapear-codigos-veiculos` (resolve gap de 9.653 veículos)
4. Edge function `sga-backfill-financeiro` (orquestrador com fila)
5. UI: botão de backfill + tela de progresso
6. UI: aba "Financeiro SGA" no detalhe do veículo + botão "Atualizar agora"
7. Cron diário + monitoramento

### Custos / riscos

- **Volume de chamadas inicial**: ~9.650 chamadas para mapear códigos + ~9.650 × 2 chamadas para backfill = **~30k requests**. Com throttling de 5 req/s → ~1h40min de processamento total. Executado em background, sem impacto no usuário.
- **Rate limit Hinova**: usar a mesma estratégia já provada em `sga-hinova-sync` (retry exponencial, fila, `cron-sga-retry`).
- **Veículos sem match por placa no SGA**: ficam marcados em `sga_sync_financeiro_jobs` como `erro` com motivo, exibidos na tela de progresso para revisão manual.
- **Idempotência**: upsert por `nosso_numero` garante que rodar múltiplas vezes não duplica.

### Fora de escopo

- Geração de novos boletos via API Hinova (`POST /boleto/cadastrar`) — só leitura
- Sincronização inversa (sistema → Hinova) de pagamentos feitos no app
- Webhook receptor da Hinova (não consta na doc; usar polling diário)
- Backfill de associados sem `codigo_hinova` (apenas 31 casos — manual)

### Critérios de aceitação

1. Após backfill, todos os 9.662 veículos da base antiga têm `codigo_hinova` preenchido (ou marcados como erro com motivo)
2. Tabela `cobrancas` populada com todos os boletos históricos retornados pela Hinova, sem duplicatas
3. `veiculos.situacao_financeira_sga` reflete o status retornado pelo endpoint específico
4. `veiculos.total_aberto_sga` / `total_vencido_sga` calculados corretamente
5. Drawer do veículo mostra todos os boletos (pagos, em aberto, vencidos, a vencer) com link para 2ª via
6. Cron diário roda às 02:00 atualizando os dados
7. Botão "Atualizar agora" no detalhe do veículo refaz a sync individual em <5s
8. Hook `useVerificarDebitosAssociado` passa a refletir também os débitos vindos do SGA

