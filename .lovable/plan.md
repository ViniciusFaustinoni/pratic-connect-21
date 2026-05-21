
## Plano — Limpeza de cotações + regra da placa presa (refinado)

Resposta 4 incorporada: **aviso de placa prestes a expirar = card pulsante + popup ao clicar**, sem WhatsApp. Mesmo padrão do `FlagTravada.tsx` já existente (bolinha pulsante + tooltip), agora também com popup de detalhe.

Para 1–3 sigo os defaults que propus — me avise se quiser ajustar antes de implementar:
- (1) renovação por movimentação ativada (24h por interação, teto 120h)
- (2) defaults: 48h reserva inicial / 24h renovação / 120h teto / 30d arquivar morta
- (3) reativação: dono original sempre; outro consultor só se a placa não estiver presa por terceiro

---

### 1) Configurações novas em `configuracoes_sistema`

| chave | default | papel |
|---|---|---|
| `prazo_placa_presa_horas` | 48 | reserva inicial ao criar cotação |
| `prazo_renovacao_movimentacao_horas` | 24 | quanto cada movimento estende |
| `prazo_teto_placa_presa_horas` | 120 | limite máximo absoluto |
| `prazo_alerta_placa_expirando_horas` | 12 | quando o card começa a pulsar |
| `prazo_arquivar_cotacao_morta_dias` | 30 | rascunho/enviada sem movimento → `expirada` |

Tudo editável em `/configuracoes/sistema`.

### 2) Migration — schema

- `ALTER TABLE cotacoes ADD COLUMN placa_reservada_ate timestamptz, cancelada_por uuid, categoria_cancelamento text, reativada_em timestamptz, reativada_por uuid`.
- Backfill `placa_reservada_ate = created_at + 48h` para registros vivos.
- Adicionar valores `'cancelada'`, `'liberada'`, `'expirada'` ao enum/check de `cotacoes.status`.
- Trigger `trg_cotacoes_renovar_reserva` (BEFORE UPDATE) — quando muda plano, valor, anexa doc, link público é gerado/enviado, mensagem WhatsApp do cliente entra → `placa_reservada_ate = least(now() + renovacao_h, created_at + teto_h)`. Abrir só pra ler **não renova**.
- Trigger `trg_cotacoes_set_cancelada_em` — preenche `cancelada_em`/`cancelada_por` quando `status → 'cancelada'`/`'liberada'`/`'expirada'`.
- Inserts dos defaults em `configuracoes_sistema`.

### 3) Edge functions

- `cancelar-cotacao` — input `{ cotacao_id, categoria, motivo }` (motivo ≥ 10 chars). Marca `status='cancelada'`, libera placa imediatamente (`placa_reservada_ate=now()`).
- `liberar-placa-cotacao` — substitui o UPDATE direto do `PlacaDuplicadaModal` (que hoje grava `'recusada'`, contaminando relatórios). Marca `status='liberada'` + `motivo_cancelamento='[gestão] Liberação manual'`. Restringido a gestor/coordenador/diretor.
- `reativar-cotacao` — bloqueia se placa estiver presa por terceiro; dono original tem prioridade.
- Cron `cron-liberar-placas-presas` (hourly) — toda cotação com `placa_reservada_ate < now()` e status `rascunho`/`enviada` vira `'liberada'` com motivo `[auto] Reserva da placa expirou`.
- Cron `cron-arquivar-cotacoes-mortas` (daily) — `rascunho`/`enviada`/`liberada` sem movimento há `prazo_arquivar_cotacao_morta_dias` → `'expirada'`.

### 4) Frontend

- `src/hooks/useVerificarPlaca.ts` — trocar filtro `created_at >= now()-48h` por `placa_reservada_ate > now()`.
- `src/components/cotacoes/PlacaDuplicadaModal.tsx` — botão "Liberar placa" passa a chamar `liberar-placa-cotacao`; mostrar `placa_reservada_ate` real em vez de `addHours(createdAt, 48)`.
- `src/pages/vendas/Cotacoes.tsx:352` — incluir `'cancelada'`, `'liberada'`, `'expirada'` em `STATUS_FINALIZADAS` (aba Finalizadas), com chips e cores próprias.
- **Novo `FlagPlacaExpirando.tsx`** (clonar padrão do `FlagTravada.tsx`): bolinha **âmbar pulsante** quando faltam ≤ `prazo_alerta_placa_expirando_horas` para expirar; **vermelha pulsante** nas últimas 2h. Clique no card abre um `Dialog` com:
  - placa, contador regressivo HH:MM, data exata de expiração
  - botão "Movimentar agora" (atalho para abrir a cotação)
  - botão "Cancelar cotação" (abre o `CancelarCotacaoDialog`)
- **Novo `CancelarCotacaoDialog.tsx`** — combo de categoria (`cliente_desistiu`, `comprou_concorrente`, `valor_alto`, `nao_atendeu`, `duplicada`, `outro`) + textarea (≥ 10 chars), botão destructive. Mesmo padrão visual de `ConfirmacaoExclusaoDialog.tsx`.
- **Novo `CotacaoArquivadaBanner.tsx`** — banner no topo do detalhe quando status é terminal não-comercial, mostrando motivo/categoria/quem fez/quando, com botão "Reativar".
- `src/hooks/useCotacoes.ts` — incluir os novos campos no select e nos tipos.

### 5) Estado final dos status de cotação

| status | quem causa | placa liberada? | conta como venda? |
|---|---|---|---|
| `rascunho` / `enviada` / `aceita` | fluxo normal | não | em andamento |
| `recusada` | cliente recusou proposta | sim | não (perdida comercial) |
| `cancelada` | consultor cancelou manual | sim (na hora) | não |
| `liberada` | cron horário OU gestor | sim | não |
| `expirada` | cron diário (30d morta) | sim | não |

Todas as terminais ficam na aba **Finalizadas**, podem ser reativadas, e **nenhuma é apagada do banco**.

### Fora de escopo

- Mexer no fluxo de `recusada` (continua significando "cliente recusou proposta").
- Notificação WhatsApp ao consultor (substituída pelo card pulsante + popup, conforme você definiu).
- Mudar a tela de gestão de configurações — só inserir as novas chaves no seed.
