

# Corrigir Geração de Contrato - Coluna `valor_adicional` Ausente

## Problema Identificado

Os logs da edge function `contrato-gerar` mostram claramente o erro:

```
Could not find the 'valor_adicional' column of 'contratos' in the schema cache
```

A tabela `cotacoes` possui a coluna `valor_adicional`, mas a tabela `contratos` não. Quando a edge function tenta inserir o contrato copiando o `valor_adicional` da cotação, o Supabase rejeita a operação.

## Solução

### 1. Migração SQL - Adicionar coluna `valor_adicional` na tabela `contratos`

```sql
ALTER TABLE contratos
ADD COLUMN IF NOT EXISTS valor_adicional NUMERIC DEFAULT 0;

COMMENT ON COLUMN contratos.valor_adicional IS 'Valor adicional mensal (ex: cobertura extra, serviços opcionais)';
```

### 2. Nenhuma alteração de código necessária

A edge function `contrato-gerar` já está corretamente mapeando `cotacao.valor_adicional` para `contratos.valor_adicional` (linha 541). Uma vez que a coluna exista no banco, o fluxo funcionará sem erros.

## Arquivos Modificados

1. **Migração SQL** - Adicionar coluna `valor_adicional` na tabela `contratos`

Nenhum arquivo de código precisa ser alterado.

