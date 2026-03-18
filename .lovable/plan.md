

## Plano: Enviar CPF no formato aceito pelo Autentique nos signatários

### Problema
Nenhuma das Edge Functions que criam documentos no Autentique está enviando o CPF do signatário no campo `configs.cpf`. A API do Autentique aceita o CPF **somente com dígitos** (ex: `"12345678900"`) nesse campo, que serve para validar a identidade do assinante.

### Alterações

Adicionar `configs: { cpf: "XXXXXXXXXXX" }` (11 dígitos, sem máscara) no objeto signer de cada Edge Function que cria documentos no Autentique:

1. **`supabase/functions/autentique-create/index.ts`** — Extrair CPF do contrato (`clienteCpf || contrato.cliente_cpf`), sanitizar com `.replace(/\D/g, '')`, e incluir no signer.
2. **`supabase/functions/autentique-create-by-token/index.ts`** — Mesmo padrão, usando `clienteCpf` do body.
3. **`supabase/functions/autentique-cancelamento-create/index.ts`** — Usar `associado.cpf` sanitizado.
4. **`supabase/functions/autentique-vistoria-create/index.ts`** — Usar `params.clienteCpf` sanitizado.
5. **`supabase/functions/autentique-evento-create/index.ts`** — Extrair CPF do associado/contrato disponível.
6. **`supabase/functions/autentique-os-saida-create/index.ts`** — Extrair CPF do associado.

### Formato do signer (exemplo)

```typescript
signers: [{
  name: signerName,
  email: signerEmail,
  action: "SIGN",
  configs: {
    cpf: (cpfOrigem || '').replace(/\D/g, ''),  // "12345678900"
  },
  positions: gerarPosicoesAssinatura(...),
}]
```

O campo `configs.cpf` garante que o Autentique valide que somente o portador daquele CPF consiga assinar. O CPF é enviado como string de 11 dígitos sem pontuação — formato exigido pela API.

### Deploy
Todas as 6 funções serão redeployadas após a alteração.

