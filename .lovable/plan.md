

## Diagnóstico: Fluxo de Atribuição de Vistorias Base

### Problemas Identificados

Há **3 bugs** interligados na atribuição de vistorias base:

#### 1. Log de atribuição falha silenciosamente
A tabela `servicos_atribuicoes_log` tem uma **FK** (`servico_id` -> `servicos.id`). Quando a mutation tenta inserir um log com o ID de um `agendamentos_base`, o INSERT falha porque esse UUID não existe na tabela `servicos`. O erro é capturado silenciosamente (`console.error`), então parece que funcionou, mas o log nunca é gravado. Confirmação: a query retornou **0 registros** de log para essas atribuições.

#### 2. Técnico nunca recebe a tarefa
A função RPC `buscar_tarefa_atual_profissional` (que alimenta a tela do técnico — "Você está ativo / Aguardando tarefas") consulta **apenas a tabela `servicos`**. Não existe nenhum trecho que busque tarefas em `agendamentos_base`. Então, mesmo após atribuir a vistoria base ao Wallace ou Kleytonn, o app do técnico continua mostrando "Aguardando tarefas" — ele nunca é notificado.

#### 3. Reatribuição não tem efeito visível
Reatribuir troca o `atendido_por` em `agendamentos_base` corretamente, mas como o técnico anterior nunca recebeu a tarefa (problema 2), e o novo técnico também não a recebe, a reatribuição parece não funcionar.

### Estado Atual dos Dados (16/04)
| Vistoria | Status | Atribuído a | Observação |
|----------|--------|-------------|------------|
| ADRIANO (RKO4F90, 10h) | `confirmado` | Kleytonn [teste] | Atribuição funcionou no banco, mas técnico não vê |
| LAIANE (RKL2G70, 15h) | `agendado` | Ninguém | Nunca foi atribuída |

### Plano de Correção

#### 1. Criar tabela de log compatível ou usar campo nullable
**Arquivo:** Nova migration SQL
- Adicionar coluna `agendamento_base_id UUID REFERENCES agendamentos_base(id)` na tabela `servicos_atribuicoes_log`
- Tornar `servico_id` nullable (ou usar uma constraint CHECK onde pelo menos um dos dois é NOT NULL)
- Assim, logs de atribuições base passam a funcionar

#### 2. Atualizar RPC `buscar_tarefa_atual_profissional` para incluir `agendamentos_base`
**Arquivo:** Nova migration SQL
- Adicionar um segundo SELECT via `UNION ALL` que busca em `agendamentos_base` onde `atendido_por = p_profissional_id` e `status IN ('confirmado', 'em_andamento')` e `data_agendada = CURRENT_DATE`
- Mapear os campos de `agendamentos_base` para o formato de retorno existente (tipo = 'vistoria_base', etc.)

#### 3. Adicionar notificação WhatsApp na atribuição via calendário
**Arquivo:** `src/components/monitoramento/CalendarioDiaModal.tsx`
- Na `atribuirMutation.mutationFn`, após o update, invocar `whatsapp-send-text` com os dados do agendamento (similar ao que já existe em `useAtribuirServicoManual`)

#### 4. Ajustar mutation de `useAtribuicaoManual.ts` para log correto
**Arquivo:** `src/hooks/useAtribuicaoManual.ts`
- Usar o novo campo `agendamento_base_id` ao inserir o log quando `isBase === true`, deixando `servico_id` como null

#### 5. Invalidar queries do técnico após atribuição
**Arquivos:** `CalendarioDiaModal.tsx` e `useAtribuicaoManual.ts`
- Adicionar invalidação de `['tarefa-atual-servico']` no `onSuccess` das mutations de atribuição base

### Arquivos Alterados

| Arquivo | Ação |
|---------|------|
| Nova migration SQL | Adicionar coluna `agendamento_base_id` no log; tornar `servico_id` nullable; atualizar RPC |
| `src/components/monitoramento/CalendarioDiaModal.tsx` | Adicionar WhatsApp + invalidar queries do técnico |
| `src/hooks/useAtribuicaoManual.ts` | Usar `agendamento_base_id` no log |

