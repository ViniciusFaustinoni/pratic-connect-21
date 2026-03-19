

# Fix: Rota quebrada do wizard de substituição

## Problema

A rota registrada no `App.tsx` é:
```
/cadastro/associados/:associadoId/substituicao
```

Mas dois pontos de entrada navegam para uma rota inexistente:
```
/cadastro/substituicao-veiculo/:id
```

## Correções (2 arquivos)

### 1. `src/components/vendas/OutrasEntradasMenu.tsx` (linha 203)

Mudar de:
```typescript
navigate(`/cadastro/substituicao-veiculo/${selectedAssociadoId}`);
```
Para:
```typescript
navigate(`/cadastro/associados/${selectedAssociadoId}/substituicao`);
```

### 2. `src/pages/vendas/Cotacao.tsx` (linha 363)

Mudar de:
```typescript
navigate(`/cadastro/substituicao-veiculo/${associadoId}`);
```
Para:
```typescript
navigate(`/cadastro/associados/${associadoId}/substituicao`);
```

### Pontos que já estão corretos

- `AssociadoHeroHeader.tsx` — já usa `/cadastro/associados/${id}/substituicao` ✓
- Rotas de listagem (`/cadastro/substituicoes` e `/cadastro/substituicoes/:id`) estão corretas e são rotas diferentes (detalhe de substituição já criada, não o wizard) ✓

