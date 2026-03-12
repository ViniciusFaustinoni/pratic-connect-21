

## Correção: Enviar `cobertura_total_ativada` apenas após instalação do rastreador

### Situação Atual

O template é disparado em **3 pontos**, mas nem todos envolvem instalação de rastreador:

| # | Hook | Contexto | Envolve rastreador? |
|---|------|----------|---------------------|
| 1 | `useAprovarVeiculoVistoria` (useVistoriaCompleta.ts) | Aprovação de vistoria completa | **Nem sempre** — só se `instalacaoId` existir |
| 2 | `useAtivarRastreador` (useVistoriaCompletaAnalise.ts) | Ativação manual do rastreador | **Sim, sempre** |
| 3 | `useAprovarVeiculoServico` (useServicos.ts) | Aprovação de serviço com autovistoria prévia | **Sim** — é o fluxo pós-instalação |

### Correção

**`src/hooks/useVistoriaCompleta.ts`** (linha 142): Envolver o disparo da notificação com a condição `if (data.instalacaoId)`, garantindo que só dispara quando a vistoria faz parte de uma instalação (ou seja, houve rastreador instalado).

Os outros dois pontos (#2 e #3) já são exclusivamente pós-instalação de rastreador e permanecem como estão.

