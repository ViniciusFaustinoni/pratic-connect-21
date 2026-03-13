

## Plano: Remover bloco "Serviços:" do contrato independente do conteúdo

### Problema
A variável `{{plano.descricao}}` **é** mapeada (linha 96 do template-utils.ts) — ela é substituída pelo texto das coberturas (ex: "Roubo e Furto, Assistência 24 horas"). Depois da substituição, o regex atual nas linhas 153-162 não captura mais o bloco porque ele procura por `{{...}}` ou `—`, mas o texto já foi substituído por conteúdo real.

Resultado: o contrato mostra `Serviços: Roubo e Furto, Assistência 24 horas` quando deveria não mostrar nada.

### Solução
Ampliar os regexes para remover **qualquer** parágrafo que comece com "Serviços:" — independente do conteúdo que venha depois (variável não substituída, traço, ou texto real).

### Alteração

**`supabase/functions/_shared/template-utils.ts`** (linhas 153-162):

```typescript
// Remover bloco "Serviços:" — captura qualquer conteúdo após "Serviços:"
resultado = resultado.replace(
  /<p[^>]*>\s*(<strong>)?\s*Serviços\s*:?\s*(<\/strong>)?\s*[^<]*<\/p>/gi,
  ''
);
// Formato inline
resultado = resultado.replace(
  /Serviços\s*:\s*[^\n<]*/gi,
  ''
);
```

A diferença é usar `[^<]*` (qualquer conteúdo que não seja tag) em vez de `({{[^}]*}}|—|)`.

Redeploy necessário: `autentique-create` e `autentique-create-by-token`.

