

## Plan: Fix Clickable Coverage/Benefit Names in Plan Edit Modal

### Problem
In `PlanFormModal.tsx`, the `SearchableSelectionSection` component wraps each coverage/benefit item in a `<button>` element (line 200). The Radix `Checkbox` component also renders as a `<button>` internally. **Nested `<button>` elements are invalid HTML** — browsers break the DOM structure, causing unpredictable behavior when clicking the text area (the name/description). This is why clicking the label area causes errors or navigates away.

### Fix
In `src/components/admin/planos/PlanFormModal.tsx`, change the outer `<button>` wrapper (lines 200-232) to a `<div>` with `role="button"`, `tabIndex={0}`, and `onKeyDown` for Enter/Space accessibility. This eliminates the nested-button issue while keeping the entire row clickable.

```text
Before (line 200):
  <button type="button" onClick={...} className={...}>

After:
  <div role="button" tabIndex={0} onClick={...} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(item.id); } }} className={...}>
```

And change the closing `</button>` (line 232) to `</div>`.

### File Modified
- `src/components/admin/planos/PlanFormModal.tsx` — lines 200 and 232 only

### Not Changed
- Checkbox logic, toggle functions, form submission, or any other component

