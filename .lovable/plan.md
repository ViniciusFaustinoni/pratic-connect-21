

## Plano: Garantir que o link de assinatura apareça no link público

### Diagnóstico

O componente `EtapaAssinaturaContrato.tsx` já possui:
- Estado "Aguarde..." quando `contrato?.linkAssinatura` é null (linhas 692-705)
- Polling leve a cada 3s para buscar `autentique_url` do banco (linhas 270-291)

O problema provável é que o link retornado pela edge function `autentique-create` pode não ser capturado (linha 243 tenta 3 campos diferentes: `signatureLink`, `link_assinatura`, `autentique_url`), e o polling subsequente pode falhar silenciosamente se a RLS bloquear.

### Mudanças (1 arquivo)

**`src/components/cotacao-publica/EtapaAssinaturaContrato.tsx`**

1. **Adicionar log no polling** para identificar se a query retorna dados ou null (debug)
2. **Incluir `cotacao_id` e `token_publico` como filtro adicional** no polling de link (linhas 275-279) para garantir que a RLS anon permita a leitura — buscar via `cotacao_id` com join ou query direta que satisfaça a policy `cotacao_token_publico IS NOT NULL`
3. **Fallback**: se após 30 segundos o link não aparecer, mostrar mensagem com botão "Tentar novamente" em vez de ficar no loading infinito
4. **Buscar link também na verificação manual** (linha 370 já faz isso, mas garantir que o estado `contrato` seja atualizado corretamente)

### Detalhes técnicos

A query de polling atual:
```typescript
publicSupabase.from('contratos').select('autentique_url').eq('id', contrato.id).maybeSingle()
```

Funciona porque a RLS policy `anon_select_contratos_by_cotacao_token` permite SELECT quando `cotacao_token_publico IS NOT NULL` — e o campo é preenchido na criação. Porém, para robustez, adicionar tratamento de timeout:

```typescript
// Adicionar estado de timeout
const [linkTimeout, setLinkTimeout] = useState(false);

// No polling useEffect, após 30s sem link:
useEffect(() => {
  if (etapaInterna !== 'aguardando_assinatura' || contrato?.linkAssinatura) return;
  const timeout = setTimeout(() => setLinkTimeout(true), 30000);
  return () => clearTimeout(timeout);
}, [etapaInterna, contrato?.linkAssinatura]);
```

E no JSX, quando `linkTimeout && !contrato?.linkAssinatura`, mostrar botão "Tentar gerar novamente" que chama `enviarParaAutentique(contrato.id)`.

