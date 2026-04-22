

## Diferenciar UX do técnico Base vs Rota (mesmo perfil de acesso)

### Situação atual

Técnicos Base e Rota usam o **mesmo perfil de acesso** (`tipo: 'profissional'`/instalador) e o mesmo layout `/instalador/*`. A diferenciação acontece via `useAlocacaoDiaria().isBase`. Hoje a UI da Base já tem alguns ajustes (sem aba Mapa, fila da base no Home, almoço manual), mas **continua mostrando**:

1. **Monitor de improdutividade** roda para todos (`useMonitorImprodutividade` no `InstaladorHome`) — gera notificação ao coordenador se não houver serviço concluído em 2h. Inválido para técnico Base, que executa serviços sob demanda na fila e pode passar horas sem nada chegar.
2. **Card "Minha Jornada" no perfil** mostra saldo/crédito/débito e dias trabalhados — métricas de banco de horas que não fazem sentido para quem bate ponto físico na empresa.
3. **Barra de jornada (`JornadaStatusBar`)** mostra "X trabalhadas / Y restantes", barra de progresso, almoço, atraso de almoço — tudo controle de ponto eletrônico que o técnico Base não precisa ver.
4. **Modal de resumo do dia** (`ModalResumoDia`) abre ao encerrar turno mostrando saldo/débito/crédito.
5. **`useGarantirTurno`** continua criando registros em `turnos_profissionais` para o técnico Base (necessário para vincular serviços, mas sem expor o controle).

### O que vai mudar

**Princípio**: Técnico Base **continua com o mesmo perfil de acesso** e o mesmo `InstaladorLayout`. A diferença é puramente de UX — esconder controles de ponto/jornada/improdutividade quando `isBase === true`.

**1. `useMonitorImprodutividade` — desligar para Base**
Adicionar `useAlocacaoDiaria` no início do hook. Se `isBase === true`, retornar imediatamente sem registrar interval nem disparar verificação. Técnico de base não pode ser flagged como improdutivo (depende da fila, não da rota).

**2. `InstaladorHome.tsx` — esconder JornadaStatusBar e modal de resumo para Base**
- A barra de jornada (`JornadaStatusBar`) só renderiza se `!isVistoriadorBase`.
- O `ModalResumoDia` só abre se `!isVistoriadorBase` (passar a flag para `useJornadaTrabalho` ou condicionar o `setMostrarResumoDia` ao tipo).
- Manter `useGarantirTurno` rodando (precisamos do registro de turno para vincular serviços executados), mas silenciosamente.

**3. `InstaladorPerfil.tsx` — substituir "Minha Jornada" por bloco simples para Base**
Quando `isBase`:
- Esconder o card "Minha Jornada" inteiro (saldo, dias trabalhados, total mês, débito bloqueado, diárias de viagem).
- Trocar por um card simples "Técnico Base" com texto: "Você atua na base — controle de ponto é feito presencialmente. Esta tela mostra apenas suas tarefas e configurações."
- Manter os menus (Configurações, Notificações, Ajuda, Privacidade, Sair) e o card de identificação no topo.
- Aba "Histórico" pode ser escondida para Base (não tem banco de horas a consultar) ou substituída por histórico simples de serviços executados.

**4. `useJornadaTrabalho.ts` — não exibir resumo do dia para Base**
No bloco `--- Modal de resumo do dia ---` (linha ~496), adicionar guard `if (isBase) return;` no `useEffect` que dispara `setMostrarResumoDia(true)`. O hook `isBase` já está disponível no escopo (linha 399).

**5. `useGarantirTurno` — sem alteração**
Continua criando o turno (necessário para FK em serviços executados), apenas sem tela de almoço/jornada na UI.

### O que NÃO muda

- Roles e permissões: técnico Base e Rota seguem com o mesmo `role` e mesmo `tipo`. Tudo via `isBase` derivado de `alocacoes_diarias`.
- `InstaladorLayout` (header, bottom nav, guards) — já trata Base corretamente (esconde aba Mapa).
- Fila da base no Home (`FilaBaseSection`) e execução de vistorias seguem iguais.
- Auto-finalização de almoço/turno não dispara para Base (já está com `!isBase` guard hoje no hook).
- Banco de dados: nenhuma migração. O registro em `turnos_profissionais` continua sendo criado para fins de auditoria interna; só não é exposto na UI.

### Arquivos editados

- `src/hooks/useMonitorImprodutividade.ts` — bypass total quando `isBase`.
- `src/pages/instalador/InstaladorHome.tsx` — esconder `JornadaStatusBar` e `ModalResumoDia` para Base.
- `src/pages/instalador/InstaladorPerfil.tsx` — esconder card "Minha Jornada" e aba "Histórico" para Base; substituir por bloco informativo simples.
- `src/hooks/useJornadaTrabalho.ts` — não disparar `mostrarResumoDia` para Base.

### Riscos

- Se um técnico mudar de Base para Rota no meio do dia (improvável, mas possível), a UI atualiza junto com `useAlocacaoDiaria` (cache de 60s). Sem efeitos colaterais em dados.
- Histórico de jornada continua sendo gravado no banco para Base — útil se o gestor quiser auditar tempo presencial depois. Apenas não fica visível para o técnico.

