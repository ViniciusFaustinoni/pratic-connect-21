
# Persistir Análise de Risco com IA no Banco de Dados

## Problema
Atualmente a análise de risco é feita apenas em memória (useState). Ao recarregar a página, o resultado é perdido e o usuário precisa clicar em "Analisar" novamente, gastando créditos de IA desnecessariamente.

## Solução
Salvar o resultado da análise no banco de dados e carregá-lo automaticamente ao abrir a página.

## Mudanças

### 1. Nova tabela: `sinistro_analises_ia`

Criar via migration:

```text
CREATE TABLE sinistro_analises_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id UUID NOT NULL REFERENCES sinistros(id) ON DELETE CASCADE,
  pontuacao_risco INTEGER NOT NULL,
  nivel TEXT NOT NULL,
  resumo TEXT NOT NULL,
  fatores JSONB NOT NULL DEFAULT '[]',
  recomendacao TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sinistro_analises_ia_sinistro ON sinistro_analises_ia(sinistro_id);

ALTER TABLE sinistro_analises_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read analises"
  ON sinistro_analises_ia FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role can insert analises"
  ON sinistro_analises_ia FOR INSERT
  TO service_role WITH CHECK (true);
```

### 2. Edge Function: `supabase/functions/analise-risco-ia/index.ts`

Duas mudanças:

- Aceitar novo campo `forcar_reanalise` no body
- Se `forcar_reanalise` for falso/ausente, buscar análise salva na tabela `sinistro_analises_ia` e retornar sem chamar a IA
- Após chamar a IA com sucesso, salvar o resultado na tabela antes de retornar
- Incluir `salvo_em` (timestamp) na resposta

### 3. Componente: `src/components/analista-eventos/CardAnaliseRiscoIA.tsx`

- Ao montar, chamar a edge function sem `forcar_reanalise` (que retornará análise salva se existir, sem gastar créditos)
- Se já existe análise salva, exibir imediatamente com a data/hora da análise
- Botão "Reanalisar" passa `forcar_reanalise: true` para forçar nova chamada à IA
- Mostrar a data/hora da última análise no header do card

## Fluxo

```text
Página carrega
  |
  v
Componente monta --> chama edge function (sem forcar_reanalise)
  |
  v
Edge function verifica tabela sinistro_analises_ia
  |
  +-- Encontrou? --> Retorna análise salva (sem chamar IA)
  |
  +-- Não encontrou? --> Retorna vazio, componente mostra botão "Analisar"
  
Usuário clica "Analisar" ou "Reanalisar"
  |
  v
Edge function (forcar_reanalise: true) --> chama IA --> salva resultado --> retorna
```

## Arquivos alterados

1. **Migration SQL** -- criar tabela `sinistro_analises_ia`
2. **`supabase/functions/analise-risco-ia/index.ts`** -- buscar/salvar análise no banco
3. **`src/components/analista-eventos/CardAnaliseRiscoIA.tsx`** -- carregar análise salva ao montar, mostrar data da análise
