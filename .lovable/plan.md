

## Encerrar `agendamentos_base` e `servicos` ao aprovar vistoria

### Já parcialmente implementado — preciso confirmar antes

Na rodada de "Bugs do app do instalador" essa correção foi planejada e (segundo o resumo) aplicada em `useAprovarVeiculoVistoria` + backfill. Antes de re-implementar, preciso ler o código atual para ver se:

1. A atualização de `agendamentos_base.status = 'realizado'` está mesmo lá.
2. O `update` em `servicos` (via `vistoria_origem_id` e via `agendamento_origem_id`) está lá.
3. A edge function `processar-vistoria` (que é o caminho real chamado por `useAnaliseVistoria` — o hook `useAprovarVeiculoVistoria` pode nem ser o ponto de entrada hoje) faz isso.

Se já estiver correto, a "tarefa fantasma" tem outra causa (cache do React Query, realtime não invalidando, ou serviço criado por outro fluxo). Por isso o plano abaixo cobre os dois cenários.

### Diagnóstico a confirmar (antes de codar)

Pontos a inspecionar:
- `src/hooks/useVistoriaCompleta.ts` → `useAprovarVeiculoVistoria` — verificar se já atualiza `agendamentos_base` e `servicos`.
- `supabase/functions/processar-vistoria/index.ts` — caminho usado pelo regulador (analista) via `useAnaliseVistoria.registrarDecisao`. Esse é o fluxo de aprovação **real** em produção.
- `src/hooks/useServicosRealtime.ts` — já invalida `tarefa-atual` em qualquer mudança de `servicos` do profissional. OK.
- Tabela `agendamentos_base` — confirmar enum/valores válidos de `status` (`realizado` existe?).

### Mudanças (condicionais ao diagnóstico)

**1. `processar-vistoria` (edge function)** — no branch `decisao IN ('aprovada','aprovada_com_ressalvas')`, adicionar logo após gravar a decisão na vistoria:

```ts
// 1. Encerra serviço materializado da vistoria (se existir)
await supabase.rpc('set_audit_origem', { origem: 'processar-vistoria' });

const { data: servicosAfetados } = await supabase
  .from('servicos')
  .update({
    status: decisao === 'reprovada' ? 'cancelada' : 'concluida',
    finalizado_em: new Date().toISOString(),
    observacoes_conclusao: 'Encerrado automaticamente por decisão da análise de vistoria',
  })
  .eq('vistoria_origem_id', vistoria_id)
  .in('status', ['agendada','em_rota','em_andamento','pendente','reagendada'])
  .select('id, agendamento_origem_id');

// 2. Encerra agendamento_base vinculado (se existir)
const agendamentoIds = (servicosAfetados ?? [])
  .map(s => s.agendamento_origem_id)
  .filter(Boolean);

if (agendamentoIds.length > 0) {
  await supabase
    .from('agendamentos_base')
    .update({ status: 'realizado', updated_at: new Date().toISOString() })
    .in('id', agendamentoIds);
}
```

Mesmo bloco (com `cancelada`/`cancelado`) no branch `reprovada`.

**2. `useAprovarVeiculoVistoria` (hook frontend, fluxo de vistoria de manutenção)** — replicar a mesma lógica, **se** ainda não estiver presente. Caso esteja, sem alteração.

**3. Trigger SQL como rede de segurança (recomendado)** — migration:

```sql
CREATE OR REPLACE FUNCTION public.sync_servico_on_vistoria_decisao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_novo_status text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('aprovada','aprovada_ressalvas','reprovada','cancelada') THEN
    v_novo_status := CASE NEW.status
                       WHEN 'reprovada' THEN 'cancelada'
                       WHEN 'cancelada' THEN 'cancelada'
                       ELSE 'concluida' END;

    UPDATE servicos
       SET status = v_novo_status::status_servico,
           finalizado_em = COALESCE(finalizado_em, now()),
           updated_at = now()
     WHERE vistoria_origem_id = NEW.id
       AND status IN ('agendada','em_rota','em_andamento','pendente','reagendada');

    UPDATE agendamentos_base ab
       SET status = CASE NEW.status WHEN 'reprovada' THEN 'cancelado'
                                    WHEN 'cancelada' THEN 'cancelado'
                                    ELSE 'realizado' END,
           updated_at = now()
      FROM servicos s
     WHERE s.vistoria_origem_id = NEW.id
       AND ab.id = s.agendamento_origem_id
       AND ab.status NOT IN ('realizado','cancelado');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sync_servico_on_vistoria_decisao
AFTER UPDATE OF status ON vistorias
FOR EACH ROW EXECUTE FUNCTION sync_servico_on_vistoria_decisao();
```

A trigger garante consistência mesmo se algum fluxo futuro alterar `vistorias.status` direto sem passar pela edge function.

**4. Backfill (migration, defensivo)**:

```sql
-- Encerra serviços ativos de vistorias já decididas
UPDATE servicos s
   SET status = CASE v.status
                  WHEN 'reprovada' THEN 'cancelada'::status_servico
                  ELSE 'concluida'::status_servico END,
       finalizado_em = COALESCE(s.finalizado_em, now()),
       updated_at = now()
  FROM vistorias v
 WHERE s.vistoria_origem_id = v.id
   AND v.status IN ('aprovada','aprovada_ressalvas','reprovada','cancelada')
   AND s.status IN ('agendada','em_rota','em_andamento','pendente','reagendada');

-- Encerra agendamentos_base correspondentes
UPDATE agendamentos_base ab
   SET status = CASE v.status WHEN 'reprovada' THEN 'cancelado'
                              WHEN 'cancelada' THEN 'cancelado'
                              ELSE 'realizado' END,
       updated_at = now()
  FROM servicos s
  JOIN vistorias v ON v.id = s.vistoria_origem_id
 WHERE ab.id = s.agendamento_origem_id
   AND v.status IN ('aprovada','aprovada_ressalvas','reprovada','cancelada')
   AND ab.status NOT IN ('realizado','cancelado');
```

**5. Frontend — invalidações**: já cobertas por `useServicosRealtime` (escuta `servicos` por `profissional_id`) e `useAnaliseVistoria.onSuccess` (invalida `vistorias`/`fila-vistorias`/`instalacoes`). Sem mudança.

### Pré-checagem obrigatória antes de aplicar

1. Ler `useVistoriaCompleta.ts` e `processar-vistoria/index.ts` para descobrir o que já existe — se a lógica frontend está completa, foco vai 100% para edge function + trigger.
2. Confirmar no schema os valores válidos de `agendamentos_base.status` (`realizado`/`cancelado`) e `servicos.status` enum.
3. Confirmar nome da coluna `agendamento_origem_id` em `servicos` (ou variação `base_id`/`agendamento_base_id`).

Se o pré-check mostrar que **tudo já está implementado** e a tarefa fantasma persiste, abro outro ciclo investigando: cache do PWA do instalador, `useServicosRealtime` não montado, ou `tarefa-atual` filtrando por critério diferente.

### Arquivos editados

- `supabase/functions/processar-vistoria/index.ts` — adicionar bloco de encerramento de `servicos` + `agendamentos_base`.
- `src/hooks/useVistoriaCompleta.ts` — completar lógica se faltar (provável que sim só para `agendamentos_base`).
- Migration nova — trigger `trg_sync_servico_on_vistoria_decisao` + backfill.
- `mem://logic/operations/aprovacao-vistoria-encerra-servico.md` (novo) — registra a regra "ao decidir vistoria, serviço materializado e agendamento_base devem fechar juntos".

### Riscos

- Se `agendamentos_base.status` não tiver valor `realizado` no enum, a migration falha — pré-check obrigatório.
- Trigger pode disparar simultânea à update da edge function — idempotente (filtros `IN (status ativos)` evitam dupla escrita).
- Backfill toca registros históricos — desejado; sem isso, tarefas fantasmas existentes continuam.

