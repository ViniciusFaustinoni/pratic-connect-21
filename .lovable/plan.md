
# Corrigir enum `status_ordem_servico` no banco de dados

## Problema
O enum `status_ordem_servico` no banco nao possui os valores `pendente_assinatura` e `finalizado`. Quando o sistema tenta gravar esses status, o banco rejeita com o erro:

> "invalid input value for enum status_ordem_servico: pendente_assinatura"

### Valores atuais do enum:
`rascunho`, `aguardando_orcamento`, `orcamento_enviado`, `aguardando_aprovacao`, `aprovado`, `em_execucao`, `aguardando_peca`, `concluido`, `aguardando_pagamento`, `pago`, `cancelado`

### Valores que faltam:
- `pendente_assinatura` -- usado quando o Termo de Saida e enviado para assinatura
- `finalizado` -- usado quando o veiculo e liberado apos assinatura

## Solucao

### 1. Migration SQL -- adicionar valores ao enum

```sql
ALTER TYPE status_ordem_servico ADD VALUE IF NOT EXISTS 'pendente_assinatura';
ALTER TYPE status_ordem_servico ADD VALUE IF NOT EXISTS 'finalizado';
```

### 2. Atualizar tipos TypeScript

**Arquivo: `src/integrations/supabase/types.ts`**
- Adicionar `pendente_assinatura` e `finalizado` ao tipo `status_ordem_servico` (enum e array)

### 3. Atualizar labels e cores

**Arquivo: `src/types/database.ts`**
- Adicionar entradas em `STATUS_ORDEM_SERVICO_LABELS` e `STATUS_ORDEM_SERVICO_COLORS` para os novos status:
  - `pendente_assinatura`: "Pendente Assinatura" (cor amber)
  - `finalizado`: "Finalizado" (cor green)

Nenhuma outra mudanca e necessaria -- o codigo em `OSConclusaoModal.tsx` ja usa esses valores, so faltava o banco aceita-los.

## Arquivos alterados
- SQL migration (enum)
- `src/integrations/supabase/types.ts` (tipos)
- `src/types/database.ts` (labels/cores)
