

# Corrigir Botão de Assinatura Direta na Página Pública

## Problema
Na etapa "Aguardando Assinatura" da página pública de contratação, o botão "Assinar Contrato Agora" (link direto para o Autentique) não aparece. O botão está condicionado a `contrato?.linkAssinatura`, que pode ser `null` em dois cenários:

1. A Edge Function `autentique-create` retorna `signatureLink: null` porque a API do Autentique nem sempre retorna o `short_link` imediatamente na criação do documento
2. Ao recarregar a página, o polling verifica apenas o `status` do contrato mas nunca re-busca o `autentique_url` do banco para atualizar o estado local

## Solução

### `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx`

**1. Polling deve atualizar o `linkAssinatura`**
No `useEffect` de polling (linha ~251), ao consultar o contrato no banco (linha ~277), também buscar `autentique_url` e atualizar o estado do `contrato` se o link estiver disponível mas ainda não estiver no estado local:

```typescript
const { data } = await publicSupabase
  .from('contratos')
  .select('status, autentique_url')  // adicionar autentique_url
  .eq('id', contrato.id)
  .maybeSingle();

// Atualizar linkAssinatura se disponível e não setado
if (data?.autentique_url && !contrato?.linkAssinatura) {
  setContrato(prev => prev ? { ...prev, linkAssinatura: data.autentique_url } : prev);
}
```

**2. Fallback após envio para Autentique**
Após chamar `autentique-create`, se `signatureLink` for null, agendar uma re-busca do `autentique_url` do banco após 3 segundos (a API do Autentique pode demorar para gerar o short_link):

```typescript
if (!linkAssinatura) {
  setTimeout(async () => {
    const { data: retry } = await publicSupabase
      .from('contratos')
      .select('autentique_url')
      .eq('id', contratoId)
      .maybeSingle();
    if (retry?.autentique_url) {
      setContrato(prev => prev ? { ...prev, linkAssinatura: retry.autentique_url } : prev);
    }
  }, 3000);
}
```

**3. Verificação manual também atualiza o link**
Na função `verificarManualmente` (linha ~310), também buscar `autentique_url` e atualizar o estado.

## Arquivo alterado
| Arquivo | Ação |
|---------|------|
| `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx` | Polling e fallback para buscar/exibir link de assinatura |

