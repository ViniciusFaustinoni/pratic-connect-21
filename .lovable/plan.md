

# Criar tabela `plano_elegibilidade_modelos`

## Problema com o SQL proposto

A policy RLS `auth.jwt() ->> 'role'` nao funciona no Supabase — o JWT nao tem um campo `role` com os perfis do sistema. O projeto ja usa `has_role(auth.uid(), 'admin')` como padrao.

## Plano

### 1. Migration SQL (corrigida)

Criar a tabela conforme proposto, mas com RLS corrigida:

```sql
CREATE TABLE plano_elegibilidade_modelos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plano_id uuid NOT NULL REFERENCES planos(id) ON DELETE CASCADE,
  linha_slug varchar NOT NULL,
  marca varchar NOT NULL,
  modelo varchar NOT NULL,
  ano_min integer NOT NULL DEFAULT 2005,
  ano_max integer,
  combustivel varchar DEFAULT 'qualquer',
  status varchar NOT NULL DEFAULT 'aceito' CHECK (status IN ('aceito', 'limitado', 'negado')),
  observacao text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_elegibilidade_plano_id ON plano_elegibilidade_modelos(plano_id);
CREATE INDEX idx_elegibilidade_linha_slug ON plano_elegibilidade_modelos(linha_slug);
CREATE INDEX idx_elegibilidade_marca_modelo ON plano_elegibilidade_modelos(marca, modelo);

ALTER TABLE plano_elegibilidade_modelos ENABLE ROW LEVEL SECURITY;

-- Leitura publica para registros ativos (necessario no cotador)
CREATE POLICY "Leitura publica de elegibilidade"
  ON plano_elegibilidade_modelos FOR SELECT
  USING (is_active = true);

-- Gestao por admins e diretores (usando has_role existente)
CREATE POLICY "Gestao por admins"
  ON plano_elegibilidade_modelos FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'desenvolvedor')
  );
```

### 2. Sem alteracoes de codigo nesta etapa

A tabela sera criada vazia. A integracao no frontend (UI de gestao + filtro no cotador) sera feita em etapas subsequentes.

### Correcao aplicada
- `auth.jwt() ->> 'role'` substituido por `public.has_role()` — alinhado com o padrao de seguranca do projeto.

