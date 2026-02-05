
# Plano: Corrigir Atraso/Delay no Scroll Vertical

## Problema Identificado

O atraso no scroll ocorre devido a **múltiplos containers com `overflow-auto` aninhados**, criando conflito de scroll entre containers pai e filho. Isso causa o comportamento de "scroll chain" onde o scroll só transfere para o container interno após o scroll do container externo atingir o limite.

### Hierarquia Problemática Atual

```text
SidebarProvider (min-h-svh)
└── div (flex h-screen overflow-x-hidden)
    └── SidebarInset (main - flex min-h-svh)
        └── main (overflow-auto) ← SCROLL AQUI
            └── div (padding + conteúdo)
                └── Dashboard content
```

O problema específico:
1. O `SidebarInset` usa `<main>` com `min-h-svh`
2. Dentro dele há outro `<main>` com `overflow-auto`
3. O scroll do navegador fica "preso" no container externo até atingir o limite

---

## Solução

### Correção 1: AppLayout.tsx - Unificar o container de scroll

Remover o aninhamento duplo de elementos `<main>` e garantir que apenas UM container controle o scroll.

**Arquivo:** `src/components/layout/AppLayout.tsx`

**Antes:**
```tsx
<SidebarInset className="flex flex-1 flex-col min-w-0 min-h-0 overflow-x-hidden">
  <AppHeader />
  <main className="flex-1 flex flex-col min-h-0 overflow-auto overflow-x-hidden">
    <div className="flex-1 px-3 py-4 ...">
      <Outlet />
    </div>
  </main>
</SidebarInset>
```

**Depois:**
```tsx
<SidebarInset className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
  <AppHeader />
  <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
    <div className="px-3 py-4 ...">
      <Outlet />
    </div>
  </main>
</SidebarInset>
```

Alterações:
- `overflow-hidden` no SidebarInset (não `overflow-x-hidden`)
- `overscroll-contain` no main para isolar o scroll
- Remover `flex flex-col flex-1` extras que não são necessários

---

### Correção 2: sidebar.tsx - SidebarContent

**Arquivo:** `src/components/ui/sidebar.tsx`

Adicionar `overscroll-contain` ao `SidebarContent` para evitar que o scroll da sidebar interfira:

**Antes (linha 382):**
```tsx
"flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-visible"
```

**Depois:**
```tsx
"flex min-h-0 flex-1 flex-col gap-2 overflow-auto overscroll-contain group-data-[collapsible=icon]:overflow-visible"
```

---

### Correção 3: index.css - Adicionar classe utilitária global

**Arquivo:** `src/index.css`

Adicionar na seção `@layer utilities`:

```css
/* Isolamento de scroll para containers principais */
.scroll-container {
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
```

---

### Correção 4: ConfiguracoesLayout.tsx

**Arquivo:** `src/pages/configuracoes/ConfiguracoesLayout.tsx`

**Antes:**
```tsx
<main className="flex-1 min-w-0 h-full overflow-y-auto">
```

**Depois:**
```tsx
<main className="flex-1 min-w-0 h-full overflow-y-auto overscroll-contain">
```

---

### Correção 5: AppLayout do App (Associados)

**Arquivo:** `src/components/app/AppLayout.tsx`

**Antes:**
```tsx
<main className="flex-1 overflow-auto pb-[56px] md:pb-0">
```

**Depois:**
```tsx
<main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-[56px] md:pb-0">
```

---

### Correção 6: InstaladorLayout.tsx

**Arquivo:** `src/components/instalador/InstaladorLayout.tsx`

Adicionar `overscroll-contain` em todos os containers de scroll.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/layout/AppLayout.tsx` | Simplificar aninhamento e adicionar `overscroll-contain` |
| `src/components/ui/sidebar.tsx` | Adicionar `overscroll-contain` ao SidebarContent |
| `src/index.css` | Adicionar classe utilitária `.scroll-container` |
| `src/pages/configuracoes/ConfiguracoesLayout.tsx` | Adicionar `overscroll-contain` |
| `src/components/app/AppLayout.tsx` | Adicionar `overscroll-contain` |
| `src/components/instalador/InstaladorLayout.tsx` | Adicionar `overscroll-contain` |

---

## Explicação Técnica

### O que é `overscroll-behavior: contain`?

- Impede o "scroll chaining" (propagação do scroll para containers pai)
- Quando o scroll atinge o limite, NÃO propaga para o container pai
- Isso elimina o atraso que você descreveu

### Por que está acontecendo?

O navegador, por padrão, quando você scrolla dentro de um container e atinge o limite, propaga o scroll para o container pai. Com múltiplos containers aninhados, isso cria um "atraso" visível onde o scroll parece "travar" enquanto o navegador decide qual container deve responder.

---

## Estimativa de Tempo

| Tarefa | Tempo |
|--------|-------|
| Corrigir AppLayout.tsx | 3 min |
| Corrigir sidebar.tsx | 2 min |
| Adicionar classe CSS | 1 min |
| Corrigir outros layouts | 5 min |
| Testar scroll em todas as páginas | 5 min |
| **Total** | **~16 min** |
