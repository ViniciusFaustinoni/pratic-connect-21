## Frente 1 — Prova do gap (sem corrigir)

### 1. Vínculo serviço ↔ vistoria

`servicos` aponta para `vistorias` por duas colunas (origem do serviço):

- `servicos.vistoria_origem_id → vistorias.id` (serviço materializado a partir de uma vistoria — fluxo sub-FIPE, autovistoria, vistoria base).
- `servicos.instalacao_origem_id → instalacoes.id`, e a vistoria correspondente fica em `vistorias` apontando para a mesma instalação via `vistorias.instalacao_id` (fluxo instalação + vistoria — caso TTA5H86 / SSA3G29).

Ou seja: dado um `servicos.id` aprovado, sempre dá pra resolver a `vistorias.id` correspondente por um dos dois caminhos.

### 2. Por que a aprovação NÃO promove a vistoria

O fluxo de aprovação do Monitoramento mexe só em `servicos`, nunca em `vistorias`:

- `src/hooks/useAprovacaoMonitoramento.ts:260-272` — único UPDATE direto da decisão:
  ```ts
  await supabase.from('servicos').update({
    status: 'aprovada',
    analisado_em: agora,
    analisado_por: profile?.id,
    ...
  }).eq('id', data.servicoId);
  ```
  Depois chama `ativar-associado` (promove associado/contrato/veículo) e enfileira SGA. **Nenhuma linha atualiza `vistorias`.**

- Triggers existentes só operam na direção **oposta** (vistoria → serviço):
  - `sync_servico_on_vistoria_decisao` — `AFTER UPDATE ON vistorias` quando `status` vai pra terminal, propaga pra `servicos` / `agendamentos_base` / `instalacoes`.
  - `fn_sync_vistoria_to_servico` — `AFTER INSERT/UPDATE ON vistorias`, cria/atualiza `servicos`.
  - `fn_vistoria_video_360_promove_concluida` — UPDATE em `vistorias` quando vídeo 360° chega.
  - `fn_agendamento_base_materializa_servico` — cria serviço a partir de agendamento.

  **Não existe** trigger `AFTER UPDATE ON servicos` que espelhe a decisão em `vistorias`.

- Resultado prático: `servicos.status='aprovada'` + `vistorias.status='agendada'`. Foi exatamente o estado de TTA5H86 e SSA3G29 antes da migration manual.

### 3. Caminhos de criação afetados (onde o gap aparece)

| Caminho de aprovação | Atualiza `servicos`? | Atualiza `vistorias`? | Gap? |
|---|---|---|---|
| `useAprovacaoMonitoramento` (Aprovação de Associados — caminho canônico) | sim → `aprovada` | **não** | **sim** ← origem do bug |
| `aplicar-conclusao-vistoria` (link prestador, técnico/instalador) | sim → `concluida` (linhas 73-78) | sim → `aprovada` (linhas 57-62) | não |
| `aprovar-troca-monitoramento` | só insere novo serviço de manutenção | não toca status da vistoria existente | escopo diferente (não é aprovação final) |
| `concluir-vistoria-prestador` / `concluir-instalacao-prestador` | sim | sim (caminhos próprios) | não |

Conclusão: o gap está concentrado no **único** caminho usado pela fila Monitoramento › Aprovação de Associados (`useAprovacaoMonitoramento` → `ativar-associado`). É exatamente o caminho pelo qual TTA5H86 e SSA3G29 passaram.

### 4. Implicações pra Frente 2

A "vistoria elegível" que a Frente 2 vai exigir como condição pro veículo ser concluído precisa olhar `vistorias.status` (não `servicos.status`), porque é em `vistorias` que o status hoje fica preso em `agendada`. Sem corrigir a Frente 1 primeiro, a trava da Frente 2 vai disparar falso-positivo em todo caso aprovado pelo Monitoramento.

---

### O que NÃO está nesta etapa

- Nenhuma alteração de código ou schema.
- Nada retroativo.
- A correção (gatilho ou patch na edge `ativar-associado` / hook) entra **só depois** da sua aprovação desta prova.

Aprova a prova? Em seguida proponho a correção (provavelmente trigger `AFTER UPDATE ON servicos` quando vai pra `aprovada`/`aprovada_ressalvas` espelhando em `vistorias` via `vistoria_origem_id` ou `instalacao_origem_id`, mais update explícito no hook como cinto-e-suspensório — confirmo qual é mais limpo na etapa de escrita).
