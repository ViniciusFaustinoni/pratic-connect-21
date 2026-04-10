

## Plano: Alerta de follow-ups esgotados + Suspensão de cobertura por inativação de rastreador

### Requisito 1: Alerta de imprevistos sem reagendamento (3h-48h)

**Contexto**: Após 3 follow-ups (3h) sem resposta, o serviço fica em `status = 'nao_compareceu'` com `reagendamento_followup_count = 3` e sem nova data agendada. O monitoramento precisa ser alertado para intervir manualmente.

**Mudanças:**

1. **Hook `useImprevistosSemResposta`** (novo)
   - Query em `servicos` onde: `reagendamento_followup_count >= 3`, status em (`nao_compareceu`, `imprevisto_pendente`), `reagendamento_enviado_em` entre 3h e 48h atrás, sem serviço reagendado vinculado
   - Retorna contagem e dados para o alerta

2. **Componente `AlertaImprevistosPendentes`** (novo)
   - Banner amarelo/laranja no topo de `VistoriasInstalacoesMon.tsx` (acima das tabs)
   - Exibe: "X imprevistos aguardando contato manual" com botao "Ver imprevistos"
   - Botão redireciona para `/monitoramento/imprevistos` com filtro pré-aplicado

3. **`ImprevistosPainel.tsx` — Adicionar modal de reagendamento manual**
   - Nova coluna "Ação" na tabela com botão "Reagendar" para imprevistos com follow-ups esgotados
   - Modal com: seleção de data/horário, período (M/T), e botão confirmar
   - Ao confirmar: cria novo serviço com os dados do associado, atualiza status do serviço antigo

4. **`useImprevistos.ts` — Incluir `reagendamento_followup_count`** no select para filtrar/exibir status de follow-up na tabela

### Requisito 2: Suspensão de cobertura por não ativação do rastreador (48h)

**Contexto**: 48h após `data_assinatura` do contrato, se o rastreador não foi instalado/ativado, a cobertura deve ser suspensa com badge visual.

**Mudanças:**

1. **Migration SQL**
   - Adicionar coluna `cobertura_suspensa boolean DEFAULT false` na tabela `veiculos`
   - Adicionar coluna `cobertura_suspensa_motivo text` na tabela `veiculos`
   - Adicionar coluna `cobertura_suspensa_em timestamptz` na tabela `veiculos`

2. **Edge Function `cron-suspender-cobertura-inativacao`** (nova, cron 1x/hora)
   - Busca contratos com `data_assinatura` > 48h atrás
   - Verifica se o veículo vinculado tem instalação concluída (serviço tipo `instalacao` com status `concluida`)
   - Se não: atualiza `veiculos.cobertura_suspensa = true`, motivo = "Rastreador não ativado em 48h"
   - Se já ativado depois: reverte a suspensão

3. **`BadgeCobertura.tsx` e `BadgeCoberturaCompact` — Novo estado "Suspensa"**
   - Aceitar nova prop `coberturaSuspensa`
   - Exibir badge vermelho/laranja com ícone `ShieldAlert`: "Cobertura Suspensa"
   - Tooltip: "Cobertura suspensa por não ativação do rastreador em 48h"
   - Prioridade: suspensa > total > roubo/furto > sem cobertura

4. **Atualizar componentes que usam BadgeCobertura** para passar a nova prop `coberturaSuspensa` do veículo

### Arquivos afetados
- `src/hooks/useImprevistosSemResposta.ts` (novo)
- `src/components/monitoramento/AlertaImprevistosPendentes.tsx` (novo)
- `src/pages/monitoramento/VistoriasInstalacoesMon.tsx` (adicionar alerta)
- `src/pages/monitoramento/ImprevistosPainel.tsx` (modal reagendamento + coluna ação)
- `src/hooks/useImprevistos.ts` (incluir followup_count no select)
- `supabase/migrations/nova.sql` (colunas cobertura_suspensa)
- `supabase/functions/cron-suspender-cobertura-inativacao/index.ts` (novo)
- `src/components/veiculos/BadgeCobertura.tsx` (estado suspensa)
- `src/pages/cadastro/Associados.tsx` (passar prop suspensa)

