

## Diagnóstico: "Erro ao processar contrato" — `_startTime is not defined`

### Causa raiz

A Edge Function `autentique-create` crasha no final da execução (linhas 851 e 869) ao tentar fazer `Date.now() - _startTime` para logar o tempo de resposta. A variável `_startTime` existe apenas dentro da função auxiliar `buscarConfigRastreador` (linha 39), mas **não foi declarada** no escopo principal do handler `serve()`.

O contrato e o documento no Autentique **são criados com sucesso**, mas a resposta HTTP nunca chega ao frontend porque a função crasha antes de retornar. Por isso, ao recarregar, o contrato já existe e funciona normalmente.

### Correção

**`supabase/functions/autentique-create/index.ts`** — Adicionar `const _startTime = Date.now();` logo após a linha 176 (`try {`), no início do bloco try do handler principal.

```typescript
try {
    const _startTime = Date.now();  // ← ADICIONAR ESTA LINHA
    const autentiqueApiKey = Deno.env.get("AUTENTIQUE_API_KEY");
```

### Escopo
- 1 linha adicionada em 1 Edge Function
- Deploy da função `autentique-create`

