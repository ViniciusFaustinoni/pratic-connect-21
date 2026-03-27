

# Remover Trecho "TABELA FIPE" da Proposta de Filiação

## Problema

O template `AF1` (Proposta de Filiação) na tabela `documento_templates` contém o seguinte trecho que deve ser removido:

```
<p><strong>TABELA FIPE</strong></p>
<p>Declaro estar ciente e de acordo que, em caso de ressarcimento integral, opto para que o valor seja calculado com base na Tabela FIPE vigente na data do evento: SIM</p>
```

Este texto aparece apenas no banco de dados (template HTML do `AF1`), não nos componentes React nem nas edge functions.

## Correção

Uma migração SQL que remove os dois parágrafos do campo `conteudo` do template `AF1` usando `REPLACE()`.

## Arquivos

| Arquivo | Ação |
|---|---|
| Nova migração SQL | `UPDATE documento_templates` removendo o trecho TABELA FIPE do template `AF1` |

