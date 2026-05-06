## Mover "Mapa" para dentro de Serviços de Campo

Hoje **Mapa** é um item separado no menu lateral em `Monitoramento` (`/monitoramento/mapa`). A pedido, ele passa a ser uma **aba** dentro da página `Serviços de Campo` (`/monitoramento/vistorias-instalacoes-mon`), junto de Serviços, Aprovar Fotos e Histórico.

### Alterações

1. **`src/pages/monitoramento/VistoriasInstalacoesMon.tsx`**
   - Importar `Mapa` via `lazy(() => import('./Mapa'))` e ícone `Map`.
   - Adicionar `<TabsTrigger value="mapa">` (Mapa) na lista de abas.
   - Adicionar `<TabsContent value="mapa">` renderizando `<Mapa />` dentro de `Suspense`.
   - Posição da aba: logo após "Serviços".

2. **`src/components/layout/AppSidebar.tsx`**
   - Remover o item `Mapa` do grupo Monitoramento (linhas 220-224).

3. **`src/App.tsx`**
   - Manter a rota `/monitoramento/mapa` como redirect para `/monitoramento/vistorias-instalacoes-mon?tab=mapa` para não quebrar links externos/breadcrumbs salvos.
   - Atualizar `VistoriasInstalacoesMon` para ler `?tab=` e abrir a aba correspondente quando vier `tab=mapa`.

4. **`src/components/layout/GlobalBreadcrumb.tsx`**
   - Remover entrada específica de `/monitoramento/mapa` se existir (manter o redirect cuidando disso).

### Fora de escopo
- Mudanças visuais/funcionais dentro do componente `Mapa` em si.
- Permissões: a aba herda as mesmas permissões de Serviços de Campo (`canManageInstalacoes`).