# Sidebar mobile do diretor mostrar todos os caminhos (igual ao desktop)

## Causa raiz

No mobile (largura <768px), o shadcn `Sidebar` abre dentro de um `Sheet` (drawer lateral), mas o estado `state` do `useSidebar()` permanece `"collapsed"` enquanto o usuário não expandiu manualmente no desktop. O `AppSidebar.tsx` (linha 553-554) decide o que renderizar com:

```ts
const { state, setOpenMobile, isMobile } = useSidebar();
const collapsed = state === 'collapsed';
```

Como `collapsed` está `true`, ele entra no ramo do **modo colapsado** (linha 724) — que renderiza só ícones com popover lateral. Esse layout funciona no desktop, mas dentro do drawer mobile fica:

- Sem labels textuais dos itens.
- Popovers laterais (`side="right"`) que abrem para fora do drawer ou ficam atrás dele.
- Sem os super-grupos expansíveis com todos os módulos do diretor (Vendas, Operações, Financeiro, Diretoria, etc.).

Resultado: o diretor no celular vê uma versão amputada do menu — só os "main items" e ícones soltos, sem acesso aos sub-itens dos módulos.

## Correção

Forçar o **modo expandido** sempre que o sidebar estiver sendo renderizado dentro do drawer mobile, independente do `state` do desktop.

### Mudança 1 — `src/components/layout/AppSidebar.tsx` (linha 554)

Trocar:
```ts
const collapsed = state === 'collapsed';
```
por:
```ts
const collapsed = state === 'collapsed' && !isMobile;
```

Com isso, em mobile o componente entra direto no ramo **MODO EXPANDIDO** (linha 903) que já contém:
- Main items com label.
- Super-grupos colapsáveis (Vendas, Operações, Financeiro, Diretoria, RH, Marketing, Configurações…).
- Sub-grupos com todos os itens textuais e badges.
- Itens de configuração no rodapé.

### Mudança 2 — Garantir scroll/altura do drawer

O `SheetContent` mobile do shadcn tem altura total, mas o `SidebarContent` precisa ser scrollável quando a lista é longa (caso do diretor, com dezenas de itens). Verificar se já há `scrollbar-thin` e `overflow-y-auto` (já está em `SidebarContent` via shadcn). Se necessário, adicionar `h-full` no wrapper para o scroll funcionar dentro do `Sheet`.

### Mudança 3 — Footer/perfil no mobile

O `SidebarFooter` (links de Perfil/Configurações no rodapé, linhas ~1100-1145) já é renderizado nos dois modos. Garantir que continua aparecendo no drawer mobile (não precisa mudança — o footer está fora do `if collapsed`).

## O que NÃO muda

- Desktop continua exatamente igual: collapsed/expandido controlado pelo `SidebarTrigger` no `AppHeader`.
- Permissões e visibilidade de módulos (`visibleGroups`, `superGroups`, `useModuleVisibility`) continuam idênticas — diretor vê tudo.
- Roles de mobile dedicados (Regulador, Instalador, App Associado) não são tocados — eles têm seus próprios layouts.
- Não mexe em `AppMobileMenu` (esse é do app do associado, não do painel interno).

## Resultado esperado

No celular, ao tocar no botão de menu (hamburger no `AppHeader`), o diretor vê o **mesmo conjunto completo de super-grupos, grupos e itens** que vê no desktop expandido — com labels, badges, sub-itens e tudo navegável dentro do drawer.

Edição mínima (1 linha de código) com efeito direto no problema relatado.
