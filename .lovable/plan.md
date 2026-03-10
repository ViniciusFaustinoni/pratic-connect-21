

# Fix: PlanosTab crash — missing color mapping

## Root Cause

The `LINE_COLORS` dictionary in `PlanosTab.tsx` only has entries for: `green`, `orange`, `purple`, `red`, `blue`.

The product line "Linha Select One" has `color: "emerald"`, which is not in the map. At line 162, `LINE_COLORS[line.color]` returns `undefined`, and then `colorConfig.inactive` throws `TypeError: Cannot read properties of undefined (reading 'inactive')`.

## Fix

Add a fallback in `PlanosTab.tsx` so unknown colors don't crash the page:

```typescript
const colorConfig = LINE_COLORS[line.color || 'blue'] || LINE_COLORS['blue'];
```

Also add `emerald` and `teal` entries to `LINE_COLORS` for completeness, since these are valid Tailwind colors that could be assigned to product lines.

| File | Change |
|---|---|
| `src/components/admin/planos/PlanosTab.tsx` | Add `emerald`/`teal`/`cyan` to `LINE_COLORS` + add fallback on lookup |

Single-line fix with defensive fallback — no other files affected.
