

# Corrigir duplicação de benefícios invisível

## Problema identificado

A duplicação **está funcionando** no banco de dados (há 4 cópias criadas). Porém, o benefício duplicado é criado com `is_active: false` (linha 832 de `usePlansAdmin.ts`), enquanto o hook `useBenefits()` filtra apenas `.eq('is_active', true)` (linha 382 de `usePlans.ts`). Resultado: o item é criado mas nunca aparece na lista.

## Solução

### 1. Arquivo: `src/hooks/usePlansAdmin.ts` (useDuplicateBenefit)

- Alterar `is_active: false` para `is_active: true` — o benefício duplicado deve manter o mesmo status do original (ou pelo menos ficar ativo para ser visível)
- Alternativa melhor: copiar o `is_active` do original (`original.is_active`)

### 2. Arquivo: `src/hooks/usePlans.ts` (useBenefits)

- Remover o filtro `.eq('is_active', true)` para que o catálogo de gestão mostre TODOS os benefícios (ativos e inativos), permitindo ao gestor visualizar e gerenciar tudo
- Ou criar um hook separado `useAllBenefits` para o catálogo admin

### 3. Limpeza dos duplicados de teste

- Remover os 4 registros de cópia criados durante os testes do usuário

## Decisão recomendada

- No catálogo de gestão comercial: mostrar todos os benefícios (remover filtro `is_active`)
- Manter o filtro `is_active: true` apenas nos hooks usados pelo cotador/site
- Duplicar com `is_active: true` para feedback imediato

## Impacto
- 2 arquivos alterados, ~5 linhas
- 1 query de limpeza

