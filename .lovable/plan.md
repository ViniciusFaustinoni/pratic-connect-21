

# Corrigir constraint `servicos_decisao_instalador_check`

## Problema

A constraint `servicos_decisao_instalador_check` na tabela `servicos` restringe `decisao_instalador` a apenas 3 valores: `aprovado`, `aprovado_ressalva`, `negado`.

O codigo tenta usar `pendente_monitoramento` e `declinado_monitoramento`, que sao valores validos do fluxo de triagem/ressalva mas nao foram incluidos na constraint.

## Solucao

Uma unica migracao SQL para dropar e recriar a constraint com todos os valores necessarios:

```sql
ALTER TABLE servicos DROP CONSTRAINT servicos_decisao_instalador_check;
ALTER TABLE servicos ADD CONSTRAINT servicos_decisao_instalador_check 
  CHECK (decisao_instalador = ANY (ARRAY[
    'aprovado', 'aprovado_ressalva', 'negado', 
    'pendente_monitoramento', 'declinado_monitoramento'
  ]));
```

Nenhuma alteracao de codigo necessaria. Apenas 1 migracao.

