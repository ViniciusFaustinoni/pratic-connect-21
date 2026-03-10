

# Inserir mapeamento plano-preço em `plano_preco_map`

## O que será feito

Uma migration SQL para inserir os 14 registros de mapeamento entre planos ativos, linhas de produto e tipos de uso na tabela `plano_preco_map`.

## SQL a executar

```sql
INSERT INTO plano_preco_map (plano_id, linha_slug, tipo_uso) VALUES
  ('28ef5622-...', 'advanced',      'advanced'),
  ('aee01ee7-...', 'advanced',      'advanced-plus'),
  ('cf35399e-...', 'especial',      'particular'),
  ('12cdd378-...', 'especial-plus', 'particular'),
  ('fec2154e-...', 'lancamento',    'particular'),
  ('feeff63c-...', 'lancamento',    'particular'),
  ('1addfd28-...', 'lancamento',    'aplicativo'),
  ('74b8abc5-...', 'lancamento',    'particular'),
  ('6f8d28cb-...', 'select',        'particular'),
  ('43fe1e6a-...', 'select',        'particular'),
  ('fd6be7d7-...', 'select',        'aplicativo'),
  ('20c3685f-...', 'select-one',    'particular'),
  ('ba180738-...', 'select-one',    'aplicativo'),
  ('fe82bc38-...', 'select',        'particular');
```

## Verificação

Após execução, query de verificação para confirmar os 14 registros mapeados corretamente. Nenhum arquivo de código será alterado.

