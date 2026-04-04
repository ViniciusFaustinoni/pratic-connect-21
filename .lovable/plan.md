

# Remover Rolagem Lateral do Modal de Detalhes do Associado

## Alteração

### `src/pages/cadastro/Associados.tsx` (linha 984)

Adicionar `overflow-x-hidden` ao `DialogContent`:

```tsx
// DE:
<DialogContent className="max-w-5xl max-h-[92vh] p-0 overflow-y-auto">

// PARA:
<DialogContent className="max-w-5xl max-h-[92vh] p-0 overflow-y-auto overflow-x-hidden">
```

## Impacto
- 1 linha alterada
- Conteúdo que ultrapassa a largura será cortado em vez de gerar scroll horizontal

