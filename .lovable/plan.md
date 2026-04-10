

## Plano: Corrigir duplicação no mapa + Simplificar imprevisto + Follow-up automático

### Problema 1: Duplicação no mapa
A `view_vistorias_mapa` filtra instalações por `i.status IN ('agendada', ...)` — o status da tabela `instalacoes`. Quando o técnico marca imprevisto, apenas o `servicos.status` muda para `imprevisto_pendente`/`nao_compareceu`, mas `instalacoes.status` continua `agendada`. Resultado: a instalação original continua aparecendo no mapa mesmo após o imprevisto.

### Problema 2: Modal de imprevisto complexo
Atualmente tem 5 motivos com classificação automática de origem. O usuário quer apenas 2 opções diretas: "Imprevisto do Técnico" e "Imprevisto do Associado".

### Problema 3: Sem follow-up de reagendamento
Após enviar o link de reagendamento, não há lembretes se o associado não reagendar.

---

### Mudanças

**1. Migration SQL — Corrigir view + adicionar coluna de follow-up**

Recriar `view_vistorias_mapa` adicionando filtro nas seções VISTORIAS e INSTALACOES para excluir registros onde o serviço vinculado (`sv`/`si`) tem status terminal:
```sql
-- Na seção INSTALACOES, adicionar ao WHERE:
AND (si.id IS NULL OR si.status NOT IN ('imprevisto_pendente','nao_compareceu','cancelada','concluida'))

-- Mesma lógica para seção VISTORIAS
AND (sv.id IS NULL OR sv.status NOT IN ('imprevisto_pendente','nao_compareceu','cancelada','concluida'))
```

Adicionar coluna para rastrear follow-ups:
```sql
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS reagendamento_followup_count int DEFAULT 0;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS reagendamento_ultimo_followup_em timestamptz;
```

**2. `ImprevistoBotao.tsx` — Simplificar para 2 opções**

Substituir o Select de 5 motivos por 2 botões grandes:
- "Imprevisto do Técnico" → `imprevisto_origem: 'instalador'`
- "Imprevisto do Associado" → `imprevisto_origem: 'associado'`

Campo de observações opcional em ambos. Remover `MOTIVOS_IMPREVISTO` e `ORIGEM_POR_MOTIVO`. O motivo salvo será simplesmente "Imprevisto do técnico" ou "Imprevisto do associado" + observações.

Manter a pergunta "pode continuar a rota?" para imprevisto do técnico.

**3. Edge Function `cron-followup-reagendamento` — Follow-ups 1h, 2h, 3h**

Nova edge function que roda via cron (a cada 15min):
- Busca serviços com `reagendamento_enviado_em IS NOT NULL` e `status = 'nao_compareceu'` e `reagendamento_followup_count < 3`
- Para cada serviço, calcula tempo desde `reagendamento_enviado_em`
- Se passou 1h e count=0, ou 2h e count=1, ou 3h e count=2: envia template Meta `reagendamento_servico` (mesmo template, mesmo link) e incrementa o contador
- Atualiza `reagendamento_followup_count` e `reagendamento_ultimo_followup_em`

**4. Deploy da edge function + configurar cron**

---

### Arquivos afetados
- `supabase/migrations/nova_migration.sql` (view + colunas)
- `src/components/vistoriador/ImprevistoBotao.tsx` (simplificar UI)
- `supabase/functions/cron-followup-reagendamento/index.ts` (nova)

