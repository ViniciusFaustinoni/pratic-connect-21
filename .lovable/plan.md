

# Fix: App do Instalador vazio — RPC quebrada

## Causa Raiz

A função RPC `buscar_tarefa_atual_profissional` referencia a coluna `s.etapa_atual` que **não existe** na tabela `servicos`. Isso causa um erro SQL silencioso — a função retorna vazio em vez dos dados da tarefa.

O serviço do Marcus (id `2884e1f1`) **está corretamente atribuído** ao `[TESTE] Vistoriador` com status `em_rota`, mas a RPC falha ao ser chamada, e o app mostra "Nenhuma tarefa ativa".

## Correção

### 1. Adicionar coluna `etapa_atual` à tabela `servicos`

```sql
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS etapa_atual integer DEFAULT 1;
```

Isso corrige a RPC sem precisar alterá-la. A coluna `etapa_atual` já é usada no código do hook (`useTarefaAtual.ts` linha 99), então faz sentido que ela exista.

### Resumo
- **1 migration SQL**: adicionar coluna `etapa_atual` na tabela `servicos`
- **0 arquivos de código alterados** — o hook e a RPC já estão corretos, só faltava a coluna

