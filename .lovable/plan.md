

# Plano: Corrigir TrocaTitularidadeDialog que não abre

## Problema
Em `OutrasEntradasMenu.tsx`, ao selecionar um associado para troca de titularidade (linha 226), `onOpenChange(false)` fecha o dialog principal. Isso dispara o `useEffect` da linha 182-190, que reseta `selectedAssociadoId` para `null`. Como o `TrocaTitularidadeDialog` só renderiza quando `selectedAssociadoId` é truthy (linha 557), ele nunca aparece.

## Solução
Não resetar `selectedAssociadoId` e `selectedAssociadoNome` no `useEffect` de close se `showTrocaTitularidade` estiver `true`. Isso garante que o dialog de troca receba o ID corretamente.

## Alteração

### `src/components/vendas/OutrasEntradasMenu.tsx`
- Linhas 182-190: condicionar o reset de `selectedAssociadoId` e `selectedAssociadoNome` a `!showTrocaTitularidade && !showMigracao`:

```typescript
useEffect(() => {
  if (!open) {
    setSelectedTipo(null);
    setSearchTerm('');
    setMigracaoCpf('');
    if (!showTrocaTitularidade && !showMigracao) {
      setSelectedAssociadoId(null);
      setSelectedAssociadoNome('');
    }
  }
}, [open]);
```

## Arquivo modificado
- `src/components/vendas/OutrasEntradasMenu.tsx`

