

# Correção: carenciaIsenta no PDF deve respeitar configuração de Regras de Venda

## Problema

Em `src/pages/vendas/Cotador.tsx` (linha 484), o campo `carenciaIsenta` é definido como `migracaoData.status === 'aprovada'` — ou seja, sempre `true` quando aprovada, ignorando a configuração `migracao_isentar_carencia` das Regras de Venda.

O PDF (em `useGerarProposta.ts` linha 336) usa esse valor diretamente para decidir se exibe "Dispensada" ou "Período padrão".

## Alteração

### `src/pages/vendas/Cotador.tsx`

1. Importar o hook `useMigracaoConfig` (de `useConteudosSistema`) que já existe e retorna `{ isentar_carencia: boolean, ... }`
2. No `useMemo` que monta `dadosProposta` (linha 484), mudar de:
   ```
   carenciaIsenta: migracaoData.status === 'aprovada'
   ```
   para:
   ```
   carenciaIsenta: migracaoData.status === 'aprovada' && migracaoConfig?.isentar_carencia === true
   ```
3. Adicionar `migracaoConfig` às dependências do `useMemo`

Apenas 1 arquivo, ~3 linhas alteradas.

