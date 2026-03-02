
# Fix: Checklist being reset by background refetch

## Root Cause

There's a `useEffect` (line 256-262) that resets the checklist to all `pendente` whenever `servico` changes AND there's no saved checklist in the database. The problem:

1. User fills out checklist items (ok/nok) -- state is local only
2. React-query refetches `servico` (window focus, polling, etc.)
3. The effect sees no saved `checklist_data` in DB (it's only saved when user clicks "Proximo")
4. Resets ALL items back to `pendente`
5. `checklistCompleto` becomes `false` -- button disabled again

The user never gets to click "Proximo" because the checklist keeps resetting before they can.

## Fix

### File: `src/pages/instalador/InstaladorChecklist.tsx`

**Add a ref to track local modifications** (after line 132):

```typescript
const checklistModificadoLocal = useRef(false);
```

**Mark checklist as locally modified** when user changes any item status. Find the `handleStatusChange` function and add:

```typescript
checklistModificadoLocal.current = true;
```

**Guard the reset effect** (line 256-262) to skip reset if user has already modified the checklist locally:

```typescript
useEffect(() => {
  if (checklistModificadoLocal.current) return; // Don't reset if user already filled items
  const savedChecklist = (servico as any)?.checklist_data;
  const hasSaved = savedChecklist && typeof savedChecklist === 'object' && Object.keys(savedChecklist).length > 0;
  if (!hasSaved) {
    setChecklist(checklistItems.reduce((acc, item) => ({
      ...acc, [item.id]: { status: 'pendente' as ChecklistStatus }
    }), {}));
  }
}, [checklistItems, servico]);
```

This ensures the reset only happens on initial load or when vehicle type genuinely changes, never after the user has started filling out the checklist.

Only 1 file edited. No migration needed.
