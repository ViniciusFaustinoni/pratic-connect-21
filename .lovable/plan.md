

# CRUD de "Origem do Lead" no módulo Marketing

## Contexto

Atualmente, a origem do lead é um enum fixo no banco (`origem_lead`) com valores genéricos como "instagram", "facebook", "site". O usuário precisa de granularidade maior — por exemplo, "Instagram - Reels", "Instagram - Stories", "Meta Ads", "Facebook - Reels" — para mapear exatamente por qual canal o associado chegou.

As origens de tipo operacional (Migração, Inclusão, Troca de Titularidade) já estão no cotador e não precisam ser alteradas.

## Solução

Criar uma nova tabela `lead_origens` para cadastro dinâmico de origens, e adicionar um campo `origem_detalhe_id` na tabela `leads` que referencia essa tabela. O campo `origem` (enum) existente continua funcionando como categoria principal, e o novo campo funciona como sub-origem detalhada.

## 1. Migração SQL — Nova tabela `lead_origens`

```sql
CREATE TABLE public.lead_origens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,              -- "Instagram - Reels"
  categoria TEXT NOT NULL,         -- "instagram", "facebook", "google", etc (mapeia ao enum origem_lead)
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lead_origens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lead_origens"
  ON public.lead_origens FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage lead_origens"
  ON public.lead_origens FOR ALL TO authenticated
  USING (public.can_manage_users(auth.uid()))
  WITH CHECK (public.can_manage_users(auth.uid()));

-- Adicionar campo na tabela leads
ALTER TABLE public.leads 
  ADD COLUMN origem_detalhe_id UUID REFERENCES public.lead_origens(id);

-- Seed com exemplos iniciais
INSERT INTO public.lead_origens (nome, categoria) VALUES
  ('Instagram - Reels', 'instagram'),
  ('Instagram - Stories', 'instagram'),
  ('Instagram - Feed', 'instagram'),
  ('Facebook - Reels', 'facebook'),
  ('Facebook - Feed', 'facebook'),
  ('Meta Ads', 'facebook'),
  ('Google Ads', 'google'),
  ('Google Orgânico', 'google'),
  ('WhatsApp Direto', 'whatsapp'),
  ('Indicação de Associado', 'indicacao'),
  ('Presencial', 'presencial'),
  ('Telefone', 'telefone'),
  ('Site', 'site'),
  ('Parceiro', 'parceiro');
```

## 2. Nova página — `src/pages/marketing/OrigensLead.tsx`

CRUD completo com:
- Lista de origens com busca, filtro por categoria, toggle ativo/inativo
- Dialog para criar/editar origem (campos: nome, categoria via select, descrição)
- Botão excluir com confirmação
- Badge colorido por categoria
- Contagem de leads vinculados a cada origem

## 3. Novo hook — `src/hooks/useLeadOrigens.ts`

- `useLeadOrigens()` — lista todas as origens
- `useCreateLeadOrigem()` — criar
- `useUpdateLeadOrigem()` — atualizar
- `useDeleteLeadOrigem()` — excluir

## 4. Rota e navegação

- Adicionar rota `/marketing/origens` no `App.tsx`
- Adicionar link no menu lateral do Marketing (sidebar)

## 5. Integração com Leads

- Nos formulários de lead (`LeadFormDialog`, `ConfirmationStep`, `LeadEditDialog`), adicionar select opcional de "Origem Detalhada" que filtra as `lead_origens` pela categoria selecionada em `origem`
- No Kanban e listagem, exibir a origem detalhada quando disponível

## Arquivos

| Arquivo | Ação |
|---|---|
| Nova migração SQL | Criar tabela `lead_origens` + campo `origem_detalhe_id` em leads |
| `src/pages/marketing/OrigensLead.tsx` | Nova página CRUD |
| `src/hooks/useLeadOrigens.ts` | Novo hook |
| `src/components/marketing/OrigemLeadFormDialog.tsx` | Dialog de formulário |
| `src/App.tsx` | Adicionar rota `/marketing/origens` |
| Sidebar/menu Marketing | Adicionar link "Origens de Lead" |
| `src/components/leads/LeadFormDialog.tsx` | Adicionar select de origem detalhada |
| `src/components/leads/LeadEditDialog.tsx` | Adicionar select de origem detalhada |

