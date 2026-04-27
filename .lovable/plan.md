
# Bloco "Em tratamento" — Plano de correção

8 relatos abertos, agrupados em 4 frentes técnicas. Após cada frente, os relatos correspondentes vão para **Concluído** (aguardando teste do usuário).

---

## Grupo A — Reativar associado indisponível (Jessica)
**Relato:** `3e6d826e` — "A opção de reativar o associado está indisponível."

**Causa:** No `AssociadoHeroHeader`, o item "Reativar" do menu só aparece quando `status === 'suspenso' || coberturasSuspensas`. Associados em outros status terminais reativáveis (ex.: `inadimplente`, `bloqueado`, `cancelado` recente) não veem o botão.

**Correção:**
- Ampliar a condição para também exibir "Reativar" quando `status` ∈ {`suspenso`, `inadimplente`, `bloqueado`, `cancelado`}.
- Para `cancelado`, a ação encaminha o `ReativacaoWizard` para o **Caminho 3** (nova adesão completa), que já existe.
- Manter `disabled` quando o usuário não tem permissão.

**Arquivos:** `src/components/associados/detalhe/AssociadoHeroHeader.tsx`.

---

## Grupo B — Serviço fantasma trava agenda do técnico
**Relatos:**
- `de711e7b` (Kleytonn) — "não consigo atribuir, serviço já feito continua atribuído"
- `293d872f` (Kaike) — mesmo cenário, urgente
- `ccb1a3d4` (Kleytonn) — "vinculado ao técnico mas não inicia"
- `6a91ae40` (Kleytonn) — "finalizou fotos mas pulou rastreador → finalizado sem vínculo"

**Causa raiz:** Em `useAtribuicaoManual`, técnicos disponíveis carregam serviços com status ∈ {`agendada`, `em_andamento`, `em_rota`} e `data_agendada >= hoje`. Quando um serviço é concluído mas o status não fecha (bug de finalização sem etapa do rastreador), ou quando ficou preso em `em_andamento`, o técnico aparece sobrecarregado e não recebe novas atribuições.

**Correções:**

**B1. Backfill imediato (migration de dados):**
- Fechar serviços com `status` ∈ {`agendada`, `em_andamento`, `em_rota`} cujo `agendamento_base` ou `instalacao` vinculado já está em status terminal (`concluido`, `cancelado`).
- Marcar como `concluido` com `concluido_em = now()` e registrar evento de auditoria.

**B2. Botão "Liberar serviço" (ação administrativa):**
- Em `ServicosTable` / `ServicoDetailModal`, adicionar item de menu "Liberar técnico (forçar conclusão)" visível apenas para diretoria/admin.
- Marca o serviço como `concluido_admin` e libera a slot do técnico, exigindo uma observação obrigatória.

**B3. Não permitir "pular" rastreador:**
- Em `ExecutarVistoriaCompleta`, o passo de **vínculo do rastreador** deve ser **obrigatório** quando a instalação prevê rastreador (regra atual aceita pular silenciosamente). Adicionar validação que bloqueia "Finalizar" sem foto do equipamento + IMEI vinculado.

**Arquivos:** `src/hooks/useAtribuicaoManual.ts` (filtro reforçado), `src/components/servicos-campo/ServicosTable.tsx` + `ServicoDetailModal.tsx` (botão liberar), `src/pages/instalador/ExecutarVistoriaCompleta.tsx` (validação obrigatória), migration de backfill.

---

## Grupo C — Ativação travada por instalação feita por prestador externo
**Relatos:**
- `982528c2` (Teste) — "preciso ativar, foi feito via prestador, consta pendência de instalação"
- `4d9411ff` (Teste) — "pule essa opção de instalação, já foi feita há quase uma semana"

**Causa:** Quando o serviço é executado por prestador parceiro (fora do app interno), a `instalacao` e o `agendamento_base` não são fechados, então a regra de pré-ativação no SGA detecta "pendência" e bloqueia.

**Correção:**

**C1. Ação "Concluir instalação por prestador":**
- Novo botão no `AssociadoDetalhe` (aba Veículos) e em `InstalacaoDetalhe` para diretor/admin/coordenador de monitoramento.
- Abre modal exigindo: nome do prestador, data efetiva, observação. Opcionalmente IMEI/rastreador (se já houver).
- Ao confirmar: fecha `instalacoes` com `status = 'concluida'`, fecha `agendamentos_base` com `status = 'concluido'`, registra histórico do associado e dispara o orquestrador SGA para ativar.

**C2. Ajuste no pré-check SGA:**
- O `sga-hinova-sync` não deve mais bloquear quando há instalação `concluida` (mesmo via prestador). Validar comportamento atual.

**Arquivos:** Nova edge function `concluir-instalacao-prestador` ou ação direta no front (sem secrets), modal novo `ConcluirInstalacaoPrestadorModal.tsx`, integração em `AssociadoDetalhe.tsx`.

---

## Grupo D — Vínculo Softruck sem dados/login (Kleytonn)
**Relato:** `5ab98352` — "vínculo com plataformas de monitoramento não funciona, plataforma não puxa dados nem faz login"

**Status:** Investigação. Já temos a edge `softruck-buscar-dispositivo` (corrigida no turno anterior) e `softruck-login-as-cliente`. Vou:
- Conferir nos logs se há falha de credencial nas chamadas recentes.
- Validar se `SOFTRUCK_USERNAME` / `SOFTRUCK_PASSWORD` estão presentes.
- Se faltar credencial, pedir ao usuário para configurar nos secrets antes de marcar como concluído.

Este relato **não vai para concluído neste ciclo** — fica `em_tratamento` com nota de diagnóstico anexada (resultado da investigação dos logs).

---

## Ordem de execução

1. **Grupo A** (1 arquivo, baixo risco) → marca `3e6d826e` como concluído.
2. **Grupo B** (backfill + botão liberar + validação rastreador) → marca `de711e7b`, `293d872f`, `ccb1a3d4`, `6a91ae40` como concluídos.
3. **Grupo C** (modal + ação) → marca `982528c2`, `4d9411ff` como concluídos.
4. **Grupo D** (investigação) → atualiza nota do relato `5ab98352` com diagnóstico, mantém em tratamento ou solicita ação.

Confirme e eu executo.
