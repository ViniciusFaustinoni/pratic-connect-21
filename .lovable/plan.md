# Excluir planos SP e Região dos Lagos (exceto o único com contrato ativo)

## Escopo

- **Manter:** `Advanced Especial + - Lagos` (1 plano) — tem o contrato ativo `CTR-20260506184150-L7IWHL` do Thiago Nunes (SSA3G29).
- **Excluir:** os outros **170 planos** com sufixo `- SP` ou `- Lagos`, em todas as linhas (Lançamento, Exclusive, Diesel, Select One etc.).

## O que vai junto (cascata manual na mesma migration)

Para cada um dos 170 planos a excluir:

1. **Cotações vinculadas (30 não-ativas):** desvincular (`cotacoes.plano_id = NULL`) — preserva histórico das cotações em rascunho/abandonadas/canceladas sem quebrar FK.
2. **`planos_regioes`** — DELETE
3. **`planos_beneficios`** — DELETE
4. **`planos_coberturas`** — DELETE
5. **`planos_restricoes`** — DELETE
6. **`entity_eligibility_rules`** (escopo plano) — DELETE
7. **`planos`** — DELETE

Tudo em **uma única migration transacional**, filtrando por lista explícita de 170 IDs (gerada por `nome ILIKE '% - SP' OR nome ILIKE '% - Lagos'` excluindo o ID do plano do Thiago).

## Segurança

- Filtro duplo no WHERE: por sufixo do nome **e** exclusão explícita do `id` do plano preservado.
- Nenhum plano sem sufixo `- SP` / `- Lagos` é tocado.
- Contrato do Thiago e plano `Advanced Especial + - Lagos` ficam intactos.

## Detalhes técnicos

```sql
-- pseudocódigo da migration
WITH alvos AS (
  SELECT id FROM planos
  WHERE (nome ILIKE '% - SP' OR nome ILIKE '% - Lagos')
    AND id <> '<id_advanced_especial_lagos>'
)
-- 1. desvincular cotações
UPDATE cotacoes SET plano_id = NULL WHERE plano_id IN (SELECT id FROM alvos);
-- 2-6. DELETE em planos_regioes, planos_beneficios, planos_coberturas,
--      planos_restricoes, entity_eligibility_rules WHERE plano_id IN alvos
-- 7. DELETE FROM planos WHERE id IN alvos
```

Confirmação esperada após execução: 170 planos removidos, 1 mantido, contrato CTR-20260506184150-L7IWHL inalterado.