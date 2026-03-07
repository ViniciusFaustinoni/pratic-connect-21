

# Plan: Fix Scroll Bug & Replace Sidebar with Top Tabs on Configurações

## Problems Identified

1. **Scroll bug**: `ConfiguracoesLayout` uses `h-full overflow-hidden` on the outer div and `overflow-y-auto` on the main content area. But the parent `AppLayout` already has `overflow-y-auto` on its `<main>`. This creates **nested scroll containers** — the inner one tries to be `h-full` but the parent doesn't constrain height properly, causing content to be cut off or scroll to break.

2. **Navigation style**: Currently uses a left sidebar (desktop) and a Sheet drawer (mobile). User wants **top tab navigation** instead.

## Solution

### Rewrite `ConfiguracoesLayout.tsx`
- Remove the sidebar layout entirely (no more `aside` with `ConfiguracoesSidebar`)
- Remove the mobile Sheet nav (`ConfiguracoesMobileNav`)
- Remove `h-full`, `overflow-hidden`, and `overflow-y-auto` — let the parent `AppLayout` handle scrolling
- Add a **horizontal tab bar** at the top using the same menu items, rendered as `NavLink` styled tabs
- The tab bar should be horizontally scrollable on mobile (`overflow-x-auto`)

### Layout structure (simplified)
```text
<div>
  <h1>Configurações</h1>
  <nav> ← horizontal tabs (NavLinks) </nav>
  <Outlet />  ← content flows naturally, parent handles scroll
</div>
```

### Tab items
Flatten the existing menu sections into a single horizontal row:
- Meu Perfil, Segurança, Notificações, Usuários e Acessos (admin), Rateio (diretor), Integrações, Sistema

### Files changed
- **`src/pages/configuracoes/ConfiguracoesLayout.tsx`** — full rewrite to top-tab layout, no nested scroll containers

### Files potentially removable (but kept for now)
- `ConfiguracoesSidebar.tsx` and `ConfiguracoesMobileNav.tsx` — no longer imported, but won't delete to avoid breaking anything else

