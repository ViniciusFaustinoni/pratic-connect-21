
-- ========================================================================
-- 1) SANEAMENTO KOU6D37 (troca efetivada sem religar cobertura)
-- ========================================================================

-- 1a. Religar cobertura do veículo (carro R$30.835 c/ rastreador instalado)
UPDATE public.veiculos
SET cobertura_total = true,
    cobertura_roubo_furto = true,
    updated_at = now()
WHERE id = 'd5181403-22c0-4f2a-b22e-b6e7d821376c'
  AND placa = 'KOU6D37'
  AND status = 'ativo';

-- 1b. Reatribuir rastreador (IMEI 869412077334305) ao novo titular
UPDATE public.rastreadores
SET associado_id = 'de5f0d04-2e69-464d-b681-98e7bc03dfc4',
    updated_at = now()
WHERE imei = '869412077334305'
  AND veiculo_id = 'd5181403-22c0-4f2a-b22e-b6e7d821376c';

-- 1c. Cancelar contrato órfão vindo da solicitação cancelada a5c915b6
UPDATE public.contratos
SET status = 'cancelado',
    data_cancelamento = now(),
    updated_at = now()
WHERE id = 'cad888ca-54cc-4d5c-8d99-d48396a0adf4'
  AND status = 'ativo';

-- ========================================================================
-- 2) TRIGGER DEFENSIVA: cancelar solicitação cascateia contratos órfãos
-- ========================================================================
CREATE OR REPLACE FUNCTION public.fn_troca_cancelada_cancela_contrato_orfao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelada','expirada')
     AND COALESCE(OLD.status,'') NOT IN ('cancelada','expirada') THEN
    UPDATE public.contratos
    SET status = 'cancelado',
        data_cancelamento = now(),
        updated_at = now()
    WHERE origem_troca_titularidade_id = NEW.id
      AND status IN ('pendente','assinado','ativo');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_troca_cancelada_cancela_contrato_orfao
  ON public.solicitacoes_troca_titularidade;

CREATE TRIGGER trg_troca_cancelada_cancela_contrato_orfao
AFTER UPDATE OF status ON public.solicitacoes_troca_titularidade
FOR EACH ROW
EXECUTE FUNCTION public.fn_troca_cancelada_cancela_contrato_orfao();
