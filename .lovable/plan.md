

# Corrigir Botão de Assinatura Ausente na Página Pública

## Problema
O botão "Assinar Contrato Agora" não aparece porque `contrato.linkAssinatura` é `null`. A causa raiz está em dois pontos:

1. **`autentique-create`**: quando o Autentique não retorna o `short_link` imediatamente na criação do documento (comportamento comum), o `signatureLink` fica `null` e o campo `autentique_url` no banco também fica vazio.

2. **`autentique-sync-contrato`**: o polling a cada 15s consulta a API do Autentique e recebe o `short_link` nos dados das `signatures`, **mas nunca o retorna na resposta nem o salva no banco** quando o status é "pending". A resposta "pending" (linhas 550-558) retorna apenas `{ success, atualizado: false, mensagem, status }` — sem `autentique_url`.

Resultado: mesmo que o Autentique já tenha o link disponível, o frontend nunca recebe e o botão nunca aparece.

## Solução

### `supabase/functions/autentique-sync-contrato/index.ts`

**Após processar o status (depois da linha ~377):**

1. Extrair o `short_link` do signatário com ação SIGN dos dados já recebidos da API.
2. Se o contrato não tem `autentique_url` no banco mas o link existe na resposta da API, salvar no banco.
3. Incluir `autentique_url` em TODAS as respostas (signed, pending, viewed, rejected).

```typescript
// Extrair link de assinatura do signatário SIGN
const signerForLink = signersWithSignAction[0] || signatures[0];
const signatureLink = signerForLink?.link?.short_link || null;

// Salvar autentique_url no banco se ausente
if (signatureLink && !contrato.autentique_url) {
  await supabase
    .from("contratos")
    .update({ autentique_url: signatureLink })
    .eq("id", contrato.id);
}

const autentiqueUrlFinal = signatureLink || contrato.autentique_url;
```

Depois, adicionar `autentique_url: autentiqueUrlFinal` em cada `JSON.stringify` de resposta (linhas 502, 521, 539, 551).

### Busca de contrato (início da função)

Garantir que o `select` do contrato inclui `autentique_url` para comparar se já existe.

### Deploy
Redeployar `autentique-sync-contrato`.

## Arquivo alterado
| Arquivo | Ação |
|---------|------|
| `supabase/functions/autentique-sync-contrato/index.ts` | Extrair e retornar/salvar `autentique_url` em todas as respostas |

