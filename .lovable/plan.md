

# Fix: "Baixar Documento Assinado" — Erro 403

## Problema
O frontend faz `fetch()` diretamente para `https://api.autentique.com.br/documentos/{id}/assinado.pdf`, que retorna **403 Forbidden** porque a API exige autenticação com Bearer token. O browser não tem acesso à `AUTENTIQUE_API_KEY`.

## Solução
Criar uma **Edge Function proxy** (`autentique-download`) que recebe o document ID, faz o download do PDF usando a API key do servidor, e retorna o arquivo ao frontend.

## Alterações

### 1. Nova Edge Function: `supabase/functions/autentique-download/index.ts`
- Recebe `{ documentId }` no body
- Faz fetch para `https://api.autentique.com.br/documentos/{documentId}/assinado.pdf` com header `Authorization: Bearer {AUTENTIQUE_API_KEY}`
- Retorna o PDF como blob com headers CORS

### 2. Atualizar `src/components/contratos/ContratoDetailDrawer.tsx` (linha ~562-576)
- Substituir o `fetch()` direto pela chamada à edge function:
```typescript
const { data, error } = await supabase.functions.invoke('autentique-download', {
  body: { documentId: contrato.autentique_documento_id },
});
if (error) throw error;
const blob = new Blob([data], { type: 'application/pdf' });
// ... criar link e download
```

### 3. Verificar outros locais com mesmo padrão
- Checar se `TermoAssinaturaCard.tsx` (sinistros) também faz download direto — pelo código visto, usa `<a href>` que também falharia com 403, mas pode estar usando URL pública do storage. Verificar e corrigir se necessário.

## Detalhes Técnicos
- A edge function já existe como padrão no projeto (`autentique-status`, `autentique-webhook`), então segue o mesmo padrão de CORS e uso da `AUTENTIQUE_API_KEY`
- JWT verification pode ser true (requer login) para segurança
- Config.toml precisa de entrada para a nova função

