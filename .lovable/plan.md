

# Fix: Add `example` field to BUTTONS component for Meta API

## Problem

Meta's Template API requires that URL buttons with dynamic variables (e.g., `{{1}}`) include an `example` array showing sample values. The current code builds the BUTTONS component without this field, causing the rejection error: *"o componente do tipo BUTTONS não contém o(s) campo(s) esperado(s) (example)"*.

## Change

**File:** `supabase/functions/whatsapp-meta-templates/index.ts` (lines 146-159)

When building the BUTTONS component, detect if any URL button contains `{{` and add the required `example` field with sample values:

```typescript
// Current (broken):
components.push({ type: "BUTTONS", buttons });

// Fixed:
const urlExamples = buttons
  .filter((b: any) => b.type === "URL" && b.url?.includes("{{"))
  .map(() => "https://pratic-connect-21.lovable.app/app/criar-senha?token=exemplo-token-123");

if (urlExamples.length > 0) {
  components.push({ type: "BUTTONS", buttons, example: urlExamples });
} else {
  components.push({ type: "BUTTONS", buttons });
}
```

This adds the `example` array that Meta expects for dynamic URL buttons, using a sample URL as the example value.

## Files

| File | Change |
|---|---|
| `supabase/functions/whatsapp-meta-templates/index.ts` | Add `example` to BUTTONS component when URLs have variables |

