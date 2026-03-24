

# Corrigir Responsividade no Safari/iPhone

## Problema
O sistema de gestao (layout principal com sidebar) nao funciona bem no Safari do iPhone:
- Conteudo cortado por causa de `h-screen` (100vh), que no Safari inclui a barra de endereco do navegador
- Sem safe-area insets para iPhones com notch
- Botoes e cards podem sobrepor em telas estreitas

## Causa Raiz
O `AppLayout` (gestao) usa `h-screen` que equivale a `100vh`. No Safari iOS, `100vh` inclui a area coberta pela barra de endereco, fazendo com que o conteudo fique "atras" dela e nao seja acessivel. O `InstaladorLayout` ja usa `h-[100dvh]` corretamente.

## Alteracoes

### 1. `src/components/layout/AppLayout.tsx` — Usar `100dvh` em vez de `h-screen`

Trocar `h-screen` por `h-[100dvh]` no container principal para respeitar a viewport dinamica do Safari iOS.

### 2. `src/components/layout/AppHeader.tsx` — Safe area no header

Adicionar `pt-safe` no header para evitar sobreposicao com o notch em modo standalone (PWA).

### 3. `src/index.css` — Fallback global para `100dvh`

Adicionar regra CSS que garante que `h-screen` tenha fallback para `100dvh` quando suportado, e melhorar o suporte a safe-area no body/html.

### 4. `src/pages/Dashboard.tsx` — Responsividade dos KPIs e acoes rapidas

- Garantir que os cards KPI nao transbordem em telas de ~375px (iPhone SE)
- Ajustar `QuickActions` para wrap correto em mobile
- Ajustar texto de valores grandes (`R$ 407,3`) para nao quebrar layout

### 5. `src/components/layout/AppSidebar.tsx` — Safe area no sidebar mobile

Verificar se o Sheet do sidebar mobile respeita safe-area-inset no iPhone.

### 6. `src/components/analista-eventos/AnalistaEventosLayout.tsx` — Consistencia

Ja usa `h-dvh`, verificar e garantir consistencia com outros layouts mobile.

## Detalhes Tecnicos

Mudancas CSS principais:
- `h-screen` → `h-[100dvh]` nos layouts (suportado por todos navegadores modernos)
- Adicionar `@supports (height: 100dvh)` fallback no CSS global
- Padding com `env(safe-area-inset-*)` nos elementos fixos/sticky
- `-webkit-overflow-scrolling: touch` ja presente, manter

Arquivos: 4-5 arquivos, mudancas pontuais de classes CSS.

