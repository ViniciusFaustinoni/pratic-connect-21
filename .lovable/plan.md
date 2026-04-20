
## Corrigir na raiz o bug de “Tarefa Atual” presa por vistoria órfã

### Diagnóstico
Já existe uma correção parcial no projeto, mas ela ainda não fecha o problema na origem:

- A app do técnico depende da RPC `buscar_tarefa_atual_profissional` para decidir qual serviço exibir como “Tarefa Atual”.
- Hoje essa RPC ainda considera qualquer `servicos` em `agendada`, `em_rota`, `em_andamento` ou `em_analise`, sem bloquear o caso em que existe uma `vistoria_entrada` antiga/orfã e já foi criada uma `instalacao` posterior para o mesmo veículo/associado.
- O trigger `sync_vistoria_to_servicos()` já tenta evitar duplicidade por `(associado_id, veiculo_id, contrato_id)`, mas ainda pode apenas “grudar” uma nova vistoria em um serviço ativo existente, sem encerrar explicitamente a vistoria de entrada órfã.
- O fluxo de criação de instalação (`aprovar-proposta` + trigger `sync_instalacao_to_servicos`) cria corretamente a instalação em `servicos`, porém não elimina a vistoria antiga concorrente.
- Resultado: a RPC continua priorizando a vistoria órfã e o técnico fica preso nela, gerando cards com tempo inflado e, em alguns casos, falha ao abrir a execução.

### O que será implementado

#### 1. Blindagem da RPC de tarefa atual
Atualizar `public.buscar_tarefa_atual_profissional` para ignorar serviços órfãos antes do ranking final.

Regras novas para excluir da “Tarefa Atual”:
- `vistoria_entrada` em `agendada`/`em_analise`/`em_rota` sem `iniciada_em`
- que possua, para o mesmo `(associado_id, veiculo_id)`, uma `instalacao` posterior em status relevante (`agendada`, `em_rota`, `em_andamento`, `concluida`, `aprovada`, `aprovada_ressalvas`, `nao_compareceu`, `reagendada`)
- e/ou cujo `contrato_id` já esteja ativo, mostrando que a vistoria inicial deixou de ser a tarefa válida

Efeito:
- a vistoria órfã deixa de bloquear técnico
- `useTarefaAtual`, `useTarefaAtualServico`, `useTemTarefaEmExecucao` e o polling de `useIniciarServico` passam a receber a tarefa correta sem mudar a UI

#### 2. Correção estrutural no trigger de materialização de vistoria
Reforçar `public.sync_vistoria_to_servicos()` para não manter aberta uma vistoria de entrada que perdeu validade operacional.

Ajustes:
- antes de criar/vincular serviço de `vistoria_entrada`, verificar se já existe `instalacao` ativa/posterior para o mesmo `(associado_id, veiculo_id, contrato_id/cotacao_id)`
- se existir, não criar novo `servico` concorrente de vistoria
- se houver serviço órfão de vistoria já existente e não iniciado, atualizá-lo para um estado terminal seguro (`cancelada`) com observação automática indicando substituição por instalação posterior

Isso impede reincidência mesmo quando a origem vier de:
- `agendamentos_base`
- vistoria materializada pelo mapa
- aprovação de proposta que já gera instalação

#### 3. Correção estrutural no trigger de instalação
Reforçar `sync_instalacao_to_servicos()` ou criar helper dedicado chamado pelo trigger de instalação para cancelar automaticamente `vistoria_entrada` aberta e não iniciada do mesmo veículo/associado no momento em que a instalação é criada.

Regra:
- ao inserir instalação, procurar `servicos` do tipo `vistoria_entrada`
- limitar aos status abertos (`agendada`, `em_analise`, opcionalmente `em_rota` se não iniciada)
- nunca cancelar se a vistoria já tiver `iniciada_em`
- anexar observação de auditoria automática

Isso fecha a brecha antes mesmo de a RPC precisar filtrar.

#### 4. Backfill de dados para limpar órfãos já existentes
Criar uma migration de saneamento para:
- localizar `vistoria_entrada` órfãs já abertas
- cancelar automaticamente apenas as que forem claramente substituídas por instalação posterior
- preservar casos legítimos em andamento

Critérios conservadores:
- mesma combinação `(associado_id, veiculo_id)`
- vistoria não iniciada
- instalação posterior existente
- status aberto de vistoria

#### 5. Visão de monitoramento para o coordenador
Adicionar uma view `v_tarefas_orfas` para listar rapidamente casos futuros, com colunas como:
- `servico_vistoria_id`
- `associado_id`
- `veiculo_id`
- `placa`
- `data_agendada_vistoria`
- `servico_instalacao_relacionado`
- `motivo_orfandade`

Isso permite auditoria contínua sem depender de relatos do técnico.

### Arquivos e áreas impactadas

**Banco / migrations**
- nova migration para recriar `buscar_tarefa_atual_profissional`
- nova migration para reforçar `sync_vistoria_to_servicos`
- nova migration para reforçar `sync_instalacao_to_servicos` ou criar helper de cancelamento
- nova migration de backfill/saneamento
- nova migration com view `v_tarefas_orfas`

**Código sem mudança funcional grande**
- `src/hooks/useTarefaAtual.ts`
- `src/hooks/useServicos.ts`
- `src/hooks/useIniciarServico.ts`

Esses arquivos devem continuar iguais ou só receber ajustes mínimos se a tipagem da RPC mudar.

### Detalhes técnicos
```text
Origem do bug
vistorias/agendamentos_base -> sync_vistoria_to_servicos -> servicos(vistoria_entrada aberta)
aprovar-proposta/instalacoes -> sync_instalacao_to_servicos -> servicos(instalacao aberta)
buscar_tarefa_atual_profissional -> escolhe a vistoria antiga por ranking/status
UI do técnico -> fica presa na tarefa errada
```

```text
Defesa final em camadas
1) trigger da instalação encerra vistoria órfã
2) trigger da vistoria evita criar concorrência inválida
3) RPC ignora qualquer órfã remanescente
4) view monitora exceções
```

### Validação
1. Reproduzir um caso como Rafael/KYS4C01 ou Venilton/HAT3D43:
   - com vistoria órfã + instalação posterior
   - a “Tarefa Atual” deve mostrar a tarefa válida ou nenhuma tarefa
2. Confirmar que o técnico não vê mais card com tempo inflado por serviço morto.
3. Abrir a execução da tarefa retornada pela RPC e validar que carrega normalmente.
4. Criar em teste uma `vistoria_entrada` e depois uma `instalacao` para o mesmo veículo:
   - a vistoria aberta deve ser cancelada automaticamente se não iniciada
5. Verificar que vistorias legítimas em andamento não são canceladas.
6. Consultar `v_tarefas_orfas` e garantir que os casos antigos saneados desaparecem ou ficam claramente rastreáveis.
