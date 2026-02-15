
# Ocultar Ouvidoria e Configuracoes do menu do Analista de Eventos

## Problema

O Analista de Eventos ve no sidebar os menus "Ouvidoria" e "Configuracoes", mas nao tem permissao para acessar essas areas (o `useRouteGuard` ja bloqueia e redireciona). O menu deve refletir as rotas permitidas.

## Causa

- `canManageOuvidoria` inclui `isFuncionario()`, que abrange todos os funcionarios -- incluindo analista de eventos
- Configuracoes usa `canViewDashboard` que e `profile?.tipo === 'funcionario'`, tambem abrangendo analista de eventos

## Solucao

### Arquivo 1: `src/hooks/usePermissions.ts`

Excluir `isAnalistaEventosOnly` da permissao `canManageOuvidoria`:

```typescript
// De:
canManageOuvidoria: (isDiretor || ... || isFuncionario() || isDesenvolvedor) && !isVendedorCotacao,

// Para:
canManageOuvidoria: (isDiretor || ... || isFuncionario() || isDesenvolvedor) && !isVendedorCotacao && !isAnalistaEventosOnly,
```

### Arquivo 2: `src/components/layout/AppSidebar.tsx`

Adicionar uma permissao especifica ao item de Configuracoes que exclua o analista de eventos. A abordagem mais simples e filtrar diretamente no render: se `isAnalistaEventosOnly`, nao renderizar o item de Configuracoes.

Alterar o array `configItems` para incluir uma flag ou adicionar logica no filtro que ja existe (`filterByPermission`). A opcao mais limpa e adicionar uma verificacao no bloco que renderiza os `configItems`:

```typescript
// Filtrar configItems para analista de eventos
const filteredConfigItems = filterByPermission(configItems)
  .filter(item => !(permissions.isAnalistaEventosOnly && item.url === '/configuracoes'));
```

### Resumo de arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/usePermissions.ts` | Adicionar `&& !isAnalistaEventosOnly` em `canManageOuvidoria` |
| `src/components/layout/AppSidebar.tsx` | Ocultar item Configuracoes para `isAnalistaEventosOnly` |
