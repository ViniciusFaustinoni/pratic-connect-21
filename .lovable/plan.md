

# Investigação: "Serviços: {{plano.descricao}}" no Termo de Filiação

## Diagnóstico

Após investigação completa:

1. **Nenhum template ativo no banco** contém "Serviços" ou "plano.descricao" — confirmado via query SQL direta na tabela `documento_templates`
2. **O template hardcoded** (`termo-afiliacao-template.ts`) também não contém esse bloco
3. **O componente frontend** (`TermoFiliacaoTemplate.tsx`) também não possui essa seção
4. **A regex de limpeza** já existe em `template-utils.ts` (linhas 153-162) como safety net

**Conclusão**: O bloco "Serviços: {{plano.descricao}}" foi adicionado manualmente ao template via editor TipTap em algum momento e provavelmente já foi removido. O documento na screenshot pode ter sido gerado com uma versão anterior do template.

## Problema residual encontrado

A regex de limpeza atual é **frágil** — só captura `<p>` tags e texto inline. Se o bloco "Serviços:" estiver dentro de uma `<table>`, `<div>`, `<td>`, ou com `<span>` interno, a regex falha silenciosamente.

## Plano de correção

### 1. Tornar a regex de limpeza mais robusta em `template-utils.ts`

Expandir a regex para capturar "Serviços:" em qualquer contexto HTML:
- Dentro de `<p>`, `<div>`, `<td>`, `<li>`
- Com `<span>`, `<em>`, ou outros elementos inline no meio
- Capturar toda a tag container até seu fechamento

### 2. Remover a variável `plano.descricao` do seletor de variáveis

Em `VariaveisSelector.tsx`, remover `plano.descricao` da lista de variáveis disponíveis no editor, já que é redundante com `plano.coberturas` e causa confusão ao gerar o bloco "Serviços:" indesejado.

### 3. Manter o mapeamento no backend por retrocompatibilidade

Manter `plano.descricao` no mapeamento de `template-utils.ts` para que, se existir em documentos antigos, seja substituída por um valor real em vez de aparecer como `{{plano.descricao}}`.

## Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/_shared/template-utils.ts` | Regex mais robusta para remover "Serviços:" em qualquer contexto HTML |
| `src/components/documentos/VariaveisSelector.tsx` | Remover `plano.descricao` da lista de variáveis disponíveis |

