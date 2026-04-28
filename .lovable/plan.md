# Plano definitivo para corrigir a atribuição de serviços no monitoramento

## Achados confirmados
- A fila manual mostra apenas:
  - `servicos` com `profissional_id is null` e `status in ('pendente','agendada')`
  - `agendamentos_base` com `atendido_por is null` e `status in ('agendado','pendente')`
- O autoassign (`atribuir-proxima-tarefa`) também só considera `servicos` sem profissional com `status in ('pendente','agendada')`.
- Os casos citados estão fora desses filtros, por isso “sumiram” da fila:
  - `LTG3H67` → serviço `20810068-7282-4291-a1d1-55bb9e4ca96f` e instalação `82b36ad6-92cb-4429-99db-b696dc6e0af8` em `em_analise`, sem profissional
  - `LTS3A98` → serviço `5b0980bb-aa3b-4679-a8f5-0c8f5c86dc63` e instalação `3a3ce140-fd0b-4960-8bc4-7fbf3e3c8df4` em `em_analise`, sem profissional
- Há pelo menos mais 1 caso idêntico já ativo (`0KM91CD6`), então o problema é sistêmico e não isolado.
- O log funcional prova a regressão:
  - `LTS3A98` foi atribuído manualmente e depois devolvido; após isso terminou em `em_analise`
  - `LTG3H67` foi atribuído manualmente e depois também terminou em `em_analise`
- Não encontrei evidência de erro recente no Edge Function de autoatribuição. O problema principal é de estado no banco/sincronização, não de runtime.

## Causa raiz
Há uma combinação perigosa de 3 fatores:

1. A RPC `realocar_servico` passou a gravar `instalacoes.status = 'em_analise'` quando o destino é fila/base sem profissional.
2. A trigger `sync_instalacao_update_to_servicos()` propaga esse `em_analise` para `servicos.status`.
3. A UI e o autoassign ignoram `em_analise` para fila de atribuição.

Resultado:
```text
Realocação/devolução -> instalação vai para em_analise
                     -> trigger sincroniza serviço para em_analise
                     -> serviço sai da fila manual e da autoatribuição
                     -> limbo operacional
```

Além disso, existem triggers duplicadas e parcialmente sobrepostas em `servicos -> instalacoes`, o que aumenta o risco de regressão e estados ping-pong.

## O que será implementado

### 1) Corrigir a regra canônica de fila
Padronizar que serviço “aguardando atribuição” nunca use `em_analise`.

Regra operacional:
- Sem profissional e elegível para fila: `servicos.status = 'agendada'` ou `reagendada`
- Base: manter `local_vistoria = 'base'` + `agendamentos_base` como fonte da fila de base
- `em_analise` deixa de ser usado como estado de retorno para atribuição operacional

### 2) Corrigir a RPC `realocar_servico`
Ajustar a RPC para que:
- `destino='fila'` não grave mais `instalacoes.status = 'em_analise'`
- `destino='base'` também não empurre o serviço para limbo
- `servicos`, `instalacoes` e `agendamentos_base` terminem em estados compatíveis com os filtros reais da fila
- toda realocação escreva log consistente

### 3) Eliminar conflitos de sincronização
Revisar e consolidar as triggers/funções de sincronização:
- `sync_instalacao_update_to_servicos`
- `sync_servico_to_instalacao`
- `sync_servicos_to_instalacao`

Objetivo:
- remover sobreposição
- impedir regressão de status por efeito colateral
- definir um fluxo claro de sincronização para status operacionais

Direção proposta:
- `servicos` como fonte canônica da atribuição operacional
- `instalacoes` sincroniza apenas os campos realmente necessários de execução
- atualizações vindas de `instalacoes` não podem tirar um serviço elegível da fila sem regra explícita

### 4) Blindar o mapeamento de status
Ajustar `map_to_status_servico` e a lógica das triggers para que status internos de instalação não caiam em estados invisíveis para a fila por acidente.

Também vou revisar os caminhos que atualizam instalação/serviço fora da RPC principal para garantir que nenhum deles volte a gravar `em_analise` como estado de fila.

### 5) Reconciliar os dados já corrompidos
Executar uma correção de dados para restaurar os serviços em limbo.

Escopo mínimo já confirmado:
- `LTG3H67`
- `LTS3A98`
- `0KM91CD6`

Escopo completo:
- localizar todos os `servicos.tipo='instalacao'` com:
  - `profissional_id is null`
  - `status = 'em_analise'`
  - vínculo com instalação ativa
- recolocar esses registros no estado correto de fila
- reconstituir `agendamentos_base` quando aplicável

### 6) Criar monitoramento preventivo
Adicionar diagnóstico permanente para detectar automaticamente:
- serviço sem profissional em status fora da fila
- divergência `servicos.status` x `instalacoes.status`
- serviço/base sem registro correspondente
- itens que estavam atribuídos e ficaram sem técnico fora dos estados esperados

Isso pode ser exposto como query de auditoria e/ou card interno no monitoramento.

### 7) Validar fim a fim
Após a correção, validar os fluxos críticos:
- atribuir manualmente
- devolver à fila
- reatribuir
- realocar para base
- realocar para rota
- técnico iniciar execução
- item voltar a aparecer corretamente na aba de atribuição quando necessário

Casos obrigatórios de validação:
- `LTG3H67`
- `LTS3A98`

## Entregáveis
- Correção definitiva da RPC de realocação
- Consolidação/hardening das triggers de sincronização
- Backfill dos serviços atualmente em limbo
- Relatório final com os registros recuperados
- Checklist de validação dos fluxos de atribuição
- Mecanismo de detecção de novos limbos

## Detalhes técnicos
- Hoje o bug nasce porque o status `em_analise` é aceito no banco, mas não é aceito pela fila manual nem pela autoatribuição.
- Há acoplamento bidirecional entre `servicos` e `instalacoes`; isso precisa ser reduzido para evitar sobrescritas involuntárias.
- A correção não será só visual: inclui regra de negócio, sincronização e saneamento dos dados já afetados.

## Resultado esperado
Ao final:
- os serviços não voltarão a “sumir” da fila por troca indevida para `em_analise`
- os itens em limbo voltarão a ser atribuíveis
- a aba de serviços/monitoramento recuperará consistência entre fila, execução e histórico
- novos casos passarão a ser detectados antes de impactar a operação