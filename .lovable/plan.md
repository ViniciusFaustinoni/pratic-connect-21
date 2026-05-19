## Objetivo

Transformar a "Regra do 1% / FIPE Menor" de uma **aprovação bloqueante** (com checkbox + justificativa + supervisor aprovar/recusar) em uma **aplicação automática** que apenas alimenta uma fila de **ciência** para os supervisores.

## Comportamento esperado

### No modal de cotação (`CotacaoFormDialog.tsx`)

- Quando o veículo é **elegível** à Regra do 1% e a Diretoria mantém `fipe_menor_ativo = true`:
  - Card "Redução de Cota" aparece **informativo** (verde), mostrando FIPE atual, FIPE−1% e faixa reduzida.
  - **Não há checkbox** "Solicitar FIPE Menor" nem campo de justificativa.
  - Os planos são listados e precificados **já na faixa reduzida** automaticamente — o vendedor enxerga o preço final.
- Quando o veículo **não é elegível** (faixa R$30k–R$35k com rastreador obrigatório, blindado, acima do teto do tipo, abaixo do mínimo, ou Diretoria desligou): **card some por completo**; planos seguem na faixa cheia. Sem amber, sem aviso.

### Persistência ao salvar a cotação

- Cotação elegível salva direto com `fipe_menor_aprovado = true`, `fipe_faixa_cobranca_min/max` na faixa reduzida e `solicitar_fipe_menor = true` (auto).
- Sistema cria um registro em `aprovacoes_fipe_menor` com `status = 'ciente_pendente'` apenas para alimentar a fila. **Não trava o fluxo da cotação.**
- O toggle global `fipe_menor_ativo` desligado afeta só **novas** cotações; cotações existentes preservam a redução já aplicada.

### Tela `/vendas/aprovacoes-fipe` → aba renomeada "Redução de Cota"

- Sub-abas: **Pendentes** (não vistos), **Cientes** (já marcados), **Todas**.
- Card de cada solicitação mostra: veículo, FIPE real, faixa original × faixa reduzida, mensalidade original × reduzida, vendedor, data.
- Botão único: **"Marcar como Ciente"** (com opcional caixa de observação). Não existe "Recusar" — supervisor não pode reverter o preço.
- Ao marcar ciente: registra `status = 'ciente'`, `supervisor_id`, `respondido_em`. Cotação não é tocada.

### Migração do histórico

- Todos os registros atuais em `pendente` / `aprovado` / `recusado` viram `ciente` (data preservada). Fila começa zerada de pendências históricas; nova lógica passa a valer para cotações criadas a partir da virada.

## Mudanças técnicas

### 1. Banco (`supabase--migration`)

- `aprovacoes_fipe_menor.status`: ampliar enum/text para aceitar `'ciente_pendente'` e `'ciente'`. Manter `'pendente'/'aprovado'/'recusado'` por compatibilidade de leitura.
- Backfill: `UPDATE aprovacoes_fipe_menor SET status = 'ciente' WHERE status IN ('pendente','aprovado','recusado')`.
- Campos `justificativa` e `observacao_supervisor` passam a ser **opcionais** (drop NOT NULL onde houver).

### 2. Frontend modal (`src/components/cotacoes/CotacaoFormDialog.tsx`)

- Remover checkbox "Solicitar FIPE Menor" e Textarea de justificativa.
- Card "Redução de Cota" exibido apenas no estado **elegível-informativo** (verde, sem ação).
- Quando inelegível → card não renderiza (remover ramo amber).
- No `onSubmit`/salvar cotação: se elegível, gravar `fipe_menor_aprovado=true` + faixa reduzida direto em `cotacoes`, e disparar `useRegistrarCienciaFipeMenor` (novo hook) para criar `aprovacoes_fipe_menor` com `status='ciente_pendente'`.
- Pricing engine: garantir que os planos listem valor usando `fipe_faixa_cobranca_min/max` quando `fipe_menor_aprovado=true` — já é o comportamento atual após aprovação, agora vale desde o salvamento.

### 3. Hook (`src/hooks/useAprovacoesFipeMenor.ts`)

- Renomear/adicionar:
  - `useCriarSolicitacaoFipeMenor` → `useRegistrarCienciaFipeMenor` (insert com `status='ciente_pendente'`, sem mexer em `solicitar_fipe_menor` como flag de pendência).
  - Adicionar `useMarcarCienteFipeMenor({ id, observacao })` que faz `UPDATE status='ciente', supervisor_id, respondido_em`.
  - Manter `useAprovacoesFipeMenor(statusFilter)` (já filtra por status).
- Remover `useAprovarFipeMenor` e `useRecusarFipeMenor` (ou marcar deprecated e parar de usar).

### 4. Tela `/vendas/aprovacoes-fipe` (`src/pages/vendas/AprovacoesFipe*.tsx`)

- Renomear aba "FIPE Menor" → "Redução de Cota". Trocar ícone se quiser (manter `TrendingDown` está ok).
- Sub-abas: Pendentes (`status='ciente_pendente'`), Cientes (`status='ciente'`), Todas.
- Card: substituir botões "Aprovar/Recusar" por único botão "Marcar como Ciente" (com Dialog opcional para observação).
- Manter aba "Elegibilidade" intocada.

### 5. Verificações finais

- `useAprovacaoFipeLimitePorCotacao` e `useAprovacaoFipeDiretoriaPorCotacao` continuam funcionando — são **fluxos diferentes** (alto valor FIPE / dupla aprovação). Não confundir.
- Buscar referências a `useAprovarFipeMenor`/`useRecusarFipeMenor` no projeto e limpar.
- Toast no salvar cotação elegível: "Redução de cota aplicada (Regra do 1%) — supervisor será notificado para ciência".

## Pontos fora do escopo

- Notificação por e-mail/in-app ao supervisor (pode ser próxima iteração).
- Mexer no fluxo de "Autorização FIPE Alto" (dupla aprovação) — esse continua bloqueante.
- Mudar as regras de elegibilidade da Regra do 1% (limites, blindados, faixa rastreador) — permanecem como hoje.
