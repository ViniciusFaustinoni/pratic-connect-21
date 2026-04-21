

## Plano de correção — Auditoria Instalador/Técnico × Serviços

Plano executivo dividido em 4 fases, do bloqueante crítico ao saneamento. Cada fase é independente e pode ser aprovada/executada isoladamente.

---

### Fase 1 — CRÍTICO: Corrigir fluxo de Retirada (edge functions quebradas)

**Problema**: `confirmar-retirada` e `gerar-link-retirada` operam sobre `ordens_servico` (tabela vazia) e tentam gravar status `entregue` / `em_garantia` que não existem no enum `status_ordem_servico`. O fluxo real de retirada de rastreador hoje vive em `servicos.tipo = 'vistoria_retirada'` (vide `useCriarRetirada`).

**Ação**:
1. **Marcar como deprecated** as edge functions `gerar-link-retirada` e `confirmar-retirada` (manter como no-op que retorna 410 Gone com mensagem "Fluxo migrado para servicos") até confirmar que ninguém mais as invoca.
2. **Buscar todos os call sites** dessas funções (`supabase.functions.invoke('gerar-link-retirada' | 'confirmar-retirada')`) e removê-los/redirecioná-los para o fluxo de `servicos`.
3. **Documentar** no `mem://` que retirada agora é exclusivamente via `servicos.tipo='vistoria_retirada'`.

---

### Fase 2 — Integridade de dados (triggers + backfill)

**Problemas detectados**:
- `servicos` com `status='concluida'` sem `concluida_em` preenchido.
- Vistorias de manutenção concluídas sem `profissional_id`.
- Registros órfãos em `servicos_pendentes_rota` (IDs/datas nulos).

**Ação**:
1. **Trigger `BEFORE UPDATE` em `servicos`**: se `NEW.status='concluida' AND NEW.concluida_em IS NULL`, setar `NEW.concluida_em = now()`. Se `profissional_id IS NULL`, bloquear ou logar warning.
2. **Backfill** registros existentes: `UPDATE servicos SET concluida_em = updated_at WHERE status='concluida' AND concluida_em IS NULL`.
3. **Limpar órfãos** em `servicos_pendentes_rota` com IDs/datas nulos (DELETE WHERE servico_id IS NULL OR data_agendada IS NULL).
4. **Constraint NOT NULL** em `servicos_pendentes_rota.servico_id` e `data_agendada` para prevenir reincidência.

---

### Fase 3 — Saneamento de leituras legadas

**Problema**: Após Fase corrigida em `useEquipe`, ainda há componentes lendo de `instalacoes` e `vistorias` (legadas). Auditar e migrar:

**Ação**:
1. `grep` por `from('instalacoes')` e `from('vistorias')` em `src/`.
2. Para cada hit em hooks/componentes ativos do fluxo monitoramento/equipe/serviços, migrar para `servicos` com filtro de `tipo` apropriado (`vistoria_instalacao`, `vistoria_manutencao`, `vistoria_retirada`).
3. Não tocar em telas de relatórios históricos que dependem de dados antigos.

**Específicos já mapeados**:
- `EquipeCard.tsx` (modais de detalhes do profissional)
- Modais de "ver serviços" do profissional

---

### Fase 4 — Refinamento de métrica "Tarefas hoje"

**Problema**: Contador X/10 inclui `nao_compareceu` e `reagendada`, inflando o numerador (parece que o instalador "fez" tarefas que na verdade falharam).

**Ação**:
1. Em `useEquipe.ts`, separar em **3 contadores** no objeto retornado:
   - `tarefas_hoje_total` (todas, incluindo nao_compareceu/reagendada) — usado para "carga do dia"
   - `tarefas_hoje_concluidas` (status='concluida')
   - `tarefas_hoje_pendentes` (agendada/em_rota/em_andamento)
2. Atualizar `EquipeCard` para exibir formato `concluídas / pendentes / capacidade` (ex: "3 ✓ · 2 ⏳ / 10").
3. Manter retrocompatibilidade do campo `tarefas_hoje` (= concluidas + pendentes, sem falhas).

---

### Critérios de aceitação globais

1. Nenhuma chamada ativa às funções `gerar-link-retirada` / `confirmar-retirada` no frontend.
2. `servicos` concluídos sempre têm `concluida_em` preenchido (verificável por query).
3. Cards de equipe refletem com precisão: concluídas vs pendentes vs falhas separadamente.
4. Sem regressão visual em mapa de monitoramento, agendamento, ou modais de profissional.

### Fora de escopo

- Reativar heartbeat de geolocalização do app móvel (depende do app, não do web).
- Investigar por que automação de `reagendamento_token` não dispara em no-shows (auditoria separada do worker de cron).
- Drop das tabelas legadas `instalacoes` / `vistorias` (fase futura, após confirmação de zero leituras).

### Sugestão de execução

Recomendo aprovar **Fase 1 isolada primeiro** (é a única bloqueante). Fases 2-4 podem ser aprovadas em conjunto depois, ou separadas conforme prioridade.

