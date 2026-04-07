

# Plano: Atribuição Automática — Manter duplo disparo (18h + 7h) + Fila por proximidade

## Fluxo Completo

```text
VÉSPERA 18h ──► Dispara confirmação WhatsApp para agendamentos do DIA SEGUINTE
                (template confirmacao_vespera_v1)
                Marca: 'aguardando_confirmacao_vespera'
                │
                ▼
        Se confirmar → marca 'confirmada' → NÃO recebe msg de manhã
        Se não responder → continua 'aguardando_confirmacao_vespera'
                │
                ▼
MANHÃ 7h ──► Dispara confirmação para quem NÃO confirmou na véspera
             + Todos os agendamentos novos (encaixes noturnos, etc.)
             (template confirmacao_manha_v1)
             Marca: 'aguardando_confirmacao_manha'
                │
                ▼
        Aguarda resposta "SIM"
                │
     ┌──────────┴──────────┐
  "SIM"               Sem resposta
     │                     │
     ▼                     ▼
  'confirmada'        Expira (cron existente)
     │
     ▼
  Motor de atribuição (cron 5min)
  Pega serviços 'confirmada' do dia
  Atribui ao vistoriador ATIVO mais próximo
  Respeitando PERÍODO (manhã/tarde)
```

## Alterações

### 1. `supabase/functions/confirmar-vistorias-manha-cron/index.ts`
- **Manter** lógica dupla véspera/manhã como está
- **Ampliar** o filtro da manhã: além de `aguardando_confirmacao_vespera`, incluir também serviços com `confirmacao_whatsapp IS NULL` (encaixes criados após as 18h da véspera, agendamentos de última hora)
- Alterar horário do cron da manhã de 11h UTC (8h BRT) para **10h UTC (7h BRT)**

### 2. `supabase/functions/cron-atribuir-tarefas/index.ts`
- **Remover** o bloqueio por `atribuicao_manual_rotas` (linhas 110-123) — o motor automático não deve ser impedido por essa flag
- Manter apenas `fila_atribuicao_ativa` como liga/desliga geral
- **Adicionar filtro**: na busca de serviços, exigir `confirmacao_whatsapp = 'confirmada'` para serviços do dia — só confirmados entram na fila
- **Adicionar filtro de período**: ao selecionar serviço, verificar se o período do agendamento (manhã/tarde) é compatível com o horário atual (manhã = antes das 12h, tarde = após 12h)

### 3. `src/components/rotas/ConfiguracoesFilaAtribuicao.tsx`
- Exibir alerta quando `atribuicao_manual_rotas = true` informando que essa flag **não bloqueia mais** o motor automático (apenas controla UI de rotas manuais)
- Mostrar status efetivo do motor baseado apenas em `fila_atribuicao_ativa`

### 4. Banco de dados
- Atualizar pg_cron do disparo manhã para `0 10 * * 1-6` (7h Brasília, seg-sáb)
- Manter pg_cron do disparo véspera em `0 21 * * 1-6` (18h Brasília, seg-sáb)
- Setar `atribuicao_manual_rotas = false`

## Arquivos modificados
- `supabase/functions/confirmar-vistorias-manha-cron/index.ts`
- `supabase/functions/cron-atribuir-tarefas/index.ts`
- `src/components/rotas/ConfiguracoesFilaAtribuicao.tsx`

