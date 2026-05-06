## Mover "Prestadores Parceiros" para dentro de Equipe

Hoje **Prestadores Parceiros** é item separado no menu lateral em `Monitoramento` (`/monitoramento/prestadores-parceiros`). Passa a ser uma **aba** dentro da página `Equipe` (`/monitoramento/equipe`), ao lado de "Equipe" e "Plantões".

### Alterações

1. **`src/pages/monitoramento/Equipe.tsx`**
   - Importar `lazy(() => import('./PrestadoresParceiros'))` e ícone `Truck`.
   - Adicionar `<TabsTrigger value="prestadores">` após "Plantões".
   - Adicionar `<TabsContent value="prestadores">` renderizando `<PrestadoresParceirosTab />` dentro de `Suspense`.
   - Trocar `defaultValue` por `value`/`onValueChange` controlado, com leitura de `?tab=` (`useSearchParams`) — assim `/monitoramento/equipe?tab=prestadores` abre direto a aba.

2. **`src/components/layout/AppSidebar.tsx`**
   - Remover o item `Prestadores Parceiros` do grupo Monitoramento (linha 241).

3. **`src/App.tsx`**
   - Trocar a rota `/monitoramento/prestadores-parceiros` por `<Navigate to="/monitoramento/equipe?tab=prestadores" replace />` para preservar links salvos.

### Fora de escopo
- Mudanças visuais/funcionais dentro do componente `PrestadoresParceiros` em si.
- Permissões: a aba herda as mesmas da página Equipe.