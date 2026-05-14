## Diagnóstico de duplicidade por `linha_digitavel`

Rodei a contagem nas duas fontes do dashboard unificado:

| Fonte | Total | Linhas digitáveis válidas (numéricas) | Duplicadas reais |
|---|---:|---:|---:|
| `cobranca_csv_boletos` (CSV SGA) | 39.442 | 39.442 | **0** |
| `cobrancas` (Asaas + backfill SGA) | 141.458 | 941 | **0** |
| Interseção CSV × cobrancas | — | — | **1** |

### Por que `cobrancas` parecia ter 140k duplicados

A coluna `linha_digitavel` em `cobrancas` está preenchida com **mensagens de erro do SGA** (não com a linha real) em 140.517 registros:

- 138.349 com texto `"Não foi possível disponibilizar esta informação pois o boleto se encontra na situação BAIXADO"`
- 1.925 com `"...EXCLUIDO"`
- 243 com `"...CANCELADO"`

Cada uma dessas linhas é um **boleto distinto** (id, associado, vencimento, valor próprios) — só compartilham o placeholder textual. **Não são duplicatas** e não devem ser apagadas: representam todo o histórico financeiro pago/cancelado vindo do `sga-backfill-financeiro`.

### Único cruzamento real

Apenas 1 boleto (`linha_digitavel: 34191.09743 79236.220939 75008.900005 1 14220000022290`) aparece nas duas fontes:

- CSV: `1d526413-...` — sem `associado_id`, sem `data_vencimento`, valor R$ 222,90
- cobrancas: `b5df203f-...` — associado `8ac25a4d-...`, vencimento 2026-04-20, status `aguardando_pagamento`, valor R$ 222,90

Provavelmente o mesmo boleto registrado pelas duas vias.

## Opções

Como **não há duplicidade real para remover**, deixo as opções abertas — escolha o que faz sentido:

1. **Não fazer nada** — o dashboard unificado já funciona. O placeholder textual é histórico legítimo do SGA.
2. **Limpar o placeholder de `cobrancas.linha_digitavel`** — fazer `UPDATE cobrancas SET linha_digitavel = NULL WHERE linha_digitavel LIKE 'Não foi possível%'` (140.517 linhas). Mantém os registros, só remove o lixo textual da coluna. Recomendado para higiene.
3. **Dedup automático no dashboard** — na view `cobrancas_unificadas`, suprimir linhas do CSV cujo `linha_digitavel` já existe em `cobrancas` com linha real (afeta hoje só aquele 1 boleto, mas previne crescimento futuro).
4. **Resolver os 2 registros do boleto comum** — apagar o lado CSV (sem associado/vencimento) e manter o de `cobrancas` (mais completo).

Diga qual caminho seguir (pode combinar 2 + 3 + 4) que abro o plano de execução.
