

# Adicionar etapa "Agendamento" na timeline do link do cliente

## Problema

O fluxo do link de evento tem 4 etapas reais:
1. Auto Vistoria
2. B.O.
3. Relato
4. Agendamento (vistoria presencial)

Porem o stepper (`EventoStepper`) so mostra 3 etapas. Quando o associado completa as 3 primeiras e cai na tela de agendamento, a timeline nao reflete essa etapa.

## Solucao

**Arquivo: `src/components/evento/EventoStepper.tsx`**

- Adicionar uma 4a etapa no array `etapas`: `{ numero: 4, titulo: 'Agendamento', icon: Calendar }`
- Importar o icone `Calendar` do lucide-react

**Arquivo: `src/pages/public/EventoColisao.tsx`**

- Passar `etapaAtual` ajustado para o stepper:
  - Etapas 0-2 continuam mapeando para etapas 1-3 do stepper (o stepper ja soma 1 internamente via comparacao `etapaAtual >= etapa.numero`)
  - Quando `isCompleted` (etapa >= 3) e nao agendado, o stepper deve marcar etapas 1-3 como completas e a etapa 4 como atual
  - Quando `isAgendado`, todas as 4 etapas ficam completas

Atualmente o stepper recebe `etapaAtual` (0-based) e compara com `etapa.numero` (1-based): `completada = etapaAtual >= etapa.numero`. Isso significa que `etapaAtual=3` ja marca as 3 primeiras como completas. Para a etapa 4, precisamos que `etapaAtual=3` a marque como "atual" e `etapaAtual=4` a marque como "completada".

Ajuste na pagina:
- Quando `isAgendado`: passar `etapaAtual={4}` para marcar tudo como completo
- O valor atual `etapaAtual` (que ja eh 3 quando completa as 3 etapas) funcionara naturalmente para mostrar a etapa 4 como atual

## Detalhes tecnicos

No `EventoStepper.tsx`:
- Adicionar `Calendar` ao import do lucide-react
- Adicionar `{ numero: 4, titulo: 'Agendamento', icon: Calendar }` ao array `etapas`

No `EventoColisao.tsx`:
- Calcular o valor do stepper: `const stepperEtapa = isAgendado ? 4 : etapaAtual;`
- Passar para o componente: `<EventoStepper etapaAtual={stepperEtapa} />`

