

## Plano: Ativar verificação biométrica LIVE na assinatura Autentique

### O que muda
O signatário, ao assinar o termo de filiação, será obrigado a tirar uma selfie, fotografar um documento com foto e realizar prova de vida por vídeo. A Autentique compara automaticamente as imagens. Isso consome créditos adicionais de verificação no Autentique.

### Alterações técnicas

**1. `supabase/functions/autentique-create/index.ts` (~linha 732-741)**
Adicionar `security_verifications` ao `signerObj`:
```typescript
const signerObj: any = {
  name: signerName || undefined,
  email: signerEmail,
  action: "SIGN",
  delivery_method: "DELIVERY_METHOD_EMAIL",
  positions: gerarPosicoesAssinatura(posConfig),
  security_verifications: [{ type: "LIVE" }],
};
```

**2. `supabase/functions/autentique-create-by-token/index.ts` (~linha 624)**
Mesma adição de `security_verifications: [{ type: "LIVE" }]` ao `signerObj`.

**3. Redeploy** de ambas as Edge Functions.

### Importante
- A verificação LIVE consome créditos adicionais no Autentique. Confirme que seu plano Autentique suporta esse tipo de verificação.
- O fluxo do signatário será: selfie + foto de documento com foto + prova de vida por vídeo, tudo antes de poder assinar.

### Escopo
- 2 Edge Functions modificadas + redeploy

