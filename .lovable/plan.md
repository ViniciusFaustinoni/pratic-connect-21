## Diagnóstico — Tarefa some após refresh do técnico

### Linha do tempo (placa LTB4J74, serviço `c8f90bda…`, vistoria `fe628306…`)

| Hora (UTC) | Evento |
|---|---|
| 18:13:58 | Técnico Kleytonn iniciou rota → `servicos.status = em_rota` |
| 18:14:04 | Iniciou tarefa → `servicos.status = em_andamento` |
| 18:14:08 | Vistoria criada **já com `status='em_analise'`** (padrão do hook) |
| 18:14:10–20 | Avançou checklist (etapa 1→3, todos os itens "ok") |
| **18:15:26** | **Upload do `video_360_url` na vistoria** → trigger pushou `em_analise` para `servicos.status` |
| 18:19:29 | Refresh — `useTarefaAtual` filtra fora `em_analise` → tarefa some |

### Causa raiz

A trigger `public.sync_vistoria_update_to_servicos` roda em **todo `UPDATE` de `vistorias`** (sem `WHEN status changed`) e sobrescreve cegamente:

```sql
UPDATE servicos
   SET status = map_to_status_servico(NEW.status), ...
 WHERE vistoria_origem_id = NEW.id;
```

Como o hook de criação grava a vistoria já com `status='em_analise'` (semântica "aguardando finalização"), qualquer salvamento parcial — vídeo 360, dados parciais, etapa, fotos — re-aplica `em_analise` ao serviço. O hook `useTarefaAtual` (e seu fallback) excluem `em_analise` do conjunto de status válidos para "tarefa atual", então a tarefa desaparece do app do instalador.

A propagação correta de status terminal já existe em outra trigger dedicada (`trg_sync_servico_on_vistoria_decisao`), que cobre `aprovada / aprovada_ressalvas / reprovada / cancelada`. Ou seja, a linha de `status` em `sync_vistoria_update_to_servicos` é redundante e tóxica.

### Correção (migration única)

1. Recriar `sync_vistoria_update_to_servicos` **removendo o campo `status`** do `UPDATE`. Continua sincronizando dados logísticos (vistoriador, endereço, data/hora, lat/lng).
2. Como blindagem extra, adicionar `WHEN (NEW.* IS DISTINCT FROM OLD.*)` na trigger e ignorar quando só `updated_at` mudou.
3. **Recuperação de dados** (one-shot no mesmo migration): para todo `servicos` que esteja em `em_analise` mas cuja vistoria/instalação ainda não foi decidida (vistoria sem `concluida_em` e instalacao sem `concluida_em`), e cuja `vistoria_origem_id` tem `status='em_analise'` apenas por efeito da trigger, voltar `servicos.status` ao último estado real (`em_andamento` se `iniciada_em` preenchido, senão `em_rota` se `em_rota_em` preenchido, senão `agendada`). Restritivo: só onde `decisao_instalador IS NULL` e `imprevisto_registrado_em IS NULL`.

Em particular, resgata o serviço `c8f90bda…` para `em_andamento` (tem `iniciada_em`).

### Pós-correção esperada

- Técnico pode salvar parciais quantas vezes quiser; serviço só sai da fila quando: (a) decisão final na vistoria, (b) imprevisto, (c) atribuição mudada.
- Filtro de `useTarefaAtual` continua igual — não muda código frontend.
- Conclusão real continua via `useAprovarVeiculoVistoria` / `useRecusarVeiculoVistoria` que mudam `vistorias.status` para terminal e disparam `sync_servico_on_vistoria_decisao`.

### Arquivos

- **Nova migration SQL** (única): redefine `sync_vistoria_update_to_servicos` + roda recovery direcionado.
- Nenhuma mudança de frontend/edge function.

### Riscos / observações

- `sync_servico_on_vistoria_decisao` já cobre todos os estados terminais → seguro remover o `status` da outra trigger.
- Recovery é idempotente e filtra estritamente para não tocar em casos legítimos de `em_analise` (ex.: recusa do técnico que define `decisao_instalador='negado'`).
- Sugiro também (separado, não nesta migration) revisitar por que o hook cria a vistoria já como `em_analise` em vez de `em_andamento` — semanticamente errado — mas isso pode ficar para uma próxima rodada para não inflar o escopo desta correção.
