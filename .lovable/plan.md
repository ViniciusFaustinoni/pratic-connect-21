
## Plano: Alterar biometria de LIVE para PF_FACIAL

### O que muda
O signatário precisará apenas tirar uma selfie, que será validada automaticamente via SERPRO (base federal) usando o CPF. Não será necessário fotografar nenhum documento físico.

### Alterações técnicas

**1. `supabase/functions/autentique-create/index.ts` (linha 738)**
```typescript
// De:
security_verifications: [{ type: "LIVE" }],
// Para:
security_verifications: [{ type: "PF_FACIAL" }],
```

**2. `supabase/functions/autentique-create-by-token/index.ts` (linha 624)**
Mesma alteração no `signerObj`.

**3. Redeploy** de ambas as Edge Functions.

### Pré-requisito
- O CPF do signatário deve ser enviado no campo `configs.cpf` do signer (isso já é feito em ambas as funções quando o CPF é válido).
- A conta Autentique precisa ter créditos de verificação de identidade.

### Escopo
- 2 Edge Functions modificadas + redeploy
