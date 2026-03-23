

# Plano: Monitor Automatico de Prestador Sem Resposta

## Resumo

Hook silencioso que verifica a cada 15 minutos se prestadores com links ativos nao confirmaram chegada apos X horas (configuravel), e notifica coordenadores/admins automaticamente sem duplicar alertas.

---

## PARTE 1 — Config no banco

Inserir nova chave na tabela `configuracoes`:
- `prestador_horas_alerta_sem_resposta` = `2`

Sem migration — usar insert tool.

---

## PARTE 2 — Campo na secao "Regras de Viagem" do MapaAtendimento

**Arquivo**: `src/components/gestao-comercial/MapaAtendimento.tsx`

- Adicionar state `prestadorHorasAlerta` ao lado de `viagemDiaria` e `viagemSla`
- Buscar chave `prestador_horas_alerta_sem_resposta` na query `config-viagem` existente
- Adicionar campo numerico na grid: "Horas sem resposta para alerta (prestador)", padrao 2
- Incluir na mutation `salvarViagemMutation` o update dessa chave

---

## PARTE 3 — Hook `useMonitorPrestadorSemResposta`

**Novo**: `src/hooks/useMonitorPrestadorSemResposta.ts`

Segue o mesmo padrao do `useMonitorImprodutividade`:

1. Query de config: buscar `prestador_horas_alerta_sem_resposta` (staleTime 10min)
2. `useEffect` com `setInterval` de 15 minutos
3. A cada ciclo:
   - Buscar `instalacao_prestador_links` com status `aguardando`, `created_at < now() - X horas`, `expires_at > now()`
   - Para cada link encontrado, verificar se ja existe notificacao com `referencia_id = link.id` e tipo `prestador_sem_resposta`
   - Se nao existe: buscar nome do prestador (`prestadores_assistencia`), cidade da instalacao (`instalacoes`), e destinatarios (`user_roles` com roles coordenador_monitoramento/admin/diretor)
   - Inserir notificacoes com titulo, mensagem, tipo `alerta`, referencia_id, referencia_tipo `instalacao_prestador_link`, prioridade `alta`
4. Cleanup: clearInterval no unmount
5. Completamente silencioso — sem toast, sem UI

---

## PARTE 4 — Integracao no DashboardCoordenador

**Arquivo**: `src/pages/monitoramento/DashboardCoordenador.tsx`

Adicionar `useMonitorPrestadorSemResposta()` no topo do componente, ao lado dos hooks existentes. Sem renderizacao adicional.

---

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| DB (insert) | Config `prestador_horas_alerta_sem_resposta` |
| `src/components/gestao-comercial/MapaAtendimento.tsx` | Campo config prestador |
| `src/hooks/useMonitorPrestadorSemResposta.ts` | **Novo** hook |
| `src/pages/monitoramento/DashboardCoordenador.tsx` | Chamar hook |

