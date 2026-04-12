

## Plano: Simplificar tabela de coberturas e benefícios no termo

### Problema
A tabela "COBERTURAS E BENEFÍCIOS DO PLANO" gerada no documento mostra colunas de Descrição e Valor/Detalhes separadamente, mas na maioria dos casos estão vazias ("—"), poluindo o documento.

### Solução
Alterar as funções de geração para exibir apenas uma lista simples com os nomes dos itens, sem colunas de valor, descrição ou detalhes individuais.

### Alterações

**`supabase/functions/_shared/template-utils.ts`** -- 2 funções:

1. **`gerarSecaoCoberturasInjetavel`** (linha 60-93): Substituir tabelas de 3 colunas por uma tabela simples de 1 coluna (apenas nome do item), separada em seções Coberturas e Benefícios.

2. **`gerarTabelaCompletaHTML`** (linha 96-123): Mesma simplificação -- remover colunas Descrição/Detalhes/Valor, manter apenas Nome.

Formato final da tabela:
```text
┌──────────────────────────────────┐
│         COBERTURAS               │  (header azul)
├──────────────────────────────────┤
│ Proteção 360º                   │
│ Vidros e Faróis                 │
│ Danos a Terceiros R$40.000      │
├──────────────────────────────────┤
│         BENEFÍCIOS               │  (header azul)
├──────────────────────────────────┤
│ Assistência 24h 1000km           │
│ Carro Reserva 30 dias           │
│ Kit Gás R$1.500,00              │
└──────────────────────────────────┘
```

### Escopo
- 1 arquivo modificado + redeploy das Edge Functions que o importam
- Sem migração SQL

