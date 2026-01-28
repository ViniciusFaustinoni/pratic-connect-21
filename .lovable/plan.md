
# Revisao do Sistema de Confirmacao de Agendamento via WhatsApp

## Problemas Identificados

### 1. RPC Nao Retorna Campos de Confirmacao (CRITICO)

A funcao `buscar_tarefa_atual_profissional` **NAO inclui** os campos `confirmacao_whatsapp` e `confirmado_via_whatsapp_em` na sua definicao. Isso significa que o hook `useTarefaAtual` nao recebe esses dados, mesmo que o codigo tente mapea-los (linhas 94-95 usam cast `as any` que retorna `null`).

**Evidencia:**
```sql
-- Campos retornados pela RPC atual (migracao 20260123222737):
RETURNS TABLE (
  id UUID,
  tipo TEXT,
  status TEXT,
  ...
  vistoria_origem_id UUID
  -- FALTAM: confirmacao_whatsapp, confirmado_via_whatsapp_em
)
```

**Impacto:** O badge de confirmacao no `TarefaAtualCard.tsx` nunca exibe o status correto.

---

### 2. CRON Job NAO Configurado (CRITICO)

A query no banco de dados retorna **vazio** para jobs cron relacionados a confirmacao:
```sql
SELECT * FROM cron.job WHERE jobname LIKE '%confirm%' OR '%agendamento%';
-- Resultado: []
```

**Impacto:** A edge function `confirmar-agendamento-cron` **nunca e executada automaticamente**. Nenhuma mensagem de confirmacao esta sendo enviada.

---

### 3. Valor Incorreto no CHECK Constraint

Na migracao, o campo `confirmacao_whatsapp` na tabela `servicos` aceita:
```sql
CHECK (confirmacao_whatsapp IN ('pendente', 'enviada', 'confirmada', 'reagendado', 'nao_respondeu'))
```

Mas no webhook, ao confirmar, o codigo atualiza para:
```typescript
confirmacao_whatsapp: 'confirmado'  // Deveria ser 'confirmada'
```

**Impacto:** Potencial erro de constraint violation ao processar confirmacoes.

---

### 4. Logs da Edge Function Vazios

Nenhum log encontrado para `confirmar-agendamento-cron`, confirmando que a funcao nunca foi executada.

---

### 5. Pagina de Acompanhamento Usa Tabela Legacy

A `AcompanhamentoProposta.tsx` busca `confirmacao_whatsapp` de forma indireta:
```typescript
// Busca na tabela 'instalacoes' (legacy)
const { data: instalacoes } = await supabase.from('instalacoes').select(...)

// Depois busca em 'servicos' via instalacao_origem_id
const { data: servico } = await supabase
  .from('servicos')
  .select('confirmacao_whatsapp')
  .eq('instalacao_origem_id', instalacoes[0].id)
```

Isso funciona, mas poderia ser simplificado para consultar diretamente a tabela `servicos`.

---

## Plano de Correcao

### Fase 1: Corrigir RPC para Retornar Campos de Confirmacao

**Arquivo:** Nova migracao SQL

Atualizar a funcao `buscar_tarefa_atual_profissional` para incluir os campos:
- `confirmacao_whatsapp TEXT`
- `confirmado_via_whatsapp_em TIMESTAMPTZ`

```sql
DROP FUNCTION IF EXISTS public.buscar_tarefa_atual_profissional(UUID);

CREATE OR REPLACE FUNCTION public.buscar_tarefa_atual_profissional(p_profissional_id UUID)
RETURNS TABLE (
  -- campos existentes...
  confirmacao_whatsapp TEXT,
  confirmado_via_whatsapp_em TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    -- campos existentes...
    s.confirmacao_whatsapp,
    s.confirmado_via_whatsapp_em
  FROM servicos s 
  -- resto da query...
END;
$$;
```

---

### Fase 2: Corrigir Valor do Status no Webhook

**Arquivo:** `supabase/functions/whatsapp-webhook/index.ts`

Alterar linha 563:
```typescript
// De:
confirmacao_whatsapp: 'confirmado'

// Para:
confirmacao_whatsapp: 'confirmada'
```

---

### Fase 3: Configurar CRON Job

**Metodo:** Executar SQL diretamente no Supabase SQL Editor

O cron job deve ser configurado manualmente pelo usuario:

```sql
SELECT cron.schedule(
  'confirmar-agendamentos-whatsapp',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/confirmar-agendamento-cron',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer [SERVICE_ROLE_KEY]"}'::jsonb
  );
  $$
);
```

---

### Fase 4: Atualizar Hook useTarefaAtual

**Arquivo:** `src/hooks/useTarefaAtual.ts`

O hook ja esta preparado para receber os campos (linhas 94-95), mas precisa garantir que nao use `as any`. Apos corrigir a RPC, os campos serao retornados corretamente.

---

### Fase 5: Atualizar TarefaAtualCard (Valor Correto)

**Arquivo:** `src/components/vistoriador/TarefaAtualCard.tsx`

Verificar se os badges estao usando o valor correto:
```tsx
// Atual: 'confirmado' (incorreto)
{tarefa.confirmacao_whatsapp === 'confirmado' && ...}

// Corrigido: 'confirmada' (para bater com o constraint)
{tarefa.confirmacao_whatsapp === 'confirmada' && ...}
```

---

## Resumo das Alteracoes

| Arquivo | Tipo | Alteracao |
|---------|------|-----------|
| Nova migracao SQL | Criar | Atualizar RPC para incluir campos de confirmacao |
| `whatsapp-webhook/index.ts` | Modificar | Corrigir valor 'confirmado' para 'confirmada' |
| `TarefaAtualCard.tsx` | Modificar | Corrigir valor do badge para 'confirmada' |
| SQL Editor (manual) | Configurar | Criar cron job para execucao automatica |

---

## Secao Tecnica

### Estrutura Final da RPC

```text
buscar_tarefa_atual_profissional(p_profissional_id)
    |
    +-- id, tipo, status, data_agendada, hora_agendada, periodo
    +-- associado_id, associado_nome, associado_telefone, associado_whatsapp
    +-- veiculo_id, veiculo_placa, veiculo_marca, veiculo_modelo, veiculo_cor
    +-- logradouro, numero, bairro, cidade, uf, cep, latitude, longitude
    +-- cotacao_id, contrato_id, rastreador_id, imei_rastreador
    +-- local_vistoria, observacoes, rota_id, iniciada_em, em_rota_em
    +-- instalacao_origem_id, vistoria_origem_id
    +-- confirmacao_whatsapp (NOVO)
    +-- confirmado_via_whatsapp_em (NOVO)
```

### Fluxo Esperado Apos Correcoes

```text
1. CRON executa a cada minuto
   |
   v
2. confirmar-agendamento-cron busca servicos 1h a frente
   |
   v
3. Envia mensagem via whatsapp-send-text
   |
   v
4. Atualiza servicos.confirmacao_whatsapp = 'enviada'
   |
   v
5. Cliente responde via WhatsApp
   |
   v
6. whatsapp-webhook processa resposta com IA
   |
   v
7. Se confirmou: atualiza para 'confirmada'
   |
   v
8. useTarefaAtual recebe campo via RPC atualizada
   |
   v
9. TarefaAtualCard exibe badge "Cliente confirmou"
```
