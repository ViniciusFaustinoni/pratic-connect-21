

## Varredura final — adicionar `refetchIntervalInBackground: false`

### Objetivo
Garantir que **todos** os hooks/componentes com `refetchInterval` ativo pausem o polling quando a aba estiver em background. Isso reduz drasticamente requests fantasmas em abas inativas, sem mudar UX em primeiro plano.

### Arquivos a editar (já têm polling, faltam o flag)

**Hooks (~30 arquivos):**
- `src/hooks/useImprevistosSemResposta.ts`
- `src/hooks/useChamadoPosicaoTempoReal.ts`
- `src/hooks/useMetricasTempo.ts`
- `src/hooks/useManutencaoInterna.ts`
- `src/hooks/useRecusasInstalador.ts`
- `src/hooks/useRastreadorPosicao.ts` (2 queries)
- `src/hooks/useVistoriasMapa.ts`
- `src/hooks/useSolicitacoesMigracaoAdmin.ts`
- `src/hooks/useEventosDashboard.ts` (14 queries)
- `src/hooks/useAcionamentoRoubo.ts`
- `src/hooks/useAgendamentoBase.ts`
- `src/hooks/useAprovacoesFipeDiretoria.ts`
- `src/hooks/useAtribuicaoManual.ts` (2 queries)
- `src/hooks/useCotacaoContratacao.ts` (2 queries)
- `src/hooks/useFilaBaseHoje.ts`
- `src/hooks/useIntegracaoCredenciais.ts`
- `src/hooks/useIntegracoesStatus.ts` (2 queries)
- `src/hooks/useJornadaTrabalho.ts`
- `src/hooks/useManutencaoRastreadores.ts`
- `src/hooks/usePerformanceSemanalCoordenador.ts`
- `src/hooks/useRastreadorStatus.ts`
- `src/hooks/useRastreadoresPorPortador.ts`
- `src/hooks/useRessalvasMonitoramento.ts`
- `src/hooks/useRotasBairros.ts`
- `src/hooks/useServicos.ts`
- `src/hooks/useSinistroDetalhes.ts` (2 queries)
- `src/hooks/useSubstituicaoPublica.ts`
- `src/hooks/useVistoriaManutencao.ts`
- `src/hooks/useWhatsAppHistorico.ts`

**Componentes/páginas (~6 arquivos):**
- `src/components/monitoramento/VistoriadoresEmAlerta.tsx`
- `src/components/monitoramento/PrestadoresAtivos.tsx`
- `src/components/monitoramento/AlertasWidget.tsx` (2 queries)
- `src/components/ativacao/BotaoEnviarSGA.tsx`
- `src/components/sinistros/CardControleReparo.tsx`
- `src/pages/public/AcompanhamentoProposta.tsx`
- `src/pages/assistencia/AssistenciaDashboard.tsx` (2 queries)
- `src/pages/eventos/EventosChatIA.tsx`
- `src/pages/rh/JornadasProfissionais.tsx`

### Regra de aplicação
Para cada `useQuery({ ... refetchInterval: X ... })` adicionar a linha `refetchIntervalInBackground: false,` logo abaixo de `refetchInterval`.

### Exceções (manter como está, com justificativa)
- **`src/hooks/useAguardarDecisaoMonitoramento.ts`** — já é `refetchIntervalInBackground: true` **intencionalmente**. É um hook curto (10s) usado durante decisão de monitoramento ativo, precisa rodar em background para receber a aprovação do supervisor mesmo se a aba do instalador estiver minimizada. **Não alterar.**
- Hooks com `refetchInterval` baseado em função/callback (ex: `useAutentique`, `useContratoLink`, `useOrdensServico`, `useSGASync`, `useSolicitacaoMigracao`, `StepConclusao`, `StepRastreador`, `StepVistoria`) — também recebem `refetchIntervalInBackground: false` (a função desliga sozinha, mas o flag protege quando ainda está rodando).

### Critérios de aceitação
1. Toda chamada `useQuery` com `refetchInterval` numérico no projeto possui `refetchIntervalInBackground: false`, exceto `useAguardarDecisaoMonitoramento`.
2. Comportamento em primeiro plano permanece idêntico.
3. Em aba background, o número de requests cai a quase zero (verificável no DevTools de Rede).
4. Nenhuma regressão visual ou funcional.

### Fora de escopo
- Mover canais realtime para montagem por rota (Fase 5).
- Otimização de queries pesadas individuais.

