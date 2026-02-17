
# Renderizar HTML no Preview do Template

## Problema

O modal de visualizacao do template (`ModalVisualizarTemplate.tsx`) exibe o conteudo HTML cru como texto. A funcao `renderizarConteudo()` trata o conteudo como texto simples, dividindo por `{{variaveis}}` e exibindo tudo literal -- incluindo tags `<p>`, `<table>`, `<strong>`, etc.

## Solucao

Substituir a renderizacao de texto pela renderizacao de HTML real, mantendo o destaque visual das variaveis `{{...}}`.

**Arquivo: `src/components/documentos/ModalVisualizarTemplate.tsx`**

1. **Alterar a funcao `renderizarConteudo`** para retornar HTML processado:
   - Substituir as variaveis `{{...}}` por `<span>` estilizados (badges visuais) dentro do HTML
   - Retornar uma string HTML pronta para `dangerouslySetInnerHTML`

2. **Alterar o container de preview** (linhas 149-152):
   - Remover `font-mono` e `whitespace-pre-wrap` (nao faz sentido para HTML renderizado)
   - Usar `dangerouslySetInnerHTML` com classes `prose` para estilizacao adequada de tabelas, negrito, listas etc.
   - Adicionar `prose-sm dark:prose-invert` para compatibilidade com tema escuro

### Antes:
```tsx
<div className="bg-muted/50 p-4 rounded-lg border text-sm leading-relaxed whitespace-pre-wrap font-mono">
  {renderizarConteudo(template.conteudo)}
</div>
```

### Depois:
```tsx
<div 
  className="bg-muted/50 p-4 rounded-lg border text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none"
  dangerouslySetInnerHTML={{ __html: renderizarConteudoHTML(template.conteudo) }}
/>
```

A nova funcao `renderizarConteudoHTML` fara um replace das variaveis por spans estilizados:
```tsx
function renderizarConteudoHTML(conteudo: string): string {
  return conteudo.replace(
    /\{\{([^}]+)\}\}/g,
    '<span style="background:#3b82f6;color:white;padding:1px 6px;border-radius:4px;font-size:0.75rem;font-family:monospace">{{$1}}</span>'
  );
}
```

## Resultado

- Tabelas, negrito, listas e alinhamentos serao renderizados visualmente
- Variaveis `{{associado.nome}}` continuarao destacadas como badges azuis
- A secao de "Variaveis Utilizadas" abaixo permanece inalterada
