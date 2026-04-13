

## Plano: Alterar biometria para FACE + LIVENESS (sem documento)

### O que muda
O signatário precisará apenas tirar uma selfie e fazer prova de vida por vídeo. Não será mais necessário fotografar documento (RG/CNH).

### Alterações técnicas

**1. `supabase/functions/autentique-create/index.ts`**
Alterar de:
```typescript
security_verifications: [{ type: "LIVE" }],
```
Para:
```typescript
security_verifications: [{ type: "FACE" }, { type: "LIVENESS" }],
```

**2. `supabase/functions/autentique-create-by-token/index.ts`**
Mesma alteração.

**3. Redeploy** de ambas as Edge Functions.

### Escopo
- 2 Edge Functions modificadas + redeploy

