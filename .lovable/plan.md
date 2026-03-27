

# Fix Scroll Issue on "Planos de Cobertura" and Other Pages

## Problem

Mousewheel and touchpad scrolling does not work on pages rendered inside the main layout. Users can only scroll via the browser scrollbar. Reproduced on multiple machines.

## Root Cause

In `src/index.css` (lines 772-776), the `.app-scroll-container` class applies `touch-action: pan-y`, which on some browsers/OS combinations restricts pointer-based scroll events (trackpad, precision touchpad). Combined with `overscroll-behavior-y: none` on `body` (line 186), the browser may not propagate wheel events properly to the inner scroll container.

Additionally, `SidebarInset` has both `min-h-svh` and `min-h-0` conflicting (line 314 of sidebar.tsx), and the AppLayout adds `overflow-hidden` on it (line 37), creating a rigid container that relies entirely on the inner `<main>` for scrolling.

## Fix

### 1. `src/index.css` — Remove restrictive `touch-action`

Remove `touch-action: pan-y` from `.app-scroll-container`. This property is meant for touch devices but can interfere with precision touchpads and wheel events on desktop browsers.

```css
/* Before */
.app-scroll-container {
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
}

/* After */
.app-scroll-container {
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}
```

### 2. `src/components/layout/AppLayout.tsx` — Ensure proper scroll propagation

On line 40, add `overscroll-behavior: contain` to isolate scroll within the main area without blocking wheel events:

```tsx
<main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden app-scroll-container overscroll-contain">
```

### 3. `src/index.css` — Remove `overscroll-behavior-y: none` from body

Line 186: Change `overscroll-behavior-y: none` to `overscroll-behavior-x: none` on body/#root, so vertical scroll is not suppressed globally while still preventing horizontal overscroll bounce.

## Files changed

| File | Action |
|---|---|
| `src/index.css` | Remove `touch-action: pan-y` from `.app-scroll-container`; adjust `overscroll-behavior` on body |
| `src/components/layout/AppLayout.tsx` | Add `overscroll-contain` class to main element |

