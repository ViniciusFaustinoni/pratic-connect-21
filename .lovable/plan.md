

## Plano: Pontuação automática do consultor em todas as operações de venda

### Situação atual

| Operação | Pontua? | Onde |
|---|---|---|
| Nova adesão | ✅ | `asaas-webhook` (PAYMENT_RECEIVED) |
| Substituição de placa | ✅ parcial | `efetivar-substituicao` (sempre usa `pontos_substituicao_placa`, sem distinção integral/parcial) |
| Estorno (OVERDUE) | ✅ | `asaas-webhook` (PAYMENT_OVERDUE) |
| Migração aprovada | ❌ | — |
| Indicação convertida | ❌ | — |
| Reativação 120+ dias | ❌ | — |
| Troca de titularidade | ❌ | — |
| Distinção integral vs parcial (troca/substituição) | ❌ | — |
| Respeitar toggle `estorno_cancelamento_antes_1_boleto` | ❌ | Estorno é feito sempre, sem verificar parâmetro |

### Implementação

#### 1. `efetivar-substituicao/index.ts` — Distinção integral/parcial

No Step 12, antes de pontuar, verificar se a cobrança da taxa de substituição (`cobranca_taxa_asaas_id`) foi paga integralmente ou parcialmente. Buscar a cobrança no `asaas_cobrancas` e comparar `valor_pago` vs `valor`. Se integral → usar `pontos_substituicao_placa`; se parcial → usar `pontos_substituicao_placa_parcial`.

#### 2. `asaas-webhook/index.ts` — Reativação 120+ dias

No bloco onde o associado suspenso é reativado (linhas ~712-740, tolerância 0-5 dias), adicionar lógica:
- Buscar `prazo_reativacao_dias` de `comissoes_parametros`
- Se `diasAtraso >= prazoReativacao`, buscar vendedor do contrato e registrar evento `reativacao_120_dias` com `pontos_reativacao_120_dias`

#### 3. `asaas-webhook/index.ts` — Respeitar toggle de estorno

No bloco de estorno (PAYMENT_OVERDUE, linhas ~883-907), antes de estornar, verificar `estorno_cancelamento_antes_1_boleto` via `getParametroPontuacao`. Se `false`/`"false"`, pular o estorno.

#### 4. Nova Edge Function: `pontuar-operacao/index.ts`

Função genérica chamada pelos processos de troca de titularidade, migração e indicação convertida. Recebe:
```json
{
  "tipo_operacao": "troca_titularidade" | "migracao_aprovada" | "indicacao_convertida",
  "vendedor_id": "uuid",
  "contrato_id": "uuid (opcional)",
  "referencia_tipo": "string",
  "referencia_id": "uuid (opcional)",
  "pagamento_integral": true | false  // para troca de titularidade
}
```

Lógica:
- Para `troca_titularidade`: se `pagamento_integral` → `pontos_troca_titularidade`, senão → `pontos_troca_titularidade_parcial`
- Para `migracao_aprovada`: usa `pontos_migracao_aprovada`
- Para `indicacao_convertida`: usa `pontos_indicacao_convertida`
- Chama `registrarEventoPontuacao` do helper compartilhado

#### 5. Integrar chamadas à nova função

- **`aprovar-solicitacao-ia/index.ts`**: No bloco `troca_titularidade` (linha ~598), após criar vistoria, invocar `pontuar-operacao` com tipo `troca_titularidade`
- **Front-end ou processos de migração/indicação**: Onde a migração é aprovada ou indicação é convertida, invocar `pontuar-operacao`

#### 6. Atualizar `supabase/config.toml`

Adicionar entrada para `pontuar-operacao` com `verify_jwt = false`.

### Arquivos afetados

- `supabase/functions/pontuar-operacao/index.ts` — **NOVO**
- `supabase/functions/efetivar-substituicao/index.ts` — distinção integral/parcial
- `supabase/functions/asaas-webhook/index.ts` — reativação + toggle de estorno
- `supabase/functions/aprovar-solicitacao-ia/index.ts` — chamar pontuação na troca de titularidade
- `supabase/config.toml` — registrar nova função

