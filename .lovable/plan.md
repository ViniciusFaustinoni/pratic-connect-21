

# Corrigir erro "value too long for type character varying(20)"

## Problema

Ao salvar os dados extraidos via OCR na pagina publica de cotacao (proposta), o PATCH para a tabela `cotacoes` retorna erro 400 porque um ou mais valores extraidos pelo OCR excedem o limite de caracteres das colunas `varchar(20)`.

As colunas afetadas sao campos que recebem dados de OCR e tem limites muito restritivos:

| Coluna | Limite Atual | Pode receber valores maiores |
|---|---|---|
| `cliente_rg` | varchar(20) | Sim - RG pode ter formatacao longa |
| `cliente_rg_orgao` | varchar(20) | Sim - Ex: "DETRAN/RJ", "SSP/SP" (ok, mas OCR pode extrair texto extra) |
| `cliente_cnh` | varchar(20) | Sim - numero da CNH com formatacao |
| `cliente_cnh_categoria` | varchar(10) | Geralmente ok |
| `cliente_telefone_secundario` | varchar(20) | Pode exceder com formatacao |
| `veiculo_combustivel` | varchar(20) | Sim - Ex: "ALCOOL/GASOLINA/GNV" pode exceder |
| `combustivel` | varchar(20) | Mesmo caso |
| `categoria` | varchar(20) | OCR pode extrair texto longo |
| `codigo_fipe` | varchar(20) | Geralmente ok |
| `telefone1_solicitante` | varchar(20) | Pode exceder com formatacao |
| `telefone2_solicitante` | varchar(20) | Pode exceder com formatacao |

## Solucao

Duas acoes combinadas:

### 1. Migration: Aumentar limites das colunas

Alterar as colunas mais propensos a erro para limites mais seguros (varchar(50) ou varchar(100)), especialmente as que recebem dados de OCR.

### 2. Truncar valores no frontend antes de salvar

Adicionar truncamento preventivo no `useCotacaoContratacao.ts` para garantir que valores nunca excedam o limite, mesmo apos o aumento.

---

## Detalhes Tecnicos

### Migration SQL

```sql
ALTER TABLE cotacoes
  ALTER COLUMN cliente_rg TYPE varchar(50),
  ALTER COLUMN cliente_rg_orgao TYPE varchar(50),
  ALTER COLUMN cliente_cnh TYPE varchar(50),
  ALTER COLUMN cliente_cnh_categoria TYPE varchar(20),
  ALTER COLUMN veiculo_combustivel TYPE varchar(50),
  ALTER COLUMN combustivel TYPE varchar(50),
  ALTER COLUMN categoria TYPE varchar(50),
  ALTER COLUMN telefone1_solicitante TYPE varchar(30),
  ALTER COLUMN telefone2_solicitante TYPE varchar(30),
  ALTER COLUMN cliente_telefone_secundario TYPE varchar(30);
```

### Truncamento no `useCotacaoContratacao.ts`

Adicionar funcao auxiliar `truncar(valor, max)` que limita o tamanho antes de enviar ao banco, aplicada a todos os campos varchar ao salvar dados pessoais (linhas 395-422).

### Arquivos modificados

| Arquivo | Acao |
|---|---|
| Migration SQL | Aumentar limites de colunas |
| `src/hooks/useCotacaoContratacao.ts` | Truncar valores antes do update |

