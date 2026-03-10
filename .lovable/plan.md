

# Plano: Migrar hooks de `tabelas_preco` para `tabelas_preco_mensalidade`

## Contexto

9 arquivos fazem query a `tabelas_preco` (legada). Nenhum arquivo usa `tabelas_preco_mensalidade` (906 registros ativos). A vinculação plano → linha é via `plano_preco_map` (plano_id → linha_slug + tipo_uso).

## Arquitetura da migração

O novo fluxo de cálculo é:

```text
plano (planos) → plano_preco_map (linha_slug, tipo_uso) → tabelas_preco_mensalidade (valor_mensal, valor_desagio)
```

A query central:
```sql
WHERE linha_slug = :linha_slug
  AND regiao = :regiao
  AND tipo_uso = :tipo_uso
  AND (combustivel_tipo = :combustivel OR combustivel_tipo IS NULL)
  AND fipe_min <= :valorFipe AND fipe_max > :valorFipe
  AND is_active = true
```

O `valor_mensal` vem **direto** da nova tabela — não há mais cálculo de `taxa_comercial * multiplicador_regiao`. A decomposição (cota/admin/rastreamento/assistência) continua aplicada como percentuais sobre `valor_mensal`.

## Prioridade 1 — Hooks de cotação (5 arquivos)

### 1. `src/hooks/usePlanosCotacao.ts` (hook principal)

**Mudanças:**
- Remover query a `tabelas_preco` (lin
<lov-tool-use id="toolu_vrtx_019ivag7koqnNtDUXoATdpq2" name="code--view" data="{\"file_path\": \"src/hooks/useRegioes.ts\"}">
</lov-tool-use>
