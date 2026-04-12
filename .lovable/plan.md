

## Plano: Corrigir modal de edição de cobertura/benefício

### Problemas identificados
1. **Rolagem lateral**: O modal permite scroll horizontal quando o conteúdo é largo demais
2. **Botão X não é fixo**: O X de fechar está `absolute` dentro do container com `overflow-y-auto`, então ele rola junto com o conteúdo
3. **Clicar fora não fecha**: `onInteractOutside={(e) => e.preventDefault()}` está bloqueando o fechamento

### Alterações

**1. `src/components/gestao-comercial/LinhasPlanos.tsx` (linha 848)**
- Remover `onInteractOutside={(e) => e.preventDefault()}` do modal de edição (e do de elegibilidade, linha 875)
- Adicionar `overflow-x-hidden` à classe do DialogContent

**2. `src/components/ui/dialog.tsx` (linha 45)**
- Mudar o botão X de `absolute` para `sticky` com `top-0` e `z-10`, para que ele permaneça visível ao rolar o conteúdo do modal
- Ajustar o layout para que o botão sticky funcione corretamente (mover para antes do `{children}` e adicionar `float-right` ou wrap com flex)

Abordagem alternativa mais segura para o X sticky (evita quebrar outros modals):
- Manter `absolute` no dialog.tsx global
- Nos dois modals específicos, trocar `overflow-y-auto` do DialogContent por uma estrutura com header fixo + body scrollável interno

**Estrutura proposta para os modals específicos:**
```text
DialogContent (overflow-hidden, sem scroll)
  ├─ DialogHeader (sticky/fixo no topo)
  ├─ div.overflow-y-auto.overflow-x-hidden (conteúdo scrollável)
  │   └─ CoberturaInlineForm / BeneficioInlineForm / EligibilityRulesEditor
  └─ X button permanece absolute no canto (visível pois o pai não scrolla)
```

### Resultado
- Sem rolagem horizontal
- Botão X sempre visível
- Clicar fora fecha o modal

