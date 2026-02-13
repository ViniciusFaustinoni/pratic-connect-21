
# Corrigir exibicao de documentos de sinistro (imagens nao carregam)

## Diagnostico

O bucket `sinistros` no Supabase Storage esta configurado como **privado** (`public: false`), mas a edge function `upload-documento-sinistro` salva URLs usando `getPublicUrl()` (linha 96-98). URLs publicas so funcionam para buckets publicos, por isso as imagens aparecem quebradas.

## Solucao

A abordagem mais simples e segura: **tornar o bucket publico** via SQL, ja que os arquivos de sinistro precisam ser visualizados por usuarios autenticados no painel e tambem pelo link publico de upload. Alternativamente, poderiamos usar signed URLs, mas isso adicionaria complexidade desnecessaria.

Alem disso, vou ajustar o frontend para gerar URLs corretas caso o `arquivo_url` armazenado seja um caminho relativo (sem `https://`).

## Alteracoes

| Arquivo / Recurso | Descricao |
|---|---|
| SQL (Supabase) | Tornar o bucket `sinistros` publico com `UPDATE storage.buckets SET public = true WHERE id = 'sinistros'` |
| `src/pages/eventos/SinistroAnalise.tsx` | Adicionar fallback: se `arquivo_url` nao comeca com `http`, gerar URL publica via `supabase.storage.from('sinistros').getPublicUrl(path)` |

## Detalhes tecnicos

### 1. Tornar bucket publico (SQL)

```sql
UPDATE storage.buckets SET public = true WHERE id = 'sinistros';
```

Isso faz as URLs `/object/public/sinistros/...` funcionarem imediatamente, corrigindo todas as imagens ja armazenadas.

### 2. Fallback no frontend (SinistroAnalise.tsx)

Adicionar helper no componente para resolver URLs:

```typescript
const resolverUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  // Se for caminho relativo, gerar URL publica
  return supabase.storage.from('sinistros').getPublicUrl(url).data.publicUrl;
};
```

Usar `resolverUrl(doc.arquivo_url)` em todos os pontos onde `doc.arquivo_url` e referenciado (thumbnail, preview modal).

### 3. Preview modal

O modal de preview ja existe no codigo. Apenas garantir que usa `resolverUrl()` para a URL da imagem/PDF.
