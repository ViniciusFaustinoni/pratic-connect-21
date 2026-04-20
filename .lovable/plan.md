

## Diagnóstico — Causa raiz dos dois problemas

Após inspeção do banco, das edge functions, dos hooks e dos cron jobs, identifiquei a **mesma causa raiz** para ambos os problemas:

### Cadeia do bug

1. **App web do técnico** (`useIniciarServico.ts`) envia localização ao banco a cada **5 minutos** (`LOCATION_UPDATE_INTERVAL`).
2. **App nativo** (`backgroundLocationService.ts`) só envia ao **mover-se 50 metros** — técnico parado em residência/instalação não envia nada.
3. **Cron `limpar-servico-inativo-cron`** roda a cada **10 minutos** e marca `em_servico = false` para qualquer registro com `updated_at` mais antigo que **20 minutos**.
4. **Painel "Vistoriadores Ativos"** (`useVistoriadoresAtivos`, `useVistoriadoresRealtime`) filtra por `em_servico = true` → técnico some.
5. **Painel "Equipe"** (`useEquipe.ts`) marca como `offline` qualquer técnico cujo `updated_at` passou de **15 minutos**, mesmo que `em_servico` ainda seja `true`.

### Evidência no banco (consultado agora)

Apenas **WALLACE** está com `em_servico = true` (atualizado há 2 min). Todos os demais técnicos que aparecem online no app pessoal (Kleytonn, Raphael, etc.) estão com `em_servico = false` no banco — **derrubados pelo cron**, não por logout.

### Por que o web sozinho não segura

O `setInterval` de 5 min só funciona enquanto a aba está visível e ativa. Quando o navegador suspende a aba (mobile em background, tela bloqueada, outra aba ativa por >5 min), o intervalo congela. Resultado: 20 min depois o cron derruba.

---

## Plano de correção

### 1) Heartbeat resiliente no app do técnico
Arquivo: `src/hooks/useIniciarServico.ts`

- Reduzir `LOCATION_UPDATE_INTERVAL` de **5 min → 2 min**.
- Adicionar `visibilitychange` listener: ao voltar para a aba, disparar `enviarLocalizacao` imediatamente para evitar gap após suspensão.
- Adicionar `focus` listener idem.
- Quando o `getCurrentPosition` falhar mas o técnico estiver `em_servico`, fazer um **upsert apenas do `updated_at`** (heartbeat sem coordenadas) reusando última lat/lng do state — isso mantém `em_servico=true` mesmo sem GPS.

### 2) Background nativo com heartbeat por tempo
Arquivo: `src/services/backgroundLocationService.ts`

Hoje o watcher só dispara em movimento. Adicionar timer paralelo (`setInterval` de 2 min) que reusa a última posição conhecida e faz upsert para renovar `updated_at`, resolvendo o caso "técnico parado".

### 3) Aumentar tolerância do cron
Arquivo: `supabase/functions/limpar-servico-inativo/index.ts`

- Subir o threshold de **20 → 30 minutos**.
- Antes de marcar `em_servico=false`, validar se o profissional **não tem tarefa ativa** (`em_rota` ou `em_andamento`) na tabela `servicos`. Se tiver, pular — técnico em campo nunca deve ser "expulso".

### 4) Fallback de exibição no painel monitor
Arquivos: `src/hooks/useAtribuicaoManual.ts` (`useVistoriadoresAtivos`) e `src/hooks/useVistoriadoresRealtime.ts`

Trocar o filtro estrito `em_servico = true` por uma regra mais robusta:
- Mostrar quem tem `em_servico = true` **OU** `updated_at >= 30min` **E** possui turno ativo do dia (`turnos_profissionais` sem `fim_turno`).

Isso garante que mesmo se o cron derrubar, o técnico permanece visível enquanto seu turno está aberto.

### 5) Threshold "offline" mais realista
Arquivo: `src/hooks/useEquipe.ts`

Subir `LIMITE_INATIVIDADE_MS` de **15 → 25 minutos** para alinhar com o novo intervalo de heartbeat e evitar pisca-pisca na tela do coordenador.

---

## Validação após deploy

1. Abrir app do técnico (Kleytonn) → confirmar logs `[useIniciarServico] Localização atualizada` a cada 2 min.
2. Bloquear tela do celular por 8 min → ao desbloquear, novo upsert imediato (visibilitychange).
3. Painel `/monitoramento/mapa` aba Equipe → técnico não muda para "offline" durante turno ativo.
4. Rodar manualmente `limpar-servico-inativo` com técnico ativo em tarefa → log "skip — em tarefa".
5. Painel "Atribuição Manual" → contar "Vistoriadores Ativos" deve refletir todos com turno aberto, não só os com GPS recente.

## Arquivos tocados
- `src/hooks/useIniciarServico.ts`
- `src/services/backgroundLocationService.ts`
- `src/hooks/useAtribuicaoManual.ts`
- `src/hooks/useVistoriadoresRealtime.ts`
- `src/hooks/useEquipe.ts`
- `supabase/functions/limpar-servico-inativo/index.ts`

Sem mudança de schema. Sem nova dependência.

