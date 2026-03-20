

# Plano Final Consolidado: IA Inteligente de Rotas com Gestão de Conflitos

## Resumo

Este plano unifica todas as melhorias discutidas em uma implementação coesa:
1. **Fila inteligente por proximidade** — serviço perto de instalador ocupado entra na fila dele
2. **Classificação de imprevistos** — distinguir origem (associado vs instalador) para tratamento correto
3. **Redistribuição proativa** — só para imprevistos do instalador; imprevistos do associado apenas reagendam
4. **Visibilidade para o coordenador** — nova aba "Fila" na página de Rotas

---

## Parte 1 — Migration SQL

### Tabela `fila_servicos`

```sql
CREATE TABLE fila_servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id UUID REFERENCES servicos(id) ON DELETE CASCADE NOT NULL,
  profissional_id UUID REFERENCES profiles(id) NOT NULL,
  distancia_km NUMERIC NOT NULL,
  prioridade INTEGER DEFAULT 0, -- 0=normal, 1=redistribuição imprevisto
  status TEXT DEFAULT 'aguardando', -- aguardando, atribuido, expirado, cancelado
  motivo TEXT, -- 'proximidade' ou 'redistribuicao_imprevisto'
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '4 hours'),
  UNIQUE(servico_id, profissional_id)
);
ALTER TABLE fila_servicos ENABLE ROW LEVEL SECURITY;
```

RLS: coordenador (`canEditRotas`) pode SELECT; service_role faz INSERT/UPDATE.

### Coluna `imprevisto_origem` em `servicos`

```sql
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS imprevisto_origem TEXT;
-- Valores: 'associado' ou 'instalador'
```

---

## Parte 2 — `ImprevistoBotao.tsx`: classificar origem

Ao registrar imprevisto, gravar `imprevisto_origem` automaticamente:

- **"Associado ausente"**, **"Endereço incorreto"**, **"Desistência do associado"** → `imprevisto_origem = 'associado'`
- **"Problema no veículo"**, **"Outro"** → `imprevisto_origem = 'instalador'`

Quando o motivo for do instalador, exibir pergunta adicional: "Você consegue continuar a rota?" (Sim/Não). Se "Não", marcar profissional como indisponível para o resto do dia.

---

## Parte 3 — `cron-atribuir-tarefas/index.ts`: 3 alterações

### A) Profissional ocupado → enfileirar serviços próximos

Na linha 184-186, onde hoje faz `continue` quando o profissional tem tarefa ativa:

- **Antes do `continue`**: buscar serviços pendentes a menos de 500m da posição GPS atual do profissional
- Para cada serviço próximo: INSERT na `fila_servicos` (status='aguardando', motivo='proximidade')
- Se o profissional está há 75+ min na tarefa (quase disponível): ampliar raio para 1km
- Depois `continue` normalmente

### B) Profissional livre → consultar fila primeiro

Na linha 189, antes da busca livre nos serviços pendentes:

- Consultar `fila_servicos WHERE profissional_id = X AND status = 'aguardando' ORDER BY prioridade DESC, distancia_km ASC LIMIT 1`
- Se encontrou: atribuir esse serviço (mesmo fluxo existente na linha 456+), marcar fila como 'atribuido'
- Se não encontrou: seguir busca normal sem mudança

### C) Prioridade final de atribuição

```text
1. Fila do profissional (região dele)
   1a. Prioridade 1: redistribuição de imprevisto do instalador
   1b. Prioridade 0: proximidade geográfica
2. Serviço de HOJE + disponível + mais próximo (comportamento atual)
3. Serviço de AMANHÃ + disponível + mais próximo (comportamento atual)
4. Encaixe futuro (comportamento atual)
```

---

## Parte 4 — `cron-reagendamento-automatico/index.ts`: tratamento por origem

Na Parte 1 (órfãos de imprevisto, linhas 47-68), antes de processar, verificar `imprevisto_origem`:

**Se `imprevisto_origem = 'associado'`:**
- Fluxo atual mantido: marcar `nao_compareceu`, enviar link de reagendamento
- NÃO redistribuir (o problema é do cliente)

**Se `imprevisto_origem = 'instalador'`:**
1. Buscar profissionais com GPS ativo
2. Mais próximo disponível a menos de 5km? → Atribuir diretamente
3. Alguém ocupado a menos de 500m? → Inserir na `fila_servicos` com prioridade=1
4. Ninguém próximo? → Reagendar normalmente
5. Redistribuir todos os itens da `fila_servicos` que estavam esperando por esse instalador para o próximo profissional mais perto

---

## Parte 5 — UI: Aba "Fila" em `Rotas.tsx`

Nova aba visível apenas com permissão `canEditRotas`:

- Quantidade de serviços aguardando na fila
- Lista com: endereço, profissional designado, distância, tempo na fila, badge (normal vs urgente)
- Botão "Forçar reatribuição" para coordenador redirecionar manualmente
- Auto-refresh via Realtime na tabela `fila_servicos`

**Novo hook**: `src/hooks/useFilaServicos.ts`

---

## Cenários cobertos

| Cenário | Tratamento |
|---------|-----------|
| Instalador doente | Imprevisto instalador → redistribui rota inteira |
| Cliente ausente | Imprevisto associado → reagenda, instalador segue rota |
| Carro quebrou no meio da rota | Imprevisto instalador → redistribui paradas restantes |
| Dois serviços na mesma rua | Enfileira pro instalador que já está ali |
| Instalador terminou cedo | Sistema consulta fila automaticamente ao ficar livre |
| Caso urgente/VIP | Coordenador usa "Forçar reatribuição" na aba Fila |

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | Tabela `fila_servicos` + coluna `imprevisto_origem` |
| `src/components/vistoriador/ImprevistoBotao.tsx` | Gravar `imprevisto_origem` por motivo |
| `supabase/functions/cron-atribuir-tarefas/index.ts` | Enfileirar ocupados + consultar fila ao ficar livre |
| `supabase/functions/cron-reagendamento-automatico/index.ts` | Tratar diferente por origem |
| `src/hooks/useFilaServicos.ts` | Novo hook |
| `src/pages/monitoramento/Rotas.tsx` | Nova aba "Fila" |

## O que NÃO será alterado

- App do instalador (recebe tarefas via Realtime/Push como hoje)
- Criação manual de rotas no RotaModal
- Notificações existentes (WhatsApp/Push)
- Abas existentes na página de Rotas

