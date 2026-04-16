
-- 1) Recriar a função para também setar profissional_id no INSERT
CREATE OR REPLACE FUNCTION public.sync_vistoria_to_servicos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.servicos (
      tipo,
      status,
      data_agendada,
      periodo,
      profissional_id,
      associado_id,
      veiculo_id,
      vistoria_origem_id,
      cep,
      logradouro,
      numero,
      bairro,
      cidade,
      rota_id,
      created_at,
      updated_at
    ) VALUES (
      COALESCE(
        CASE
          WHEN NEW.origem = 'cotacao' THEN 'vistoria_cotacao'
          WHEN NEW.origem = 'contrato' THEN 'vistoria_contrato'
          WHEN NEW.origem = 'manutencao' THEN 'vistoria_manutencao'
          ELSE 'vistoria'
        END,
        'vistoria'
      ),
      COALESCE(NEW.status, 'agendado'),
      NEW.data_agendada,
      NEW.periodo,
      NEW.vistoriador_id,
      NEW.associado_id,
      NEW.veiculo_id,
      NEW.id,
      NEW.endereco_cep,
      NEW.endereco_logradouro,
      NEW.endereco_numero,
      NEW.endereco_bairro,
      NEW.endereco_cidade,
      NEW.rota_id,
      now(),
      now()
    )
    ON CONFLICT (vistoria_origem_id) WHERE vistoria_origem_id IS NOT NULL
    DO UPDATE SET
      profissional_id = EXCLUDED.profissional_id,
      updated_at = now();

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE public.servicos SET
      status = COALESCE(NEW.status, status),
      data_agendada = NEW.data_agendada,
      periodo = NEW.periodo,
      profissional_id = COALESCE(NEW.vistoriador_id, profissional_id),
      associado_id = NEW.associado_id,
      veiculo_id = NEW.veiculo_id,
      cep = NEW.endereco_cep,
      logradouro = NEW.endereco_logradouro,
      numero = NEW.endereco_numero,
      bairro = NEW.endereco_bairro,
      cidade = NEW.endereco_cidade,
      rota_id = NEW.rota_id,
      updated_at = now()
    WHERE vistoria_origem_id = NEW.id;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Backfill: atualizar servicos que têm vistoria com vistoriador mas profissional_id está null
UPDATE public.servicos s
SET profissional_id = v.vistoriador_id,
    updated_at = now()
FROM public.vistorias v
WHERE s.vistoria_origem_id = v.id
  AND v.vistoriador_id IS NOT NULL
  AND s.profissional_id IS NULL;
