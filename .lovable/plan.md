

## Análise

### 1. Atribuição da tarefa — JÁ FUNCIONA ✅

Verifiquei no banco e no código:
- O modal grava em `agendamentos_base.atendido_por` + `status='confirmado'` (CalendarioDiaModal linhas 147-207).
- A RPC `buscar_tarefa_atual_profissional` faz `UNION ALL` lendo `agendamentos_base` onde `atendido_por = profissional_id` AND `status IN ('confirmado','em_andamento')` AND `data_agendada = CURRENT_DATE`.
- O hook `useTarefaAtualServico` chama essa RPC com `refetchInterval: 30s`. WhatsApp `servico_atribuido_v1` é disparado.
- Confirmado no banco: a vistoria de `ADRIANO RODRIGUES FERNANDES` (10:00) está com `atendido_por = b13574a9...` (Kleytonn) e `status=confirmado` para hoje. **Ela aparecerá no painel do técnico.**

Nada a alterar nesse fluxo.

### 2. Cor amarela para técnicos em execução — PRECISA AJUSTE

Em `MapaVistoriasContent.tsx` (linha 766), todo marker de técnico usa `COR_VISTORIADOR` (azul) fixo, independente do `status_operacional`. O `status_operacional` já é calculado corretamente em `useVistoriadoresRealtime` (`em_andamento`, `em_rota`, `em_contato`, `disponivel_operacional`).

## Mudança única

### `src/components/mapa/MapaVistoriasContent.tsx`

- Definir mapa de cores por status:
  - `em_andamento` → **`#F59E0B` (amarelo/âmbar)** — "Realizando Tarefa"
  - `em_rota` → mantém `COR_VISTORIADOR` (azul) — vai a caminho
  - `em_contato` → âmbar claro `#FCD34D` (opcional, manter azul se preferível)
  - `disponivel_operacional` → verde `#22C55E`
- Passar essa cor para `getVistoriadorIconWithBadge(corStatus, taskCount)` na linha 766.
- Ajustar a key do Marker para incluir o status (forçar re-render quando mudar).
- Atualizar a legenda (linha ~1012) para mostrar as 3 cores: Em execução (amarelo), Em rota (azul), Disponível (verde).

Nada mais será alterado. A linha de rota (`RotaPolyline`) e os ícones dos serviços permanecem como estão.

