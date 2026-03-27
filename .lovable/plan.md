

# Fix: Página em Branco no Termo de Filiação (Autentique)

## Causa Raiz

Nos arquivos `autentique-create/index.ts` e `autentique-create-by-token/index.ts`, os anexos são inseridos com um **`<div>` vazio** que tem `page-break-before: always`:

```html
<div style="page-break-before: always;"></div>   ← div vazio = página em branco
<h2>Título do Anexo</h2>
<div>conteúdo</div>
```

Esse div vazio gera uma página em branco antes de cada anexo.

## Correção

Agrupar o conteúdo do anexo em um único container com `page-break-before: always`, eliminando o div vazio:

```html
<div style="page-break-before: always;">
  <h2>Título do Anexo</h2>
  <div>conteúdo</div>
</div>
```

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `supabase/functions/autentique-create/index.ts` | Remover div vazio, mover page-break para wrapper |
| `supabase/functions/autentique-create-by-token/index.ts` | Mesma correção |

