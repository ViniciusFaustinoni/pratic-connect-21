

## Plano: Corrigir erro de biometria - reverter para LIVE

### Problema
A API Autentique **não suporta** os valores `FACE` e `LIVENESS` separados. O enum `SecurityVerificationEnum` só aceita `LIVE` (que já inclui selfie + prova de vida + documento). Não é possível separar selfie+liveness sem documento pela API atual.

### Correção

**1. `supabase/functions/autentique-create/index.ts`**
Reverter de:
```typescript
security_verifications: [{ type: "FACE" }, { type: "LIVENESS" }],
```
Para:
```typescript
security_verifications: [{ type: "LIVE" }],
```

**2. `supabase/functions/autentique-create-by-token/index.ts`**
Mesma reversão.

**3. Redeploy** de ambas as Edge Functions.

### Nota
Infelizmente a API Autentique não permite escolher apenas selfie+liveness sem documento. O tipo `LIVE` é a única opção de verificação biométrica disponível e inclui os 3 passos (selfie + documento + vídeo).

### Escopo
- 2 Edge Functions modificadas + redeploy

