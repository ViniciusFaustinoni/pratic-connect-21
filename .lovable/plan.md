

# Atualizar Status da Cotacao para "Link Enviado" ao Cliente Acessar

## Problema
Quando o cliente acessa o link publico da cotacao, o campo `visualizado_em` e atualizado, mas o `status` permanece como `'rascunho'`. Na barra de status, a cotacao continua aparecendo em "Rascunho" em vez de "Link Enviado".

## Solucao
Alterar o hook `useCotacaoContratacao.ts` para, ao registrar a primeira visualizacao do cliente, tambem atualizar o `status` de `'rascunho'` para `'enviada'`.

## Detalhes Tecnicos

### Arquivo: `src/hooks/useCotacaoContratacao.ts` (linhas 96-102)

Atualmente:
```typescript
if (!data.visualizado_em) {
  await publicSupabase
    .from('cotacoes')
    .update({ visualizado_em: new Date().toISOString() })
    .eq('id', data.id);
}
```

Sera alterado para:
```typescript
if (!data.visualizado_em) {
  const updateData: any = { visualizado_em: new Date().toISOString() };
  // Se ainda esta em rascunho, mover para 'enviada' (Link Enviado)
  if (data.status === 'rascunho') {
    updateData.status = 'enviada';
  }
  await publicSupabase
    .from('cotacoes')
    .update(updateData)
    .eq('id', data.id);
}
```

Isso garante que ao cliente abrir o link pela primeira vez, a cotacao saia de "Rascunho" e va para "Link Enviado" na barra de status. Cotacoes que ja tenham status mais avancado (aceita, etc.) nao sao afetadas.

Nenhuma outra alteracao necessaria -- a barra de status ja filtra `status === 'enviada'` para "Link Enviado".
