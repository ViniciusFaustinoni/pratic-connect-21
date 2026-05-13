## Causa raiz

Reproduzi o caso da ANA CAROLINA (placa RJH6G17) no banco. A linha do tempo é:

```text
12/05 11:52  servicos 18dcc8fb criado (instalação RJH6G17, status=agendada, técnico Wallace)
12/05 15:07  REABERTO->FILA (reabertura_pos_cancelamento)  → status=agendada
13/05 11:01  REALOCADO->BASE  → KLEYTONN realoca pra base "Praticcar"
             ↳ realocar_servico marca servicos.status = 'cancelada'
             ↳ marca instalacoes.status = 'cancelada'
             ↳ cria nova agendamentos_base (b1206de1, 14:00, status=agendado)
13/05 14:56  KLEYTONN confirma o agendamento_base e atribui Wallace
             ↳ só atualiza agendamentos_base.atendido_por = Wallace
             ↳ NÃO toca em servicos (que segue cancelada)
             ↳ NÃO toca em instalacoes (que segue cancelada)
```

Resultado: o serviço "sumiu" da fila de tarefas do Wallace porque a linha em `servicos` continua `cancelada`. A única coisa viva é a `agendamentos_base`, e só telas que olham essa tabela enxergam algo.

Dois bugs encadeados:

1. **`public.realocar_servico` (destino=base)** — `_status_servico_final = 'cancelada'` e `_status_instalacao_final = 'cancelada'`. Realocar para base não é cancelar; é mudar o local de execução. Cancelar a `servicos` quebra a fila do técnico, o histórico, os triggers de status e a regra "um técnico pode ter vários serviços atribuídos".
2. **`useAtribuirServicoManual` (isBase=true)** — só faz `update agendamentos_base set atendido_por`. Não propaga o profissional para a `servicos` vinculada (via `instalacao_origem_id` / `vistoria_origem_id`), então a fila de tarefas do técnico (que lê `servicos`) nunca recebe a atribuição.

## Correção na raiz

### 1) Migration: reescrever `public.realocar_servico` (caso `_destino='base'`)

- `_status_servico_final := 'agendada'` (não mais `cancelada`).
- `_status_instalacao_final := 'agendada'` (não mais `cancelada`).
- `servicos.profissional_id` = NULL, `local_vistoria='base'`, `data_agendada=_data_alvo`, `periodo=_periodo_alvo`, `iniciada_em=NULL`, `em_rota_em=NULL`, `confirmacao_whatsapp=NULL`.
- `instalacoes` continua `agendada`, com `instalador_responsavel_id=NULL`, `data_agendada/periodo` atualizados.
- Mantém o `INSERT` no `agendamentos_base` (já existe) — esta é a "ordem de serviço da base".
- Mantém o dedupe que cancela agendamentos_base órfãos (placa/telefone iguais e `instalacao_id` distinto).
- Acao_historico continua "realocada_base"/"reaberta_base"; o log textual em `servicos.observacoes` continua sendo escrito.

Outros destinos (`fila`, `profissional`, `rota`) não mudam.

### 2) `src/hooks/useAtribuicaoManual.ts` → `useAtribuirServicoManual` (ramo `isBase`)

Após `update agendamentos_base set atendido_por, status='confirmado'`:

- Buscar o `agendamentos_base` que estamos atribuindo (`id, instalacao_id, vistoria_id, oficina_id, data_agendada, horario`).
- Localizar a `servicos` correspondente:
  - Se `instalacao_id`: `servicos where instalacao_origem_id = ag.instalacao_id and status not in ('concluida','aprovada','reprovada','aprovada_ressalvas')`.
  - Senão se `vistoria_id`: `servicos where vistoria_origem_id = ag.vistoria_id` (mesmo filtro).
- Se encontrada, atualizar:
  - `profissional_id = profissionalId`
  - `status = 'agendada'` (fica na fila do técnico — só vira `em_andamento` quando ele iniciar)
  - `local_vistoria = 'base'`
  - `data_agendada = ag.data_agendada`, `periodo` derivado de `ag.horario` (`< 12:00` → `manha`, senão `tarde`)
  - `rota_id = NULL`
- Atualizar também `instalacoes.instalador_responsavel_id = profissionalId` quando aplicável (espelha o vínculo).
- Em paralelo, atualizar `vistorias.vistoriador_id = profissionalId` quando o agendamento aponta para `vistoria_id`.

Manter o log `servicos_atribuicoes_log` e o WhatsApp como já estão.

### 3) Garantir que outros caminhos de atribuição base façam o mesmo

Auditar e aplicar o mesmo padrão (atualizar `servicos` vinculada quando atribui via `agendamentos_base.atendido_por`) em:

- `src/hooks/useFilaBaseHoje.ts` (auto-pega na base)
- `src/hooks/useAlterarEnderecoTipo.ts`
- `src/components/monitoramento/CalendarioDiaModal.tsx` (atribuirMutation)

Centralizar num helper `vincularProfissionalAoServicoDoAgendamentoBase(agendamentoId, profissionalId)` para evitar regressão.

### 4) Correção pontual dos dados da ANA CAROLINA (RJH6G17)

Via `INSERT/UPDATE` (não migration):

- `servicos 18dcc8fb-ea3a-4fce-9b80-59141a81f451` →
  `status='agendada'`, `profissional_id='f6313b28… (WALLACE NUNES)'`, `local_vistoria='base'`,
  `data_agendada='2026-05-13'`, `periodo='tarde'`, `iniciada_em=NULL`, `em_rota_em=NULL`,
  acrescentar em `observacoes` nota `[CORREÇÃO] Restaurado para fila do Wallace após bug de realocação para base`.
- `instalacoes 1a98a673…` → `status='agendada'`, `instalador_responsavel_id=Wallace`,
  `data_agendada='2026-05-13'`, `periodo='tarde'`.
- Confirmar `agendamentos_base b1206de1…` permanece `status='confirmado'`, `atendido_por=Wallace`.
- Registrar entrada em `logs_auditoria` descrevendo a correção manual.

### 5) Validação como diretor

Após deploy, logar com `admin@teste.com / 123456789123456789`:

1. Abrir fila de tarefas do Wallace e confirmar que a Vistoria/Instalação RJH6G17 (Honda CG 160 Fan, ANA CAROLINA) aparece como pendente, na base.
2. Em `/monitoramento/vistorias-instalacoes-mon`, atribuir um agendamento_base de teste a um técnico que já tem outro serviço — confirmar que o segundo serviço entra como `agendada` (fila), não substitui o em andamento.
3. Realocar um serviço em rota para a base e validar que ele continua visível e atribuível, sem `servicos` cancelado.

## Detalhes técnicos

- Status enums em uso (`status_servico`, `status_instalacao`) já incluem `agendada` — sem mudança de tipo.
- Nenhum trigger atual escreve `cancelada` em cascata na `servicos` a partir de `instalacoes` (verificado: o cancelamento foi escrito explicitamente pela própria `realocar_servico`). Manter `instalacoes.status='agendada'` é seguro.
- Idempotência da realocação repetida para base preservada: o dedupe na `agendamentos_base` continua e o `INSERT` cria sempre uma nova ordem de base; a `servicos` segue única e viva.
- Memória de projeto a registrar:
  `mem://logic/operations/realocacao-base-preserva-servico` — Realocação para base NÃO cancela `servicos`/`instalacoes`; apenas muda `local_vistoria='base'`, zera profissional e cria nova `agendamentos_base`. Atribuição via `agendamentos_base.atendido_por` SEMPRE espelha `profissional_id` na `servicos` vinculada (status `agendada`, fila do técnico).
