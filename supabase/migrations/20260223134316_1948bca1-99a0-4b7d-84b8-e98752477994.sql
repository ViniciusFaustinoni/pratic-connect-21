
-- 1a. Adicionar coluna tipos_reboque
ALTER TABLE prestadores_assistencia 
ADD COLUMN IF NOT EXISTS tipos_reboque text[] DEFAULT '{}';

-- 1b. Criar tabela de valores
CREATE TABLE IF NOT EXISTS prestadores_assistencia_valores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    prestador_id uuid NOT NULL REFERENCES prestadores_assistencia(id) ON DELETE CASCADE,
    tipo_servico text NOT NULL,
    tipo_reboque text,
    valor_saida numeric(10,2),
    valor_km numeric(10,2),
    valor_fixo numeric(10,2),
    observacoes text,
    ativo boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(prestador_id, tipo_servico, tipo_reboque)
);

-- RLS
ALTER TABLE prestadores_assistencia_valores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso prestadores_assistencia_valores" ON prestadores_assistencia_valores
    FOR ALL USING (true);
