ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS em_troca_titularidade boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS troca_titularidade_id uuid REFERENCES public.solicitacoes_troca_titularidade(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS troca_titularidade_iniciada_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_veiculos_em_troca_titularidade
  ON public.veiculos (placa)
  WHERE em_troca_titularidade = true;

UPDATE public.veiculos v
SET em_troca_titularidade = true,
    troca_titularidade_id = s.id,
    troca_titularidade_iniciada_em = COALESCE(s.termo_cancelamento_assinado_em, now())
FROM public.solicitacoes_troca_titularidade s
WHERE s.veiculo_id = v.id
  AND s.termo_cancelamento_assinado_em IS NOT NULL
  AND s.status NOT IN ('efetivada', 'cancelada', 'reprovada_cadastro', 'reprovada_monitoramento')
  AND v.em_troca_titularidade = false;