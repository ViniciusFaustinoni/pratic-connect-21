
# Plano: Corrigir Edge Function de Atribuição Automática

## Problema Identificado

A Edge Function `atribuir-proxima-tarefa` está **completamente quebrada** com o seguinte erro:

```
SyntaxError: Identifier 'hoje' has already been declared
at file:///atribuir-proxima-tarefa/index.ts:273:11
```

**Causa**: A variável `hoje` foi declarada duas vezes no mesmo escopo:
- Linha 214: `const hoje = new Date().toISOString().split('T')[0];`
- Linha 357: `const hoje = new Date().toISOString().split('T')[0];`

## Impacto

| Funcionalidade | Status |
|----------------|--------|
| Vistoriador solicitar próxima tarefa | **QUEBRADO** |
| Atribuição automática via CRON | Funcionando |
| Iniciar rota para tarefa atribuída | **QUEBRADO** |

Isso explica por que o vistoriador não consegue receber tarefas automaticamente ao solicitar - a função nem sequer carrega.

## Solução

Remover a segunda declaração de `hoje` na linha 357, pois a variável já foi declarada na linha 214 e está disponível no mesmo escopo.

### Arquivo a Modificar

**`supabase/functions/atribuir-proxima-tarefa/index.ts`**

### Mudança

```text
ANTES (linha 357):
const hoje = new Date().toISOString().split('T')[0];
const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];

DEPOIS:
// hoje já foi declarado na linha 214
const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];
```

## Verificação Adicional

Após a correção, verificar se há outros lugares no código com declarações duplicadas de variáveis.

## Testes

1. Verificar que a Edge Function carrega sem erros
2. Testar a atribuição automática ao solicitar próxima tarefa
3. Confirmar que o vistoriador recebe tarefas corretamente

## Impacto da Correção

- Restauração imediata da funcionalidade de atribuição automática interativa
- Vistoriadores poderão solicitar próximas tarefas novamente
- Sistema voltará a funcionar como projetado

## Detalhes Técnicos

O erro ocorre porque o JavaScript/TypeScript não permite re-declarar uma variável `const` no mesmo escopo. A solução é simplesmente reutilizar a variável `hoje` que já foi declarada anteriormente no mesmo bloco de código.
