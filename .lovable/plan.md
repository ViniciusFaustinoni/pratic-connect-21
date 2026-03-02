

# Auto-detectar Variaveis Digitadas no Editor

## Problema

Atualmente, ao digitar `{{associado.nome}}` manualmente no editor TipTap, o texto permanece como texto puro. A conversao para chip visual so acontece no carregamento inicial do conteudo (via `convertPlainTextToHTML`). O usuario precisa arrastar a variavel do painel lateral para que ela apareca como chip.

## Solucao

Adicionar uma **Input Rule** ao TipTap que detecta o padrao `{{...}}` em tempo real enquanto o usuario digita. Quando o usuario fecha as chaves duplas (`}}`), o texto digitado e automaticamente substituido por um chip visual.

## Alteracao

### Arquivo: `src/components/documentos/tiptap/VariableChip.tsx`

Adicionar o metodo `addInputRules()` dentro do `VariableChipExtension.create()`:

- Importar `inputRuleFromRegex` (ou usar `InputRule` do `@tiptap/core`)
- Criar uma Input Rule com regex `/\{\{([^}]+)\}\}\s$/` que:
  1. Captura o texto entre `{{ }}` quando o usuario digita um espaco ou fecha as chaves
  2. Deleta o texto bruto correspondente
  3. Insere um node `variableChip` com o label `{{captura}}`

A regex usara `\{\{([^}]+)\}\}$` (sem exigir espaco apos) para converter imediatamente ao fechar `}}`.

### Detalhes tecnicos

```
addInputRules() {
  return [
    new InputRule({
      find: /\{\{([^}]+)\}\}$/,
      handler: ({ state, range, match }) => {
        const label = `{{${match[1].trim()}}}`;
        const { tr } = state;
        tr.replaceWith(range.from, range.to, 
          this.type.create({ label })
        );
      },
    }),
  ];
}
```

Sera necessario importar `InputRule` de `@tiptap/core`.

Nenhum outro arquivo precisa ser alterado -- a logica fica inteiramente dentro da extensao existente.
