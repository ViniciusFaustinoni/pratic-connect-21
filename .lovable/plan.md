

# Correção: Scroll travado na página de Perfil (mobile)

## Problema

Na página `/perfil`, o conteúdo é longo (foto, informações pessoais, segurança, conta, perfis de acesso), mas no mobile o scroll fica travado, impedindo visualização das seções inferiores.

## Causa

O `AppLayout` tem uma estrutura de scroll com `SidebarInset` (que renderiza como `<main>` com `min-h-svh`) envolvendo outro `<main>` com `overflow-y-auto overscroll-contain`. O `overscroll-contain` pode causar problemas de touch scroll em Android Chrome. Além disso, o `SidebarInset` tem `min-h-svh` por padrão que pode conflitar com o layout flex.

## Correção

### Arquivo: `src/components/layout/AppLayout.tsx`

1. Adicionar `-webkit-overflow-scrolling: touch` via classe CSS no container de scroll principal para garantir scroll suave no mobile
2. Remover `overscroll-contain` que pode travar o scroll em certos dispositivos Android

### Arquivo: `src/index.css`

Adicionar regra para o scroll container principal do app com `-webkit-overflow-scrolling: touch` e `touch-action: pan-y`.

### Arquivo: `src/components/ui/sidebar.tsx`

Na `SidebarInset`, quando usada dentro de um layout com `h-screen`, o `min-h-svh` conflita. A classe `overflow-hidden` passada via AppLayout deveria resolver, mas vamos garantir que `min-h-0` também seja aplicado para flex shrinking correto.

