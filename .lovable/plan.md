

# Fix: Body example count mismatch in Meta template submission

## Problem

When sending the template `tecnico_a_caminho` to Meta, the payload contains 7 example values in `body_text` but only 6 variables (`{{1}}` to `{{6}}`) in the body text. Meta rejects this with "o componente do tipo BODY não contém o(s) campo(s) esperado(s) (example)".

From the logs:
```json
"example":{"body_text":[["Marcus","Vistoriador","(21) 99259-3830","https://wa.me/5521992593830","EST CAFUNDA, 725, TANQUE, RIO DE JANEIRO","Manhã (08:00-12:00)","Você pode entrar em contato com o técnico se precisar de mais informações!"]]}
```
7 values for 6 variables.

## Root Cause

The `variaveis_exemplo` object in the database has an extra key (likely "7" or a stale entry). The edge function blindly uses all keys from `variaveis_exemplo` without cross-checking against the actual variables present in `template.corpo`.

## Fix

**File:** `supabase/functions/whatsapp-meta-templates/index.ts` (lines ~129-138)

After sorting the keys from `variaveis_exemplo`, filter to only include keys that correspond to actual variables (`{{N}}`) found in the body text:

```typescript
// Body
const bodyComponent: any = {
  type: "BODY",
  text: template.corpo,
};

// Detectar variáveis reais no corpo
const varsNoCorpo = (template.corpo.match(/\{\{(\d+)\}\}/g) || [])
  .map((m: string) => m.replace(/[{}]/g, ''))
  .filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i)
  .sort((a: string, b: string) => parseInt(a) - parseInt(b));

const varExemplos = template.variaveis_exemplo as Record<string, string> | null;
if (varExemplos && varsNoCorpo.length > 0) {
  const valores = varsNoCorpo.map((k: string) => varExemplos[k] || `exemplo_${k}`);
  bodyComponent.example = { body_text: [valores] };
}
components.push(bodyComponent);
```

This ensures the example array always matches the exact number of variables in the body, ignoring stale/extra entries in `variaveis_exemplo`.

| File | Change |
|---|---|
| `supabase/functions/whatsapp-meta-templates/index.ts` | Cross-check example values against actual body variables |

