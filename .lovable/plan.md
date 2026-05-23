## Raiz do erro

A cadeia de falha do KOU6D37 é:

1. UI chama `criar-solicitacao-substituicao` (POST) → retorna **502**.
2. Dentro dela, na linha 61, há `admin.functions.invoke('importar-associado-sga', { body: { cpf } })` usando o client com **service role**.
3. `importar-associado-sga` (linhas 116–120) exige `Authorization: Bearer <user JWT>` e faz `userClient.auth.getUser()`. Sem esse header → retorna **401 "Não autenticado"**.
4. `supabase-js`'s `functions.invoke()` **NÃO** propaga automaticamente o service role key como `Authorization`; ele só manda `apikey`. Resultado: a chamada interna chega sem JWT de usuário → 401.
5. `criar-solicitacao-substituicao` empacota a falha como `"Falha ao importar associado do SGA: Edge Function returned a non-2xx status code"` e responde **502** → toast vermelho que o usuário vê.

Confirmação nos logs analytics (timestamps 11:18:09 / 11:18:25):
```
POST 401 importar-associado-sga
POST 502 criar-solicitacao-substituicao
```

O 400 em `/rest/v1/contratos` da segunda screenshot é ruído independente (query select malformada em outro componente) e não tem relação com este fluxo.

## Correção (cirúrgica, 1 arquivo)

**`supabase/functions/criar-solicitacao-substituicao/index.ts`** — propagar o `Authorization` do request original para o invoke aninhado:

```ts
const authHeader = req.headers.get('Authorization') || '';
// ...
const impResp = await admin.functions.invoke('importar-associado-sga', {
  body: { cpf },
  headers: authHeader ? { Authorization: authHeader } : undefined,
});
```

Mesmo tratamento para o invoke de `sga-buscar-associado-completo` (linha 43) caso essa função também exija JWT — confirmar no código dela e, se exigir, propagar igual.

Sem mudanças no front, sem mudanças no `importar-associado-sga` (regra de auth "qualquer usuário autenticado pode disparar import" continua válida).

## Validação

1. Redeploy automático da edge.
2. Repetir o fluxo "Substituição de Placa" com KOU6D37 → modal deve avançar para "Detalhes da Substituição".
3. Conferir logs: POST 200 nas duas edges.

## Fora de escopo

- Investigar o GET 400 em `/rest/v1/contratos` (origem diferente, abrir em outra rodada se persistir).
- Refatorar todos os outros invokes server-to-server do projeto (auditoria separada, não bloqueia este fix).
