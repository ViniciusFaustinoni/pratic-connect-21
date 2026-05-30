# Limitar janela de datas do AgendamentoBase a 2 dias posteriores

## Contexto
A tela "Vistoria" (etapa 5) do link público — `Oficina Praticcar` na captura — usa `src/components/cotacao-publica/AgendamentoBase.tsx`. Hoje ela renderiza 7 dias úteis (pula domingo) a partir de hoje (ou D+2 após 16h), por isso mostra Sáb 30 / Seg 1 / Ter 2 / Qua 3 / Qui 4.

## Mudança
Reduzir a janela para no máximo **3 cards** no total: o dia atual + **2 dias úteis posteriores** (pulando domingos e datas bloqueadas).

Exemplos (regra "úteis"):
- Sáb 30/mai (hoje) → Sáb 30, Seg 1, Ter 2 (pula Dom 31)
- Seg 1/jun (hoje) → Seg 1, Ter 2, Qua 3
- Após 16h: começa em D+2, ainda limita a 3 cards no total.

Se o dia atual estiver bloqueado/for domingo, o primeiro card vira o próximo útil disponível, mantendo o teto de 3.

## Arquivo afetado
`src/components/cotacao-publica/AgendamentoBase.tsx` — bloco `useMemo` `diasDisponiveis` (linhas 67-85):
- Trocar `while (dias.length < 7 && guard < 60)` por `while (dias.length < 3 && guard < 30)`.
- Atualizar o comentário de "Próximos 7 dias úteis" para "Hoje + 2 dias úteis posteriores".

Sem alteração no resto do componente (navegação por semana, períodos, vagas) — o paginador de semanas (`weekOffset`) continua funcionando para frente caso precisem ver janelas futuras.

## Fora de escopo
- `AgendamentoVistoria.tsx` (fluxo `cliente`, regido por SLA por UF — RJ 48h/SP 72h) não é alterado.
- Nenhuma mudança em backend, edges ou DB.
