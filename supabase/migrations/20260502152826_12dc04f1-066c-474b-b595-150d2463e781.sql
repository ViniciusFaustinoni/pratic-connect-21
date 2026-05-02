-- 1) Fix pontual: chassi do veículo do MOACIR JACINTO FERREIRA (KQB6655)
UPDATE public.veiculos
   SET chassi = '8AP372171E6086953',
       updated_at = now()
 WHERE id = 'c25fd80c-6ce5-4e1f-8098-eb13117b6fb8'
   AND chassi = '8AP372171E608693';

INSERT INTO public.associados_historico (associado_id, tipo, descricao, dados_novos)
VALUES (
  '82a4284a-0bbf-4168-a5f0-3cf95e756e02',
  'dados_atualizados',
  'Chassi do veículo KQB6655 corrigido pelo suporte: 8AP372171E608693 -> 8AP372171E6086953 (faltava 1 dígito; impedia aprovação no monitoramento)',
  jsonb_build_object(
    'campo', 'chassi',
    'veiculo_id', 'c25fd80c-6ce5-4e1f-8098-eb13117b6fb8',
    'placa', 'KQB6655',
    'chassi_antigo', '8AP372171E608693',
    'chassi_novo', '8AP372171E6086953'
  )
);

-- 2) Trigger BEFORE INSERT/UPDATE em veiculos.chassi: rejeita formato inválido
CREATE OR REPLACE FUNCTION public.fn_validar_chassi_strict()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.chassi IS NOT NULL
     AND NEW.chassi <> ''
     AND NEW.chassi !~ '^[A-HJ-NPR-Z0-9]{17}$' THEN
    RAISE EXCEPTION
      'Chassi inválido: % — precisa ter 17 caracteres VIN (A-Z 0-9, sem I/O/Q).',
      NEW.chassi
      USING ERRCODE = '22000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_veiculos_chassi_strict ON public.veiculos;
CREATE TRIGGER trg_veiculos_chassi_strict
BEFORE INSERT OR UPDATE OF chassi ON public.veiculos
FOR EACH ROW EXECUTE FUNCTION public.fn_validar_chassi_strict();