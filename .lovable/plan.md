

# Fix: Termo de Afiliacao vazio no Autentique

## Problema Identificado

O template do banco de dados tem **20.465 bytes** de HTML rico (tabelas TipTap, paragrafos, etc.) -- o conteudo existe e esta correto.

O problema esta na funcao `markdownParaHTML` em `supabase/functions/_shared/template-utils.ts` (linha 592-596):

```typescript
if (conteudo.includes('<table') || conteudo.includes('<p>')) {
    return `<div class="section">${conteudo}</div>`;
}
```

Isso envolve **todo o conteudo de 20KB** em um unico `<div class="section">`. O CSS define:

```css
.section {
    margin-bottom: 10pt;
    page-break-inside: avoid;  /* <-- PROBLEMA */
}
```

O `page-break-inside: avoid` instrui o renderizador PDF a nao quebrar esse bloco entre paginas. Como o conteudo tem varias paginas, o renderizador do Autentique nao consegue renderizar e o conteudo desaparece ou vai para uma segunda pagina invisivel.

## Solucao

### 1. Alterar `markdownParaHTML` para HTML rico

Quando o conteudo ja e HTML (vindo do TipTap), NAO envolver em `<div class="section">` com `page-break-inside: avoid`. Usar apenas um wrapper neutro:

**Arquivo:** `supabase/functions/_shared/template-utils.ts`

Alterar a funcao `markdownParaHTML` para que, quando detectar HTML rico, retorne o conteudo em um `<div class="content-body">` (sem regra de page-break):

```typescript
if (conteudo.includes('<table') || conteudo.includes('<p>') || ...) {
    return `<div class="content-body">${conteudo}</div>`;
}
```

### 2. Adicionar CSS para `.content-body`

Na funcao `generateStyles`, adicionar:

```css
.content-body {
    /* SEM page-break-inside: avoid — permite quebra entre paginas */
}

.content-body table {
    page-break-inside: auto;
}
```

### 3. Deploy da edge function

Fazer deploy da edge function `autentique-create` e das funcoes que compartilham `template-utils.ts` para que a correcao seja aplicada.

## Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/_shared/template-utils.ts` | Alterar `markdownParaHTML` para usar wrapper sem page-break + adicionar CSS `.content-body` |

## Resultado Esperado

Ao enviar um novo termo para o Autentique, o PDF tera o header seguido de todo o conteudo do template (tabelas de dados do associado, veiculo, plano, clausulas, etc.) distribuido corretamente entre as paginas.

