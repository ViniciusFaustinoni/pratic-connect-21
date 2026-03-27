

# Fix: Erro ao Salvar Benefício com Intervalo FIPE

## Causa Raiz

A tabela `entity_eligibility_rules` possui um CHECK constraint no campo `rule_type` que aceita apenas:
```
'fipe_range','ano_range','categoria_veiculo','categoria_especial','regiao','marca_modelo','tipo_uso','combustivel'
```

O código frontend insere dois `rule_type` que **não existem** nessa lista:
- `'fipe_eligibility'` — regra de elegibilidade por FIPE
- `'tipo_placa'` — regra de tipo de placa

Qualquer save que inclua esses tipos falha com violação de CHECK constraint.

## Correção

Uma migração SQL para expandir o CHECK constraint:

```sql
ALTER TABLE public.entity_eligibility_rules
  DROP CONSTRAINT entity_eligibility_rules_rule_type_check;

ALTER TABLE public.entity_eligibility_rules
  ADD CONSTRAINT entity_eligibility_rules_rule_type_check
  CHECK (rule_type IN (
    'fipe_range','fipe_eligibility','ano_range','categoria_veiculo',
    'categoria_especial','regiao','marca_modelo','tipo_uso',
    'combustivel','tipo_placa'
  ));
```

## Arquivos

| Arquivo | Ação |
|---|---|
| Nova migração SQL | Atualizar CHECK constraint para incluir `fipe_eligibility` e `tipo_placa` |

