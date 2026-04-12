

## Plano: Padronizar exibição de regiões nos badges de elegibilidade

### Problema
Existem dois formatos de regras de região no banco:
- **Novo** (809 regras): `rule_config.values: ["uuid"]` → resolve para "Rio de Janeiro - Capital e Metropolitana"
- **Legado** (60 regras): `rule_config.regioes: ["RJ"]` → mostra "RJ" direto (não resolve nome)

Isso causa inconsistência visual nos badges.

### Solução: Migração de dados + fallback no código

**1. Migração SQL** — converter as 60 regras legadas para o formato novo
- Mapear `"RJ"` → UUID `6f99685d-52b6-43e4-9010-dfc03338886a` (Rio de Janeiro - Capital e Metropolitana)
- Mapear `"SP"` → UUID `b507f9c7-d7c0-4613-8a94-4c1e1278b3f2` (São Paulo - Capital e Metropolitana)
- Atualizar `rule_config` de `{"regioes": ["RJ"]}` para `{"values": ["6f99685d-..."]}`

**2. Fallback no `RuleBadges`** (`LinhasPlanos.tsx`)
- Na resolução de badges de região, se o valor não for UUID (não encontrado no `regioesMap`), tentar mapear strings conhecidas ("RJ" → buscar na tabela `regioes` por nome parcial)
- Isso garante que mesmo se surgirem novas regras legadas, o badge exibirá o nome completo

### Detalhes técnicos

```text
-- Migração (60 registros)
UPDATE entity_eligibility_rules
SET rule_config = jsonb_build_object('values', ARRAY[
  CASE 
    WHEN rule_config->'regioes' @> '["RJ"]' THEN '6f99685d-52b6-43e4-9010-dfc03338886a'
    WHEN rule_config->'regioes' @> '["SP"]' THEN 'b507f9c7-d7c0-4613-8a94-4c1e1278b3f2'
  END
])
WHERE rule_type = 'regiao' 
  AND rule_config ? 'regioes'
  AND is_active = true;
```

No `extractRuleValues`, a prioridade de `values` sobre `regioes` já existe — após migração, todos usarão `values`.

### Resultado
- Todos os badges mostrarão "Rio de Janeiro - Capital e Metropolitana" ou "São Paulo - Capital e Metropolitana"
- Sem mais inconsistência "RJ" vs nome completo

