

# Fix: Button URL example structure for Meta API

## Problem

Line 164 of `whatsapp-meta-templates/index.ts`:
```typescript
components.push({ type: "BUTTONS", buttons, example: urlExamples });
```

Meta receives `components[1].example = ["https://..."]` which serializes with numeric keys (`"0": "https://..."`), causing error `Unexpected key "0" on param "components[1]['example']"`.

## Root Cause

Meta expects URL examples **per-button**, not at the BUTTONS component level:

```text
❌ Current:  { type: "BUTTONS", buttons: [...], example: ["url"] }
✅ Expected: { type: "BUTTONS", buttons: [{ type: "URL", ..., example: ["url"] }] }
```

## Fix

### `supabase/functions/whatsapp-meta-templates/index.ts`

**Lines 147-168** — Refactor button construction to attach `example` to each individual URL button that has `{{` in its URL:

```typescript
const botoes = template.botoes as any[] | null;
if (botoes && botoes.length > 0) {
  const buttons = botoes.map((b: any) => {
    if (b.tipo === "url") {
      const btn: any = { type: "URL", text: b.texto, url: b.url };
      if (b.url?.includes("{{")) {
        btn.example = ["https://pratic-connect-21.lovable.app/app/criar-senha?token=exemplo-token-123"];
      }
      return btn;
    } else if (b.tipo === "telefone") {
      return { type: "PHONE_NUMBER", text: b.texto, phone_number: b.telefone };
    } else {
      return { type: "QUICK_REPLY", text: b.texto };
    }
  });
  components.push({ type: "BUTTONS", buttons });
}
```

Same fix in the **bulk send** block (lines 278-286).

### Summary
- **1 edge function** edited, 2 blocks (single send + bulk send)
- No database or frontend changes needed

