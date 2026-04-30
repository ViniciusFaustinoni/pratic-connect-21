## Objetivo

Permitir gerenciar as **API Keys** de OpenAI e Anthropic diretamente no card de IA (em `/configuracoes/integracoes/ia`), e corrigir a lista de modelos para refletir os lançamentos mais recentes (com **Claude Opus 4.5** como topo da Anthropic).

---

## 1. Inputs de API Key no front

No `AIModelConfigCard.tsx`, quando o provedor for `openai` ou `anthropic`, mostrar:

- Campo `Input` mascarado (type=password, com botão olho para revelar) para a chave correspondente:
  - `OPENAI_API_KEY` quando provedor = OpenAI
  - `ANTHROPIC_API_KEY` quando provedor = Anthropic
- Badge "Configurada ✓" / "Não configurada" indicando se já existe a secret no backend.
- Botão **Salvar chave** que envia para uma nova edge function `ai-secret-manager`.
- Link/ajuda discreta: "A chave fica armazenada de forma segura no backend (nunca exposta ao navegador)."

Alterar a `Alert` atual (que pedia para configurar manualmente em Cloud → Settings) para algo mais simples, já que agora a configuração é feita pela UI.

## 2. Edge function `ai-secret-manager`

Nova função (`supabase/functions/ai-secret-manager/index.ts`) com duas ações:

- `GET status` → retorna `{ openai: boolean, anthropic: boolean }` indicando presença das secrets (nunca o valor).
- `POST set` → recebe `{ provider: 'openai'|'anthropic', value: string }`, valida que o usuário autenticado é Diretor ou Desenvolvedor, e grava a secret usando a Management API do Supabase.

Como secrets de runtime de Edge Functions não podem ser gravadas pelo runtime padrão, a função vai usar a **Supabase Management API** (`PATCH /v1/projects/{ref}/secrets`) com um `SUPABASE_ACCESS_TOKEN`. Caso o token não esteja disponível, a função retorna 501 com instrução clara.

Alternativa mais simples (preferida): armazenar as keys cifradas em uma nova tabela `ai_provider_keys` (singleton por provedor, RLS apenas Diretor/Desenvolvedor leem; gravação via service role na edge), e o `_shared/ai-client.ts` passa a ler dessa tabela como **prioridade**, caindo para `Deno.env.get(...)` se a tabela estiver vazia. Isso evita depender de Management API e funciona 100% pelo front.

**Decisão técnica:** usaremos a tabela `ai_provider_keys` (mais simples e auditável).

### Schema novo
```sql
create table public.ai_provider_keys (
  provider text primary key check (provider in ('openai','anthropic')),
  api_key text not null,                      -- valor em claro (acessado só via service role na edge)
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.ai_provider_keys enable row level security;

-- Apenas leitura de presença (boolean) feita via RPC; nenhuma policy de SELECT direto para clientes
create policy "diretor_dev_can_manage" on public.ai_provider_keys
  for all
  using (public.has_role(auth.uid(),'diretor') or public.has_role(auth.uid(),'desenvolvedor'))
  with check (public.has_role(auth.uid(),'diretor') or public.has_role(auth.uid(),'desenvolvedor'));

create or replace function public.ai_provider_keys_status()
returns table(provider text, configured boolean)
language sql security definer set search_path=public as $$
  select p.provider, exists(select 1 from public.ai_provider_keys k where k.provider = p.provider) as configured
  from (values ('openai'),('anthropic')) p(provider);
$$;
```

### `_shared/ai-client.ts`
Adicionar helper `getProviderKey(provider)` que:
1. Tenta `select api_key from ai_provider_keys where provider = ?` usando service role.
2. Se vazio, cai para `Deno.env.get('OPENAI_API_KEY' | 'ANTHROPIC_API_KEY')`.
3. Se ambos vazios e provider != lovable, faz fallback para Lovable Gateway (já existe).

### Edge function `ai-secret-manager`
- `POST { action: 'set', provider, value }` → upsert na tabela (service role).
- `POST { action: 'remove', provider }` → delete.
- `POST { action: 'status' }` → chama RPC `ai_provider_keys_status`.

## 3. Hook `useAIProviderKeys`

Novo hook em `src/hooks/useAIProviderKeys.ts`:
- `useAIProviderKeysStatus()` → react-query que invoca a edge `ai-secret-manager` action `status`.
- `useSetAIProviderKey()` → mutation para gravar a chave.
- `useRemoveAIProviderKey()` → mutation para remover.

## 4. Atualização da lista de modelos

Em `src/hooks/useAIModelConfig.ts`, atualizar `AI_PROVIDER_MODELS`:

**Anthropic** (mais recente primeiro):
- `claude-opus-4-5` — Claude Opus 4.5 (mais recente)
- `claude-sonnet-4-5` — Claude Sonnet 4.5
- `claude-haiku-4-5` — Claude Haiku 4.5 (rápido)
- `claude-opus-4-1` — Claude Opus 4.1
- `claude-3-7-sonnet-latest` — Claude 3.7 Sonnet

**OpenAI** (manter "mais recente" no topo):
- `gpt-5.2` — GPT-5.2 (mais recente)
- `gpt-5.1` — GPT-5.1
- `gpt-5` — GPT-5
- `gpt-5-mini` — GPT-5 Mini
- `gpt-5-nano` — GPT-5 Nano
- `o4-mini` — o4-mini (raciocínio)
- `gpt-4.1` — GPT-4.1
- `gpt-4o` — GPT-4o (multimodal)

**Lovable Gateway**: adicionar `google/gemini-3-pro-preview` no topo, manter os demais.

## 5. UX do card

```
Provedor: [Anthropic ▼]    Modelo: [Claude Opus 4.5 ▼]

┌─ Chave da API Anthropic ─────────────────────────────┐
│ [••••••••••••••••••••••••]  [👁]  [Salvar] [Remover] │
│ Status: ✓ Configurada                                │
└──────────────────────────────────────────────────────┘

[Salvar configuração]   ← grava provider+model
```

Quando provedor = Lovable, esconde o bloco de chave e mantém o alert verde atual.

---

## Arquivos

**Criar**
- `supabase/migrations/<ts>_ai_provider_keys.sql`
- `supabase/functions/ai-secret-manager/index.ts`
- `src/hooks/useAIProviderKeys.ts`

**Editar**
- `src/components/integracoes/AIModelConfigCard.tsx` — adicionar bloco de API key, badge de status, mutations.
- `src/hooks/useAIModelConfig.ts` — atualizar listas de modelos (Opus 4.5 no topo da Anthropic, GPT-5.2/5.1 no topo da OpenAI, Gemini 3 Pro no Lovable).
- `supabase/functions/_shared/ai-client.ts` — `getProviderKey()` consulta tabela antes do `Deno.env`.
