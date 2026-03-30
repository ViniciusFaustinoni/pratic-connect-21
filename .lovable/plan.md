

# Fix: Cards de Aprovação não aparecem na lista

## Problema
O contador "Aguardando: 1" funciona, mas a lista de cards fica vazia. O registro existe no banco (serviço `9a40b7b5` com `status = concluida`, `cobertura_total = false`).

## Causa raiz
No hook `useInstalacoesAguardandoAprovacao`, a query usa `.order('concluido_em')` mas a coluna real na tabela `servicos` é **`concluida_em`**. O PostgREST retorna erro para coluna inexistente, fazendo a query falhar silenciosamente. A query de stats não usa `.order()` nessa coluna, por isso o contador funciona normalmente.

## Correção

### `src/hooks/useAprovacaoMonitoramento.ts` (linha 34)
Trocar `concluido_em` por `concluida_em`:
```
.order('concluida_em', { ascending: true })
```

Também verificar a referência a `concluido_em` na UI (`AcionamentosRouboFurto.tsx` linhas 135 e 178-180) — se o campo retornado é `concluida_em`, corrigir o acesso `servico.concluido_em` para `servico.concluida_em`.

| Arquivo | Ação |
|---|---|
| `src/hooks/useAprovacaoMonitoramento.ts` | Corrigir nome da coluna no `.order()` |
| `src/pages/monitoramento/AcionamentosRouboFurto.tsx` | Corrigir referências a `concluido_em` para `concluida_em` |

