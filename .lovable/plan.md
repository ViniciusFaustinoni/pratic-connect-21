

## Causa raiz

Contrato `a3d70892-ca90-4708-a41e-f2e09e5e1af5` (Vitória Antônia) está travado em `status=visualizado` no nosso banco, mesmo o painel Autentique mostrando "Assinou o documento — Verificação adicional por biometria aprovada manualmente" às 14:06.

### O que os logs mostram

A API GraphQL do Autentique, consultada pelo nosso `autentique-sync-contrato` (rodando a cada 15s), retorna:

```
signer: vitoriaanrodrigues@gmail.com
  viewed: true
  biometric_approved: true   ✅ (biometria aprovada manualmente)
  signed: false              ❌ (campo signed.created_at NUNCA foi populado)
```

E nossa lógica em `supabase/functions/autentique-sync-contrato/index.ts:356`:
```ts
const allSignersSigned = signersWithSignAction.every(s => s.signed?.created_at);
```

Ignora `biometric_approved`. Como `signed` está null, `overallStatus = "viewed"` para sempre. O webhook também nunca disparou `signature.signed` — só `viewed` e `updated`.

**Esse é um caso conhecido do Autentique**: quando a biometria PF_FACIAL exige aprovação manual da equipe Autentique, a assinatura é **legalmente válida** assim que `biometric_approved` é setado, mas o campo `signed.created_at` só aparece em fluxos sem revisão manual. Nosso código não trata esse caso → o associado fica preso na tela "Sua proposta está no seu e-mail".

### Impacto sistêmico

Qualquer contrato com biometria revisada manualmente pelo Autentique sofre o mesmo travamento — não é só a Vitória.

## Correção (raiz)

### 1. `supabase/functions/autentique-sync-contrato/index.ts`

Considerar `biometric_approved` como assinatura válida quando `viewed=true`:

```ts
// Tratar biometric_approved como assinatura efetiva (assinaturas com revisão manual)
const isEffectivelySigned = (s: any) =>
  !!s.signed?.created_at ||
  (!!s.biometric_approved?.created_at && !!s.viewed?.created_at);

const allSignersSigned = hasSigners && signersWithSignAction.every(isEffectivelySigned);
const anySignerSigned = signatures.some(isEffectivelySigned);
const signerWhoSigned = allPossibleSigners.find(isEffectivelySigned);
```

E na hora de gravar `data_assinatura`, usar `signed.created_at ?? biometric_approved.created_at`.

Também remover a regra dos "15 minutos" que classifica isso como `biometric_review` quando na verdade já está `biometric_approved=true` (linha 382-396) — só vira `review` se `biometric_approved=false` E `biometric_rejected=false`.

### 2. `supabase/functions/autentique-webhook/index.ts`

Adicionar tratamento para o evento `signature.biometric_approved` (atualmente ignorado): tratar como signed quando `viewed=true`. Hoje o webhook só age em `signature.signed`, que nunca chega nesse fluxo.

### 3. Reprocessar o contrato da Vitória

Após o deploy da fix, o próprio polling de 15s na tela pública dela vai atualizar o banco e liberar a próxima etapa automaticamente. Não precisa migration.

### 4. Buscar outros contratos travados na mesma situação

Listar e reprocessar:
```sql
SELECT id, numero, cliente_nome, autentique_documento_id
FROM contratos
WHERE status IN ('visualizado','enviado')
  AND autentique_documento_id IS NOT NULL
  AND created_at > now() - interval '30 days';
```

Para cada um, invocar `autentique-sync-contrato` — a nova lógica vai detectar `biometric_approved` e marcar como assinado.

## Arquivos a editar

- `supabase/functions/autentique-sync-contrato/index.ts` — `isEffectivelySigned` + ajuste do bloco `biometric_review`
- `supabase/functions/autentique-webhook/index.ts` — tratar `signature.biometric_approved`

## Validação

1. Após deploy, abrir o link público da Vitória (`token=f69ab7adf0fe4689893b6cdd08dfd806a65dbd0864af4e08ba2e471e2c4d454d`) — em até 15s deve avançar para a próxima etapa.
2. Conferir no banco: `status='assinado'`, `data_assinatura` preenchido, `pdf_assinado_url` populado.
3. Rodar a query de contratos travados e disparar sync para cada um.

