<final-text>Plano de correção urgente para que tarefas “tipo base” atribuídas/reatribuídas manualmente pelo calendário apareçam e sejam executáveis na tela do técnico.</final-text>

## Diagnóstico confirmado

O problema urgente não está mais na criação do `servicos`. O banco já mostra a tarefa do Adriano materializada e atribuída ao Kleyton em `servicos`.

A regressão atual está em 2 pontos:

1. **RPC quebrada**
   - A migração `20260416160702_...` alterou `buscar_tarefa_atual_profissional` para incluir `agendamentos_base`.
   - O `ORDER BY` usa `status` de forma ambígua dentro da função PL/pgSQL.
   - Resultado: a RPC falha, e `useTarefaAtual()` não consegue carregar a tarefa do técnico.

2. **Mesmo corrigindo a SQL, o desenho atual ainda é incorreto**
   - A RPC passou a retornar uma pseudo-tarefa de `agendamentos_base` (`tipo = 'vistoria_base'`, `id = agendamento_base.id`).
   - Mas a tela do técnico executa ações em cima de **`servicos.id`**.
   - Então “Iniciar rota”, “Iniciar tarefa” e navegação para execução quebram se a RPC devolver o item bruto da base em vez do serviço materializado.

## O que vou corrigir

### 1) Corrigir a RPC `buscar_tarefa_atual_profissional`
Criar uma nova migração para:

- remover a ambiguidade do `ORDER BY`
- parar de priorizar o registro cru de `agendamentos_base`
- **sempre priorizar o `servicos` materializado** quando ele existir
- manter fallback de base só se realmente não houver `servico` criado

Objetivo:
- o app do técnico sempre recebe um item acionável, com `id` de `servicos`

### 2) Endurecer o fluxo de atribuição/reatribuição no calendário
Em `src/components/monitoramento/CalendarioDiaModal.tsx`:

- após atribuir ou reatribuir técnico na base, invalidar também `['tarefa-atual']`
- manter as invalidações atuais
- se necessário, forçar atualização do vínculo materializado (`vistorias`/`servicos`) para não depender só do trigger em cenários antigos

### 3) Endurecer o fluxo da aba de atribuição manual
Em `src/hooks/useAtribuicaoManual.ts`:

- aplicar a mesma invalidação de `['tarefa-atual']`
- revisar o fluxo de base para garantir que a sincronização final atinja o `servicos` correto

### 4) Corrigir a tela de execução de vistoria para trabalhar com `servico_id`
Hoje `TarefaAtualCard` navega usando `tarefa.id`, que no fluxo correto é `servicos.id`.

Mas `src/pages/instalador/ExecutarVistoriaCompleta.tsx` ainda trata o parâmetro como `instalacaoId`.

Vou alinhar essa tela para usar o hook já existente baseado em serviço:
- `useVistoriaCompletaPorServico(...)`

Assim a tarefa base não só aparece, mas também abre corretamente para execução.

## Arquivos envolvidos

- `supabase/migrations/<nova_migracao>.sql`
- `src/components/monitoramento/CalendarioDiaModal.tsx`
- `src/hooks/useAtribuicaoManual.ts`
- `src/pages/instalador/ExecutarVistoriaCompleta.tsx`

## Resultado esperado

Após a correção:

- atribuir/reatribuir tarefa base no calendário do monitoramento
- a tarefa aparece imediatamente no `/instalador`
- também aparece em `/instalador/tarefas`
- “Iniciar rota” funciona
- abrir a execução da vistoria funciona
- sem regressão para instalações e vistorias normais

## Verificação que vou fazer depois da implementação

1. Reatribuir novamente o caso do Adriano para o Kleyton
2. Confirmar no banco:
   - `agendamentos_base.atendido_por`
   - `vistorias.vistoriador_id`
   - `servicos.profissional_id`
3. Entrar como técnico e validar:
   - Home
   - aba Tarefas
   - iniciar rota
   - abrir execução
4. Revalidar rapidamente uma instalação normal para garantir que não houve impacto colateral

## Observação técnica importante

O trigger criado antes foi útil e continua necessário, mas **não é mais o gargalo principal**.
O bloqueio urgente agora está na camada de leitura do app do técnico:
- RPC quebrada
- e retorno do registro errado (base crua em vez de `servicos`)

A correção mais segura é atacar primeiro essa camada de leitura, e só complementar com endurecimento leve nas invalidações/sincronização.