
-- Criar tabela despesas_recorrentes
CREATE TABLE public.despesas_recorrentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_nome text NOT NULL,
  fornecedor_documento text,
  categoria text NOT NULL,
  subcategoria text,
  descricao text NOT NULL,
  valor numeric NOT NULL,
  frequencia text NOT NULL DEFAULT 'mensal',
  dia_vencimento integer NOT NULL DEFAULT 1,
  forma_pagamento text,
  banco text,
  agencia text,
  conta text,
  pix_chave text,
  observacao text,
  ativo boolean NOT NULL DEFAULT true,
  ultimo_lancamento date,
  proximo_lancamento date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dia_vencimento_check CHECK (dia_vencimento >= 1 AND dia_vencimento <= 28),
  CONSTRAINT frequencia_check CHECK (frequencia IN ('mensal', 'quinzenal', 'semanal', 'anual'))
);

-- Enable RLS
ALTER TABLE public.despesas_recorrentes ENABLE ROW LEVEL SECURITY;

-- Policies para usuarios autenticados
CREATE POLICY "Usuarios autenticados podem ver despesas recorrentes"
  ON public.despesas_recorrentes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados podem criar despesas recorrentes"
  ON public.despesas_recorrentes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados podem atualizar despesas recorrentes"
  ON public.despesas_recorrentes FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados podem deletar despesas recorrentes"
  ON public.despesas_recorrentes FOR DELETE
  TO authenticated
  USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_despesas_recorrentes_updated_at
  BEFORE UPDATE ON public.despesas_recorrentes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
