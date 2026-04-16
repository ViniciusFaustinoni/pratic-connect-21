
## Diagnóstico

No popup do card da tarefa no mapa de monitoramento (`MapaVistoriasContent.tsx`), o coordenador hoje só tem: **Enviar Confirmação**, **WhatsApp** e **Google Maps**. Falta um botão para **reagendar** manualmente data/hora da vistoria.

## Investigação necessária (próxima rodada)

1. Confirmar estrutura do popup em `src/components/mapa/MapaVistoriasContent.tsx` — onde ficam os botões.
2. Identificar tabela alvo da reagendamento: `agendamentos_base` (data + hora_inicio/hora_fim) e/ou `vistorias.data_agendada` + `hora_agendada`.
3. Verificar se já existe modal/hook de reagendamento reaproveitável (ex: em `src/components/vistorias/`, `useReagendarVistoria`, fluxo do associado).
4. Conferir permissão: `canMonitoring` / role "Coordenador de Monitoramento" (memória `monitoring-coordinator-permissions`).
5. Checar se é preciso disparar WhatsApp de confirmação após reagendar (memória `automated-assignment-and-confirmation-logic`).

## Plano de implementação

### 1) Botão "Reagendar" no popup
Em `MapaVistoriasContent.tsx`, adicionar botão (ícone `CalendarClock`, variante outline) ao lado dos demais — só visível para quem tem permissão de monitoramento/coordenador.

### 2) Modal `ReagendarTarefaDialog`
Novo componente `src/components/mapa/ReagendarTarefaDialog.tsx`:
- Mostra dados atuais (associado, veículo, data/hora atual).
- Campos: nova data (input date), nova hora (select de slots ou input time), motivo (textarea opcional).
- Validação: data >= hoje, hora dentro do horário comercial.
- Botão "Confirmar reagendamento".

### 3) Hook `useReagendarTarefa`
Mutation que:
- Atualiza `agendamentos_base` (data, hora_inicio, hora_fim) **OU** `vistorias` (data_agendada, hora_agendada) conforme origem da tarefa.
- Atualiza `servicos.data_agendada`/`hora_agendada` se houver vínculo.
- Registra log em `servicos_atribuicoes_log` (ou tabela equivalente) com tipo `reagendamento_manual`, autor, motivo.
- Invalida queries: `mapa-vistorias`, `vistorias`, `agendamentos-base`, `fila-base-hoje`.
- Toast de sucesso + opção de disparar WhatsApp de reconfirmação ao associado.

### 4) WhatsApp de reconfirmação (opcional, marcado por padrão)
Reutilizar fluxo de `confirmação` já existente no popup, agora com a nova data/hora. Trigger via mesma edge function que o botão "Enviar Confirmação" usa.

### 5) Permissão / RLS
- UI: ocultar botão para quem não é coordenador/diretor (usar hook de permissões existente).
- RLS: garantir que role coordenador de monitoramento tem UPDATE em `agendamentos_base` e `vistorias` para os campos de data/hora. Se já tem (provável, pela memória), nada a fazer; senão, migration mínima.

## Não vou mexer

- Lógica de criação de vistoria/agendamento.
- Fluxo de execução (`ExecutarVistoriaCompleta`).
- Aba "Equipe" e fila de base.
- Atribuição de técnico (drag-and-drop).

## Resultado

Coordenador clica num card de tarefa no mapa → vê novo botão **Reagendar** → escolhe nova data/hora + motivo → confirma → dados atualizados em todas as tabelas, log registrado, WhatsApp de reconfirmação enviado opcionalmente, mapa e listas refletindo na hora.
