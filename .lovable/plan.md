
# Fix: Remover badge "0" na lista de planos

## Problema
O badge ao lado de cada plano mostra a contagem de associados ativos. Como nenhum associado está vinculado ainda, todos mostram "0" — poluição visual sem utilidade.

## Solução
- Quando `count === 0`, não exibir o badge de associados
- Quando `count > 0`, mostrar com ícone de Users para contexto

**Arquivo**: `src/components/gestao-comercial/ProdutosPlanos.tsx` (linhas 237-239)

Trocar:
```tsx
<Badge variant="outline" className="text-xs ml-2 shrink-0">
  {count}
</Badge>
```

Por:
```tsx
{count > 0 && (
  <Badge variant="outline" className="text-xs ml-2 shrink-0">
    <Users className="h-3 w-3 mr-1" />
    {count}
  </Badge>
)}
```

Alteração mínima, 1 arquivo.
