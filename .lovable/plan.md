

# Plano: Adicionar "Rotas" ao Menu de Monitoramento

## Situação Atual

- A página de Rotas já existe em `src/pages/monitoramento/Rotas.tsx` e a rota `/monitoramento/rotas` está registrada no `App.tsx`.
- A permissão `canEditRotas` já é usada dentro da página para restringir funcionalidades ao coordenador.
- O item simplesmente não aparece no menu lateral — falta adicioná-lo ao `AppSidebar.tsx`.

## Implementação

### Arquivo único: `src/components/layout/AppSidebar.tsx`

1. Adicionar `Route` ao import do `lucide-react` (linha 3-71).
2. Adicionar o item de menu na lista `items` do grupo `monitoramento`, após "Calendário" (linha 200):

```
{ title: 'Rotas', url: '/monitoramento/rotas', icon: Route, permission: 'canEditRotas' },
```

A permission `canEditRotas` garante que apenas o coordenador de monitoramento veja esse item no menu. Nenhum outro arquivo precisa ser alterado.

