

# Corrigir Tarefa Negada Persistindo na Tela do Vistoriador

## Diagnostico

Dois problemas identificados:

### 1. Query key incorreta na invalidacao (BUG PRINCIPAL)
Quando o instalador nega um veiculo, o hook `useRecusarVeiculoServico` (em `useServicos.ts` linha 1189) invalida a query `['tarefa-atual-servico']`. Porem, o dashboard do instalador usa `useTarefaAtual` (de `useTarefaAtual.ts`) que registra a query como `['tarefa-atual']` — **chave diferente**. Resultado: o cache antigo persiste e a tarefa negada continua aparecendo ate o proximo refetch automatico (30s).

### 2. Nao dispara busca da proxima tarefa apos negativa
Apos negar o veiculo, o sistema deveria chamar `atribuir-proxima-tarefa` para liberar o profissional e buscar o proximo servico, mas isso nao acontece. O profissional fica "ocioso" sem receber nova atribuicao.

## Correcoes

### Arquivo 1: `src/hooks/useServicos.ts` (~linha 1186-1191)
No `onSuccess` de `useRecusarVeiculoServico`:
- Adicionar invalidacao de `['tarefa-atual']` (a query usada pelo dashboard)
- Chamar `supabase.functions.invoke('atribuir-proxima-tarefa')` com a geolocalizacao atual do profissional, para liberar e atribuir proxima tarefa automaticamente

### Arquivo 2: `src/hooks/useVistoriaCompleta.ts` (~hook `useRecusarVeiculoVistoria`)
- Mesmo fix: adicionar invalidacao de `['tarefa-atual']` no onSuccess
- Chamar `atribuir-proxima-tarefa` apos negativa

## Resultado
- Tarefa negada desaparece imediatamente da tela do vistoriador
- Profissional fica disponivel para receber nova tarefa automaticamente

