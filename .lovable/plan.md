

# Layout side-by-side e Drag and Drop de variaveis

## O que muda

### 1. Reorganizar layout do TemplateForm

Atualmente o layout usa um grid 3 colunas onde o card de variaveis fica ao lado de TUDO (informacoes basicas + editor). A mudanca move o card de variaveis para dentro da secao "Conteudo do Documento", lado a lado com o editor TipTap, garantindo que fiquem sempre juntos.

```text
ANTES:
+----------------------------+  +-----------+
| Informacoes Basicas        |  | Variaveis |
+----------------------------+  |           |
| Conteudo do Documento      |  |           |
| [Editor TipTap]            |  |           |
+----------------------------+  +-----------+

DEPOIS:
+---------------------------------------------+
| Informacoes Basicas                         |
+---------------------------------------------+
| Conteudo do Documento                       |
| +------------------------+  +-------------+ |
| | Editor TipTap          |  | Variaveis   | |
| |                        |  | (draggable) | |
| +------------------------+  +-------------+ |
+---------------------------------------------+
```

### 2. Implementar Drag and Drop

Tornar cada variavel no `VariaveisSelector` arrastavel usando a API nativa de HTML5 Drag and Drop (sem dependencia extra):

- Cada item de variavel recebe `draggable="true"` e `onDragStart` que seta o texto `{{variavel}}` no dataTransfer
- O editor TipTap ja suporta drop de texto por padrao - ao soltar, o conteudo e inserido na posicao do cursor
- Adicionar feedback visual (cursor grab, opacidade ao arrastar)

### Detalhes tecnicos

**Arquivo: `src/pages/documentos/TemplateForm.tsx`**
- Remover o grid `lg:grid-cols-3` externo
- Mover o `VariaveisSelector` para dentro do card "Conteudo do Documento", usando um grid interno `grid-cols-[1fr_280px]`
- O card de "Informacoes Basicas" fica full-width acima

**Arquivo: `src/components/documentos/VariaveisSelector.tsx`**
- Adicionar `draggable="true"` em cada item de variavel
- Adicionar `onDragStart` handler que seta `e.dataTransfer.setData('text/plain', '{{codigo}}')`
- Adicionar classes de cursor e feedback visual (`cursor-grab`, `active:cursor-grabbing`, `opacity-50` durante drag)
- Manter o clique "Inserir" funcionando como antes

**Arquivo: `src/components/documentos/TemplateEditor.tsx`**
- Adicionar `handleDrop` no editorProps para interceptar o drop e inserir o conteudo como variavel chip na posicao correta
- Adicionar `handleDragOver` para permitir o drop (`e.preventDefault()`)

