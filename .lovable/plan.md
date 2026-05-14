## Objetivo

Fazer o dashboard `Financeiro › Cobranças` exibir, com KPIs e filtros completos, **tanto** as cobranças nativas (Asaas + backfill SGA via API → tabela `cobrancas`, ~141k linhas) **quanto** os boletos importados via CSV (tabela `cobranca_csv_boletos`, +39k linhas dos uploads recentes), sem migrar dados nem duplicar.

## Diagnóstico (já confirmado)

- `cobranca_csv_boletos` recebeu 39.374 linhas na última hora (ok, importação funcionou).
- `cobrancas` segue com 141.458 (138.349 pagas, 2.866 pendentes, 243 canceladas) — não recebeu nada do CSV.
- `useCobrancas` e `CobrancasList` consultam **só** `cobrancas`. Por isso o dashboard ignora o CSV.

## Solução escolhida — UNION via view

Criar uma view única que combina as duas fontes com schema canônico, e apontar o dashboard para ela.

### 1. Migração SQL — criar `cobrancas_unificadas`

View em `public.cobrancas_unificadas` (`security_invoker=on`), colunas canônicas:

| coluna | de `cobrancas` | de `cobranca_csv_boletos` |
|---|---|---|
| `id` | id | id |
| `fonte` | `'sistema'` | `'csv_sga'` |
| `origem` | `origem::text` (sistema/sga_hinova) | `'sga_hinova'` |
| `associado_id` | associado_id | associado_id |
| `veiculo_id` | veiculo_id | veiculo_id |
| `tipo` | tipo | `coalesce(tipo,'mensalidade')` |
| `status` | status (pago / aguardando_pagamento / vencido / cancelado) | mapeado: `status_origem ILIKE 'Pago%'`→`pago`; senão se `data_vencimento < today`→`vencido`; senão `aguardando_pagamento` |
| `valor_final` | valor_final | valor |
| `valor_pago` | valor_pago | valor (se pago) |
| `data_vencimento` | data_vencimento | data_vencimento |
| `data_pagamento` | data_pagamento | null |
| `referencia_mes`/`_ano` | nativos | extract de data_vencimento |
| `linha_digitavel` | linha_digitavel | linha_digitavel |
| `criado_em` | created_at | created_at |

Índices auxiliares em `cobranca_csv_boletos(data_vencimento)`, `(status_origem)`, `(associado_id)` para performance.

### 2. Hook `useCobrancas.ts`

- Substituir `.from('cobrancas')` por `.from('cobrancas_unificadas')` nas leituras (`cobrancasQuery`, `estatisticasQuery`, `useCobranca`, `useMinhasCobrancas`).
- Mutações de criar/registrar pagamento/cancelar **continuam** apontando para `cobrancas` (só linhas nativas são editáveis).
- Adicionar filtro novo opcional `fonte?: 'sistema' | 'csv_sga' | 'todas'`.

### 3. `CobrancasList.tsx`

- Paginação infinita: trocar `from('cobrancas')` (linha 323) para `from('cobrancas_unificadas')`.
- KPIs (Total / Pagas / Pendentes / Vencidas) passam a contar a view.
- Filtro de origem já existe (Asaas / SGA Hinova) — agregar opção "CSV SGA (lote importado)" usando o campo `fonte`.
- Linhas vindas do CSV: desabilitar ações de "Registrar pagamento" / "Cancelar" (mostrar tooltip "originado de CSV — somente leitura"), pois a fonte de verdade é o SGA externo.

### 4. Validação

Após a migração:
- Conferir `SELECT count(*) FROM cobrancas_unificadas` ≈ 180k.
- Conferir KPIs filtrando os 2 lotes recém-importados (data_vencimento dentro do range dos CSVs).
- Conferir que filtros de status funcionam para ambas as fontes.

## Detalhes técnicos relevantes

- Não migrar/copiar dados — view é viva, sem custo de manutenção.
- `cobranca_csv_boletos` pode ter múltiplas linhas para o mesmo boleto entre lotes (é gerenciado por `linha_digitavel` único). A view usa o `id` da linha mais recente — adicionar `DISTINCT ON (linha_digitavel) ... ORDER BY created_at DESC` se necessário (validar contagem após criar a view; ajustar se aparecer duplicação).
- Performance: a view filtra `WHERE recuperado_em IS NULL` em `cobranca_csv_boletos` para não inflar com boletos já marcados como pagos no SGA pós-lote anterior (esses entram pelo lado nativo `cobrancas` quando o `sga-backfill` rodar).
- View usa `security_invoker=on`; RLS de `cobrancas` e `cobranca_csv_boletos` continua valendo.

## Fora de escopo

- Não vamos rodar `sga-backfill-financeiro` agora (pode ser feito depois para enriquecer com data de pagamento real).
- Não vamos editar/excluir registros do CSV via dashboard nesta entrega.
