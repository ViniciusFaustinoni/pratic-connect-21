

## Plano: Corrigir visibilidade do "Select One Aplicativo" para veiculos particulares

### Diagnostico

O plano "Select One Aplicativo" NAO tem nenhuma regra de nivel de plano na tabela `entity_eligibility_rules`. O codigo do motor (linha 327 de `usePlanosCotacao.ts`) verifica regras do plano corretamente, mas como nao existem regras, o plano passa.

As coberturas individuais tem regras `tipo_uso`, porem 3 delas incluem "particular":
- Chuva de Granizo: `include [particular]`
- Alagamento: `include [particular]`
- Perda Total: `include [particular, aplicativo]`

Os 8 beneficios nao tem nenhuma regra `tipo_uso`.

Resultado: para um veiculo particular, 3 coberturas + 8 beneficios passam. O plano so e descartado se TODAS as coberturas forem removidas (linha 367). Como 3 sobrevivem, o plano aparece.

### Solucao

Duas acoes necessarias:

**1. Inserir regra de plano no banco de dados (migration)**
- Adicionar uma regra `tipo_uso: include ["aplicativo"]` na `entity_eligibility_rules` com `entity_type = 'plano'` e `entity_id = 'd3a61bfd-5b40-4503-949d-cfc71dbfabb2'`
- Isso faz o motor bloquear o plano inteiro na linha 327 antes de avaliar coberturas/beneficios

**2. Verificar e corrigir coberturas com tipo_uso inconsistente**
- "Chuva de Granizo - Select One Passeio" e "Alagamento - Select One Passeio" tem `include [particular]` mas estao vinculadas a um plano de Aplicativo
- Estes itens parecem ser coberturas da versao Passeio reutilizadas incorretamente. Devem ser corrigidos para `include [aplicativo]` ou substituidos por coberturas especificas de APP
- "Perda Total (PT) - Select" tem `include [particular, aplicativo]` — esta correto se e compartilhada

### Alteracoes

**Migration SQL**
```sql
-- Regra de plano: Select One Aplicativo = apenas aplicativo
INSERT INTO entity_eligibility_rules (entity_id, entity_type, rule_type, rule_mode, rule_config, is_active)
VALUES ('d3a61bfd-5b40-4503-949d-cfc71dbfabb2', 'plano', 'tipo_uso', 'include', '{"values":["aplicativo"]}', true);

-- Corrigir coberturas com tipo_uso inconsistente
UPDATE entity_eligibility_rules 
SET rule_config = '{"values":["aplicativo"]}'
WHERE entity_id IN ('b2000001-0000-0000-0000-000000000005', 'b2000001-0000-0000-0000-000000000007')
  AND rule_type = 'tipo_uso';
```

### Resultado
- O plano "Select One Aplicativo" sera bloqueado pelo motor na etapa de regras do plano para veiculos particulares
- As coberturas Granizo e Alagamento ficarao consistentes com o plano APP
- Nenhuma alteracao de codigo necessaria — o motor ja suporta regras de plano (linha 327)

### Arquivos
- Nova migration SQL

