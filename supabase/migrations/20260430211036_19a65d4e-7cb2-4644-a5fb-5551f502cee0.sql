-- ============================================================
-- Endurecimento da regra de dia_vencimento (5,10,15,20,25,30)
-- e auditoria dos contratos já gerados com fallback antigo (10).
-- ============================================================

-- 1) Substituir constraints de cotacoes.dia_vencimento e
--    contratos.dia_vencimento para aceitar APENAS os 6 dias válidos.
--    associados.dia_vencimento permanece em 1..31 para compatibilidade
--    com cargas legadas e Hinova (associado pode ter um dia herdado).

ALTER TABLE public.cotacoes DROP CONSTRAINT IF EXISTS check_dia_vencimento;
ALTER TABLE public.cotacoes DROP CONSTRAINT IF EXISTS cotacoes_dia_vencimento_check;
ALTER TABLE public.cotacoes
  ADD CONSTRAINT cotacoes_dia_vencimento_check
  CHECK (dia_vencimento IS NULL OR dia_vencimento IN (5, 10, 15, 20, 25, 30));

ALTER TABLE public.contratos DROP CONSTRAINT IF EXISTS contratos_dia_vencimento_check;
ALTER TABLE public.contratos DROP CONSTRAINT IF EXISTS check_dia_vencimento;
ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_dia_vencimento_check
  CHECK (dia_vencimento IS NULL OR dia_vencimento IN (5, 10, 15, 20, 25, 30));

COMMENT ON COLUMN public.cotacoes.dia_vencimento IS
  'Dia do mês para vencimento das parcelas. Valores aceitos: 5, 10, 15, 20, 25, 30. Calculado por src/utils/vencimento.ts a partir da data de fechamento.';
COMMENT ON COLUMN public.contratos.dia_vencimento IS
  'Dia do mês para vencimento das parcelas. Valores aceitos: 5, 10, 15, 20, 25, 30. Espelha a escolha feita na cotação.';

-- 2) Tabela de auditoria com os contratos suspeitos:
--    cotação salva sem dia_vencimento (NULL) e contrato gerado com 10
--    fora da janela válida calculada a partir da data da cotação.
--    O time financeiro usa esta tabela para revisar manualmente — nada
--    é alterado automaticamente (envolveria Asaas/Hinova).

CREATE TABLE IF NOT EXISTS public.auditoria_dia_vencimento_legado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  cotacao_id UUID REFERENCES public.cotacoes(id) ON DELETE SET NULL,
  associado_id UUID REFERENCES public.associados(id) ON DELETE SET NULL,
  veiculo_placa TEXT,
  data_cotacao DATE,
  dia_vencimento_atual INTEGER,
  opcoes_validas_na_data INTEGER[],
  motivo TEXT NOT NULL,
  revisado BOOLEAN NOT NULL DEFAULT false,
  revisado_por UUID,
  revisado_em TIMESTAMPTZ,
  observacao_revisao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.auditoria_dia_vencimento_legado ENABLE ROW LEVEL SECURITY;

-- Apenas perfis financeiros/diretoria visualizam/atualizam
DROP POLICY IF EXISTS "auditoria_venc_select_admin" ON public.auditoria_dia_vencimento_legado;
CREATE POLICY "auditoria_venc_select_admin"
  ON public.auditoria_dia_vencimento_legado
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'financeiro')
  );

DROP POLICY IF EXISTS "auditoria_venc_update_admin" ON public.auditoria_dia_vencimento_legado;
CREATE POLICY "auditoria_venc_update_admin"
  ON public.auditoria_dia_vencimento_legado
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'financeiro')
  );

-- Helper: calcular as duas opções válidas a partir do dia do mês
CREATE OR REPLACE FUNCTION public.opcoes_vencimento_por_dia(dia_hoje INTEGER)
RETURNS INTEGER[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN dia_hoje >= 30 OR dia_hoje <= 4 THEN ARRAY[5, 10]
    WHEN dia_hoje BETWEEN 5  AND 9      THEN ARRAY[10, 15]
    WHEN dia_hoje BETWEEN 10 AND 14     THEN ARRAY[15, 20]
    WHEN dia_hoje BETWEEN 15 AND 19     THEN ARRAY[20, 25]
    WHEN dia_hoje BETWEEN 20 AND 24     THEN ARRAY[25, 30]
    WHEN dia_hoje BETWEEN 25 AND 29     THEN ARRAY[30, 5]
    ELSE ARRAY[5, 10]
  END;
$$;

-- Popular auditoria com contratos cuja cotação não tinha dia_vencimento
-- E o dia atual do contrato NÃO bate com nenhuma das duas opções válidas
-- da data de criação da cotação.
INSERT INTO public.auditoria_dia_vencimento_legado (
  contrato_id, cotacao_id, associado_id, veiculo_placa,
  data_cotacao, dia_vencimento_atual, opcoes_validas_na_data, motivo
)
SELECT
  c.id,
  cot.id,
  c.associado_id,
  v.placa,
  cot.created_at::date,
  c.dia_vencimento,
  public.opcoes_vencimento_por_dia(EXTRACT(DAY FROM cot.created_at)::int),
  'Cotação criada sem dia_vencimento (NULL); contrato recebeu fallback hardcoded e ficou fora da janela válida da data de fechamento.'
FROM public.contratos c
JOIN public.cotacoes cot ON cot.id = c.cotacao_id
LEFT JOIN public.veiculos v ON v.id = c.veiculo_id
WHERE cot.dia_vencimento IS NULL
  AND c.dia_vencimento IS NOT NULL
  AND c.dia_vencimento <> ALL (public.opcoes_vencimento_por_dia(EXTRACT(DAY FROM cot.created_at)::int))
  AND NOT EXISTS (
    SELECT 1 FROM public.auditoria_dia_vencimento_legado a WHERE a.contrato_id = c.id
  );
