## Pendências aprovadas — 3 frentes

Continuação da rodada anterior (edges propagam erro real). Mesma filosofia: nenhuma operação crítica de banco pode ser engolida em silêncio.

---

### Frente 1 (prioridade alta) — Handoff "fotos concluídas → rota" visível

**Problema:** quando link de prestador é `escopo='somente_fotos'` e o prestador conclui, as fotos são materializadas mas a `instalacoes` fica **aberta esperando próximo técnico para a rota**. Hoje isso é invisível: nenhum badge, filtro ou notificação. Coordenador esquece → instalação órfã.

**Mudanças:**

1. **`useServicosParaAtribuir`** (`src/hooks/useAtribuicaoManual.ts`): incluir flag `aguardando_rota_pos_fotos` no item normalizado quando existir `instalacao_prestador_links.escopo='somente_fotos'` com `status='concluida'` para a mesma `instalacao_origem_id`, e nenhum link `fotos_instalacao` ativo. Hoje o filtro do hook exclui qualquer link não-terminal — `concluida` já passa, então o serviço reaparece na fila, mas sem sinalização.

2. **`AtribuicaoManualTab.tsx`**:
   - Novo `Badge variant="secondary"` âmbar `"Aguardando técnico p/ rota"` no `DraggableServico` quando `servico.aguardando_rota_pos_fotos`.
   - Novo filtro/aba na lista lateral: chip "Pós-fotos sem rota" (contador) que filtra apenas estes.
   - Ordenação: prioridade visual no topo dentro do dia.

3. **`concluir-instalacao-prestador`** (edge): após materializar fotos com `escopo='somente_fotos'`, disparar **notificação ao coordenador** via `whatsapp-send-text` (template novo `instalacao_aguardando_rota_pos_fotos`) ou — se template não existir ainda — registro em `notificacoes_internas` (canal já consumido pelo sino do Monitoramento). Decisão: **registro interno** primeiro (sem dependência de template Meta aprovado), template Meta vira pendência separada.

4. **Memória nova:** `mem://logic/operations/handoff-fotos-rota-visibilidade` documentando o ciclo.

---

### Frente 2 (prioridade média) — Edges restantes propagam erro real

**Padrão canônico aplicado:**
- UPDATE crítico falha → `502` + `Retry-After: 60` + `code` estruturado.
- INSERT log/auditoria falha → seguir, mas marcar `parciais[]` na resposta.

**Arquivos:**

a) **`assumir-instalacao-vistoria-link/index.ts`** (linhas 192–240). É o auto-assume pelo link público do técnico. Hoje 4 falhas silenciosas: update `instalacoes`, select `servicos`, update `servicos`, insert `servicos_atribuicoes_log`.
   - Propagar `updInstErr` e `updServErr` como `502` com codes `falha_assumir_instalacao` e `falha_assumir_servicos`. O técnico vê mensagem clara em vez de redirect para tela vazia.
   - `logErr` continua não-bloqueante (apenas log) — incluir em `parciais` da resposta de sucesso.

b) **`ativar-associado/index.ts`** linhas 515/554/567 (bloco "promoção parcial"). Hoje warn + continue. Risco: contrato vira `ativo`, veículo continua `instalacao_pendente` invisível.
   - Manter `warn` para diagnóstico mas adicionar campo `parciais: ['veiculo'|'cotacao'|'contrato']` na resposta de sucesso (já existe estrutura). UI mostra alerta "ativação parcial — reprocesse".
   - **Não** transformar em 502 aqui porque o lock de ativação é único — reexecutar dispararia idempotência. Em vez disso: novo cron `reconciliar-ativacao-parcial` (15min) varre `associados.status='ativo'` cujo veículo/contrato/cotação ainda não estão sincronizados e reaplica o trecho. Cron entra como pendência separada — nesta rodada só expomos `parciais[]`.

c) **`agendar-vistoria-presencial`** e **`agendar-vistoria-completa`**: revisão confirmou que UPDATE crítico em `cotacoes` (linhas 180 e 161) **já lança throw** → cai no catch geral → `500`. Suficiente. **Nenhuma mudança nesta rodada.**

---

### Frente 3 — Varredura sistemática `console.(error|warn).*update`

Auditoria identificou ~60 ocorrências. Categorização e ação:

| Categoria | Ação |
|---|---|
| UPDATE crítico engolido (Frente 2) | corrigir agora |
| UPDATE não-crítico (whatsapp confirm, log, contador) | manter — está correto |
| INSERT auditoria/log/alerta | manter — não-bloqueante por design |
| UPDATE admin (senha, email) | já retornam erro — OK |
| UPDATE em fluxos legados | listar em `mem://debt/edges-pending-propagation` para próxima rodada |

**Lista que entra em débito documentado (não corrigir agora):**
- `autentique-cancel/index.ts:76`
- `autentique-status/index.ts:177`
- `autentique-vistoria-create/index.ts:356`
- `chassi-ocr/index.ts:218`
- `whatsapp-webhook/index.ts:76,204,233,1869`
- `atribuir-proxima-tarefa/index.ts:795`
- `aprovar-troca-cadastro/index.ts:138`
- `criar-sinistro/index.ts:622`
- `asaas-verificar-cota-sinistro/index.ts:177`
- `app-criar-conta-cliente/index.ts:240`, `app-criar-senha/index.ts:162`

Critério: fluxos com retry natural (cron, polling, próxima ação do usuário) toleram log silencioso por enquanto. Os críticos restantes ficam como Frente 4 estrutural.

---

### Arquivos a alterar nesta rodada

- `src/hooks/useAtribuicaoManual.ts` — flag `aguardando_rota_pos_fotos`
- `src/components/monitoramento/AtribuicaoManualTab.tsx` — badge + filtro
- `supabase/functions/concluir-instalacao-prestador/index.ts` — notificação interna pós-`somente_fotos`
- `supabase/functions/assumir-instalacao-vistoria-link/index.ts` — propagar 502
- `supabase/functions/ativar-associado/index.ts` — expor `parciais[]`
- Memórias: `handoff-fotos-rota-visibilidade` (nova) + `edges-pending-propagation` (débito)

**Não altera:** schema do banco, `agendar-vistoria-*`, edges Asaas/Autentique (já feitas).

---

### Pendências que ficam para próxima rodada

1. Cron `reconciliar-ativacao-parcial` (15 min) consumindo `parciais[]`.
2. Template Meta `instalacao_aguardando_rota_pos_fotos` (depende de aprovação Meta).
3. Frente 4 estrutural: ~10 edges de fluxos legados listadas em `edges-pending-propagation`.
4. Auditoria de RPCs `RETURNS TABLE` com nomes OUT ambíguos (do QUJ4C96 — confirmar se a migração já cobriu todas).

Após sua aprovação, implemento na ordem: Frente 1 → Frente 2 → memórias.