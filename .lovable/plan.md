

# Plano: Alerta de Improdutividade de Vistoriadores

## Resumo

Detectar automaticamente vistoriadores em turno ativo sem serviços concluidos e alertar o coordenador via notificacao interna e card em tempo real no dashboard.

---

## PARTE 1 — Hook `useMonitorImprodutividade`

**Novo arquivo**: `src/hooks/useMonitorImprodutividade.ts`

Logica:
1. Ler `jornada_horas_alerta_improdutividade` da query `config-jornada` ja existente (fallback: 2h)
2. Buscar turno ativo do profissional via `useJornadaTrabalho` (estado `turno`)
3. `setInterval` a cada 5 minutos verificando:
   - Turno status === `ativo` (nao em almoco, nao encerrado)
   - Tempo ativo > limite configurado (em minutos)
   - 0 servicos concluidos no dia (query em `servicos` com `status = 'concluido'` e `data = hoje`)
4. Quando as 3 condicoes sao verdadeiras:
   - Verificar se ja existe notificacao com `referencia_id = turno.id` e `subtipo = 'improdutividade_vistoriador'`
   - Se nao existe, buscar users com role `coordenador_monitoramento` + admins via pattern do `NotificacaoHelper.ts`
   - Inserir notificacao para cada destinatario
5. Hook silencioso — sem UI

**Chamado em**: `InstaladorHome.tsx` (adicionar `useMonitorImprodutividade()` apos os hooks existentes)

---

## PARTE 2 — Card "Vistoriadores em Alerta" no Dashboard Coordenador

**Arquivo**: `src/pages/monitoramento/DashboardCoordenador.tsx`

Adicionar entre "Agendamentos na Base" e "Grid: Equipe + Alertas" (antes da linha 426):

- Novo hook/query `useVistoriadoresImprodutivos`:
  - Buscar turnos ativos do dia (`turnos_profissionais` com `status = ativo` e `data = hoje`)
  - Para cada turno, contar servicos concluidos no dia
  - Ler config `jornada_horas_alerta_improdutividade`
  - Filtrar: turno ativo ha mais tempo que o limite E 0 servicos concluidos
  - Join com `profiles` para nome e telefone

- Card com titulo "Vistoriadores em Alerta" + icone `AlertTriangle`:
  - Para cada vistoriador: nome, tempo ativo formatado ("3h 20min"), "0 servicos", botao "Ligar" (`<a href="tel:...">`)
  - Se nenhum em alerta: mensagem verde "Todos os vistoriadores ativos estao produtivos."
  - Realtime: subscribe em `turnos_profissionais` e `servicos` para invalidar a query automaticamente

---

## PARTE 3 — Campo read-only no RH

**Arquivo**: `src/pages/rh/JornadasProfissionais.tsx`

O campo `alertaImprodutividade` ja esta sendo buscado e exibido no grid de parametros (linha 196-199). Nada a fazer aqui — ja esta implementado.

---

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useMonitorImprodutividade.ts` | **Novo** — hook silencioso de deteccao |
| `src/pages/instalador/InstaladorHome.tsx` | Chamar o hook |
| `src/pages/monitoramento/DashboardCoordenador.tsx` | Card "Vistoriadores em Alerta" com query + realtime |

