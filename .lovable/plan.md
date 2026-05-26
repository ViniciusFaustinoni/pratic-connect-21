## Bug
Os cards de "Atribuição Manual" (Monitoramento › Serviços de Campo › Atribuição Manual) mostram apenas a **data** ("Hoje", "28/05") sem o **período** (Manhã/Tarde), embora o período seja escolhido na criação da tarefa.

## Causa raiz (código real)

`src/components/monitoramento/AtribuicaoManualTab.tsx` linhas 100–107:

```tsx
<Clock className="h-3 w-3" />
<span>
  {isToday(parseISO(servico.data_agendada)) ? 'Hoje' :
    isTomorrow(parseISO(servico.data_agendada)) ? 'Amanhã' :
      format(parseISO(servico.data_agendada), 'dd/MM', { locale: ptBR })}
  {servico.hora_agendada && ` às ${servico.hora_agendada.slice(0, 5)}`}
</span>
```

Só renderiza `data_agendada` + `hora_agendada`. **Não renderiza `servico.periodo`**, mesmo o hook `useServicosParaAtribuir` (linha 36 de `src/hooks/useAtribuicaoManual.ts`) trazendo `periodo` no `select`. Confirmado: o dado existe, a UI ignora.

Regra canônica: Vistoria Base é por período (Manhã 08:00–12:00 / Tarde 14:00–18:00) — ver `mem://logic/operations/vistoria-base-periodo-only`. `hora_agendada` é marcador interno; para o operador, o relevante é o período.

## Correção

Editar **apenas** `src/components/monitoramento/AtribuicaoManualTab.tsx` (linhas ~100–107):

- Acrescentar rótulo do período após a data quando `servico.periodo` existir.
- Mapa: `manha` → "Manhã", `tarde` → "Tarde", `dia_todo`/`integral` → "Dia todo".
- Manter `hora_agendada` quando existir (priorizar período visualmente; hora vira complemento entre parênteses para evitar perder informação técnica em rota).

Resultado esperado nos 3 cards do print:
- SERGIO BARRETO — "Hoje · Tarde"
- PEDRO HENRIQUE — "Hoje · Manhã"
- LEONARDO GOMES — "28/05 · Tarde"

## Fora de escopo
- Nada no hook / banco / outras telas.
- Não mexer em `DragOverlayCard` (cartão flutuante durante drag) — escopo é a lista visível.
- Não tocar regras de janela horária / SLA.
