

## Remover trava de horário para iniciar tarefa atribuída ao técnico

### Causa raiz

A trava aparece em **dois pontos** que bloqueiam o botão "Iniciar Tarefa" antes do início do período (08:00 / 13:00 / 18:00):

1. **Frontend — `src/components/vistoriador/TarefaAtualCard.tsx`** (linhas 99-107 e 526)
   `podeIniciarPorHorario` desabilita o botão quando `horaAtual < horaLiberacaoTarefa(tarefa)`. Por isso o caso real do anexo (10:33, período Tarde com início às 13:00) mostra "Disponível em 2h 27min".

2. **Backend (client mutation) — `src/hooks/useTarefaAtual.ts`** (linhas 222-236, dentro de `useIniciarRota`)
   Mesmo se o botão fosse habilitado, o `mutationFn` faz uma segunda checagem e lança `Período disponível a partir das HH:MM`.

A função base `horaLiberacaoTarefa` em `src/lib/periodo-utils.ts` é correta e segue sendo útil para **informação visual** (saber a que horas o período começa) — não deve ser removida, só deixa de ser usada como **bloqueio**.

### Por que a trava existia

Foi adicionada para impedir que o técnico iniciasse a rota muito antes do período prometido ao associado (ex.: chegar 6h da manhã num agendamento da tarde). Mas o modelo do negócio é **por período (Manhã/Tarde/Noite)**, não por horário cravado. Se a tarefa **já foi atribuída ao técnico**, ele deve ter autonomia para adiantar — inclusive porque o associado já foi contatado (etapa "Contato realizado via WhatsApp" do anexo) e o adiantamento normalmente é combinado por mensagem.

### Correção (mínima e cirúrgica)

**Arquivo 1 — `src/components/vistoriador/TarefaAtualCard.tsx`**

- Remover `!podeIniciarPorHorario` da condição `disabled` do botão "Iniciar Tarefa" (linha 526). Fica:
  ```tsx
  disabled={isIniciandoRota || (!isNaBase && !contatoRealizado)}
  ```
- Remover o bloco de feedback amber "Disponível em … período da Tarde começa às …" (linhas 549-565), já que não há mais bloqueio.
- Manter `horaLiberacao` apenas como referência interna se quisermos exibir uma linha **informativa** discreta (sem trava). Para simplificar, removemos `podeIniciarPorHorario` e `tempoRestante` que ficam órfãos.

**Arquivo 2 — `src/hooks/useTarefaAtual.ts`**

- Remover o bloco de validação de horário no `mutationFn` de `useIniciarRota` (linhas 222-236), incluindo o `import` dinâmico de `horaLiberacaoTarefa`. A checagem de atribuição (`profissional_id === profile.id`) permanece — essa sim é a trava de segurança real.

**Sem mudanças em:**
- `src/lib/periodo-utils.ts` (a função fica disponível para outros usos, ex.: agendamento/coordenação).
- Edge functions, banco, RLS, regras de SLA. Nada disso depende dessa trava.
- Fluxos de "Cheguei no Local", confirmação WhatsApp, contato obrigatório — todos preservados.

### Comportamento após a correção

- Técnico com tarefa atribuída pode tocar **"Iniciar Tarefa"** a qualquer hora do dia agendado, desde que (para serviços externos) tenha registrado contato com o associado.
- Encaixes continuam liberando imediato (já era o caso).
- Sem mensagem de "Disponível em Xh Ymin".
- Coordenação continua vendo o período no painel; o técnico apenas deixa de ser bloqueado por ele.

### Critérios de aceitação

1. Caso real do anexo (10:33, agendado para Tarde) — botão "Iniciar Tarefa" fica habilitado assim que o contato com o associado é confirmado, sem mensagem de "Disponível em 2h 27min".
2. Tarefa de um dia futuro continua **habilitada** (comportamento atual já era esse — `if (data_agendada !== hoje) return true`).
3. Tarefa sem contato (serviço externo) ainda permanece bloqueada com a mensagem "Entre em contato com o associado antes de iniciar o percurso" — essa trava é mantida.
4. Mutation `useIniciarRota` não retorna mais erro `Período disponível a partir das …`.
5. Nenhuma regressão em "Cheguei no Local", encaixes ou serviços na base.

### Fora de escopo

- Mexer em SLA, cálculo de "atrasada" no painel da coordenação.
- Notificação WhatsApp ao associado quando o técnico adianta (pode ser um próximo passo, se desejado).
- Mudar a lógica do agendador/coordenador — ali continua fazendo sentido considerar o início do período.

