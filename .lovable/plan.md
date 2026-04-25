# Remover 3 cards obsoletos do modal "Sincronizar Financeiro"

## Confirmação

Sim, esses 3 cards serviram só para a montagem inicial da base e podem sair com segurança:

1. **Modo preparar base (apenas mapeamento)** — loop manual para popular `codigo_hinova` nos veículos antigos. Já concluído.
2. **Mapear lote — controlado (pausa/retomada)** — UI de mitigação para os bloqueios "Usuário com restrição" da Hinova durante o backfill inicial. Não é mais necessário porque a sincronização ocorre normalmente em paralelo (já validado, ~700 cobranças / 5 min mesmo com o erro presente — `restricaoHinovaAtiva = false` no código).
3. **Etapas (executar nesta ordem)** — passos manuais "Mapear lote → Enfileirar → Processar" usados na implantação. A drenagem em background + cron de 5 em 5 min cobre tudo sozinho.

## O que permanece

- **4 métricas do topo** (Elegíveis com/sem código, Sistema novo, Cobranças SGA importadas)
- **Barra de Progresso do backfill** com badges (Pendentes, Aguardando retry, Executando, Concluídos, Sem histórico, Não-elegíveis, Erros)
- **Card "Drenagem em background"** com Última hora / Últimos 5min / Sessão atual / ETA + botão "Parar drenagem"
- **Card "Ações de recuperação"** com "Reagendar erros (janela horária / 401)" e "Iniciar drenagem em background"

## Mudanças técnicas (`src/components/cobranca/SgaBackfillFinanceiroDialog.tsx`)

Reescrita do componente removendo:
- Bloco JSX dos 3 cards (linhas ~747–938)
- Handlers: `handlePrepararBase`, `handleMapear`, `handleEnfileirar`, `handleProcessar`
- Estados/refs do mapeamento controlado: `mapState`, `progresso`, `carregandoFila`, `batchSizeCtrl`, `pauseRef`, `runningRef`, `loading`, `running`, `preparandoBase`, `prepProgress`
- Funções auxiliares: `carregarFila`, `startMapearControlado`, `pausarMapearControlado`, `retomarMapearControlado`, `reiniciarMapearControlado`
- Tipos/constantes: `LS_KEY`, `RunState`, `MapearProgresso`, `emptyProgresso`, `loadProgresso`, `saveProgresso`
- `useEffect` que persistia `progresso` no localStorage
- Flags mortas `restricaoHinovaAtiva` / `qtdJobsRestricao` e seus tooltips
- Imports não usados: `RefreshCw`, `Link2`, `Play`, `Pause`, `RotateCcw`, `ListChecks`

A nota sobre o cron diário (09:00 BRT) é movida para o rodapé do card "Ações de recuperação" para não se perder. Nenhuma edge function é alterada — `sga-mapear-codigos-veiculos`, `sga-backfill-financeiro` e `cron-sga-sync-financeiro-diario` continuam funcionando.

## Impacto

- Modal fica significativamente mais enxuto, focado no operacional do dia a dia (monitorar drenagem + recuperar jobs).
- A chave `localStorage` `sga-mapear-progresso-v1` deixa de ser usada — não precisa limpeza (some sozinha quando o navegador rodar housekeeping).
